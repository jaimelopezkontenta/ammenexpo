-- Ammen — Ola P0 de generación IA: cuota por ledger append-only, reserva
-- atómica por usuario y lease server-side de continuaciones.
--
-- **El agujero.** El generador de planes (`generate-prayer-plan`) medía la
-- cuota gratuita contando filas vivas de `prayer_plans`
-- (`count(*) where status <> 'failed'`). Tres defectos de eso:
--
--   1. **No era atómico.** Dos peticiones a la vez leían ambas "quedan 2" y
--      reservaban las dos, saltándose el límite.
--   2. **Se reseteaba borrando o marcando.** Borrar un plan o marcarlo
--      `failed` devolvía la cuota — un plan roto se convertía en generaciones
--      gratis ilimitadas simplemente borrándolo y volviendo a pedir.
--   3. **No había idempotencia ni lease.** Un reintento del mismo request
--      consumía dos veces, y dos continuaciones del mismo plan generaban el
--      mismo tramo a la vez (quemando presupuesto de proveedor) hasta que el
--      índice único de días rechazaba una de las dos.
--
-- **Lo que este archivo construye, punto por punto:**
--
-- - `generation_ledger`: append-only. Una fila por **reserva** (plan nuevo,
--   `scope` `personal`/`circle`) y una por **resultado de tramo** (`scope`
--   `continuation`, `completed`/`failed`). La cuota es `count(*)` de reservas
--   para el usuario — **permanente**, no se reembolsa al borrar ni al marcar
--   `failed`, y no depende del conteo de filas vivas de `prayer_plans`.
-- - `reserve_generation()`: reserva atómica por usuario (advisory lock por
--   usuario) que además crea la fila de `prayer_plans` en la misma transacción
--   — así no hay ventana entre "reservé" y "creé el plan". Idempotente por
--   `request_id`: reintentar el mismo request devuelve el plan ya creado, no
--   reserva dos veces. Valida `duration_days` en 3..30 y, para círculos,
--   `can_create_circle_plan()` (admin + un plan activo por círculo).
-- - `claim_generation_chunk()`: el lease. Calcula el siguiente tramo **en el
--   servidor** a partir de los días ya escritos (nunca del cliente) y lo
--   arrienda por `leased_until`. Dos reclamaciones concurrentes del mismo plan
--   se serializan con un advisory lock por plan: solo una gana, la otra lee
--   `in_flight`. Idempotente por `request_id` (mismo request → `already`). Un
--   lease vencido se reclama (`reclaim`), así que una invocación muerta a
--   mitad no deja el plan congelado para siempre.
-- - `settle_generation_chunk()`: cierra el tramo. Escribe el resultado en el
--   ledger (append-only) y suelta el lease. Un fallo del proveedor se resuelve
--   aquí — el lease no queda eterno; y si la invocación muere sin resolver, la
--   expiración del lease hace el resto.
--
-- **El modelo de escritura se conserva.** El cliente JAMÁS escribe en el
-- ledger ni en los leases: solo los lee (el ledger, el suyo propio) y solo los
-- mueven las RPC `security definer` de arriba, que se llaman con el JWT del
-- usuario y comprueban `auth.uid()` dentro. `prayer_plans` se sigue creando
-- con el dueño que dicta el JWT; no se convierte nada a service_role. Los
-- grants de `prayer_plans` **no** se tocan en esta ola (ver sección 6 del plan
-- operativo: la revocación de grants es una ola aparte).
--
-- **Fuera de esta ola (dependencias documentadas, no implementadas aquí):**
-- pagos (el límite gratis es fijo, `FREE_PLAN_LIMIT = 3`, sin vía de ampliarlo
-- todavía), `pg_cron` (la limpieza de leases vencidos es perezosa: la hace el
-- propio `claim_generation_chunk` al reclamar), flags nuevos, simetría de
-- bloqueo y scheduler de push.
--
-- **Concurrencia.** La garantía de que dos reservas/reclamaciones concurrentes
-- no se saltan el límite descansa en los advisory locks de Postgres, que son
-- correctos bajo concurrencia real. La suite SQL (`supabase/tests/generation.sql`)
-- corre sobre UNA conexión y no puede demostrar una carrera: para eso está el
-- harness manual `supabase/tests/generation-concurrency.sh`, que lanza N
-- reservas en paralelo y afirma que solo `FREE_PLAN_LIMIT` ganan.

-- ---------------------------------------------------------------------------
-- 1. generation_ledger — append-only
-- ---------------------------------------------------------------------------

create table public.generation_ledger (
  id uuid primary key default gen_random_uuid(),
  -- Clave de idempotencia del cliente. Misma clave ⇒ misma reserva/tramo.
  request_id uuid not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'personal' | 'circle' son reservas (consumen cuota, permanentes).
  -- 'continuation' es el resultado de un tramo (no consume cuota).
  scope text not null check (scope in ('personal', 'circle', 'continuation')),
  plan_id uuid references public.prayer_plans (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  duration_days smallint,
  from_day smallint,
  to_day smallint,
  status text not null check (status in ('reserved', 'completed', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

-- La consulta de cuota: reservas por usuario. El índice parcial evita que las
-- filas de tramos compitan en el árbol.
create index generation_ledger_user_scope_idx
  on public.generation_ledger (user_id, scope)
  where scope in ('personal', 'circle');

create index generation_ledger_plan_idx on public.generation_ledger (plan_id);

alter table public.generation_ledger enable row level security;

-- El dueño puede leer su propio ledger (para "cuántas generaciones me quedan"
-- y para auditarse); nadie lo escribe por la API.
create policy "owners read their own generation ledger"
  on public.generation_ledger for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Append-only: mismo patrón que `staff_admin_events`. Los DEFAULT PRIVILEGES
-- del entorno conceden DELETE/TRIGGER por sí solos, así que se revoca TODO y
-- se da exactamente lo necesario. Las RPC de abajo corren como definer y no
-- pasan por este grant.
revoke all on public.generation_ledger from anon, authenticated, service_role;
grant select on public.generation_ledger to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. plan_generation_leases — el lease server-side de continuaciones
-- ---------------------------------------------------------------------------
--
-- Un plan tiene a lo sumo UN lease vivo a la vez (`plan_id` es PK). El lease
-- no es append-only: se reclama y se suelta. Lo que importa es que nadie lo
-- escribe por la API — solo `claim_generation_chunk` y `settle_generation_chunk`.

create table public.plan_generation_leases (
  plan_id uuid primary key references public.prayer_plans (id) on delete cascade,
  -- La misma clave del request que reclamó: lo que hace idempotente el claim.
  request_id uuid not null unique,
  from_day smallint not null,
  to_day smallint not null,
  -- Token que se entrega al reclamante; solo con él se puede resolver.
  lease_id uuid not null,
  claimed_by uuid not null references public.profiles (id) on delete cascade,
  leased_until timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.plan_generation_leases enable row level security;

revoke all on public.plan_generation_leases from anon, authenticated, service_role;
grant select on public.plan_generation_leases to service_role;

-- ---------------------------------------------------------------------------
-- 3. reserve_generation — reserva atómica + creación del plan
-- ---------------------------------------------------------------------------

create function public.reserve_generation(
  p_request_id uuid,
  p_scope text,
  p_duration_days smallint,
  p_group_id uuid default null,
  p_visibility text default 'private',
  p_source_prompt jsonb default null
)
returns table (
  ok boolean,
  reason text,
  plan_id uuid,
  reservation_id uuid,
  quota_used integer,
  quota_limit integer,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_limit constant integer := 3;
  v_used integer;
  v_existing public.generation_ledger;
  v_plan public.prayer_plans;
  v_reservation_id uuid;
  v_visibility public.plan_visibility;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_scope not in ('personal', 'circle') then
    raise exception 'reserve_generation: unknown scope %', p_scope;
  end if;

  -- Idempotencia: el mismo request ya reservó. Devolver lo reservado, sin
  -- crear otro plan y sin consumir otra cuota.
  select * into v_existing
    from public.generation_ledger
   where request_id = p_request_id
     and scope in ('personal', 'circle');
  if found then
    select count(*) into v_used
      from public.generation_ledger
     where user_id = v_user
       and scope in ('personal', 'circle');

    return query
      select true, 'ok', v_existing.plan_id, v_existing.id, v_used, v_limit, false;
    return;
  end if;

  -- Revalidación server-side de la duración: nunca se fía del cliente.
  if p_duration_days < 3 or p_duration_days > 30 then
    return query
      select false, 'invalid_duration', null::uuid, null::uuid, 0, v_limit, false;
    return;
  end if;

  -- Un plan de círculo: el dueño debe administrar el círculo y no puede haber
  -- ya un plan activo en él (`can_create_circle_plan`, que lee el índice único
  -- `prayer_plans_one_active_per_group`).
  if p_scope = 'circle' then
    if p_group_id is null or not public.can_create_circle_plan(p_group_id) then
      return query
        select false, 'circle_not_allowed', null::uuid, null::uuid, 0, v_limit, false;
      return;
    end if;
    v_visibility := 'group'::public.plan_visibility;
  else
    v_visibility := case p_visibility
      when 'link' then 'link'::public.plan_visibility
      when 'public' then 'public'::public.plan_visibility
      else 'private'::public.plan_visibility
    end;
  end if;

  -- Serializa las reservas de este usuario: dos peticiones concurrentes no
  -- pueden leer ambas "quedan 2" y reservar a la vez.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select count(*) into v_used
    from public.generation_ledger
   where user_id = v_user
     and scope in ('personal', 'circle');

  if v_used >= v_limit then
    return query
      select false, 'quota_exhausted', null::uuid, null::uuid, v_used, v_limit, false;
    return;
  end if;

  -- El plan y su reserva nacen en la misma transacción: no hay ventana entre
  -- "consumí la cuota" y "existe el plan".
  insert into public.prayer_plans (
    owner_id, title, duration_days, start_date, visibility, group_id,
    status, generated_by, source_prompt
  )
  values (
    v_user, '…', p_duration_days, current_date, v_visibility,
    case when p_scope = 'circle' then p_group_id else null end,
    'generating', 'ai', p_source_prompt
  )
  returning * into v_plan;

  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, group_id, duration_days, status
  )
  values (
    p_request_id, v_user, p_scope, v_plan.id,
    case when p_scope = 'circle' then p_group_id else null end,
    p_duration_days, 'reserved'
  )
  returning id into v_reservation_id;

  return query
    select true, 'ok', v_plan.id, v_reservation_id, v_used + 1, v_limit, true;
end;
$$;

revoke execute on function public.reserve_generation(uuid, text, smallint, uuid, text, jsonb)
  from public;
grant execute on function public.reserve_generation(uuid, text, smallint, uuid, text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. claim_generation_chunk — reclamar el siguiente tramo con lease
-- ---------------------------------------------------------------------------

create function public.claim_generation_chunk(
  p_plan_id uuid,
  p_request_id uuid,
  p_lease_seconds integer default 300
)
returns table (
  reason text,
  from_day smallint,
  to_day smallint,
  lease_id uuid,
  written smallint,
  duration_days smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_owner uuid;
  v_duration smallint;
  v_written integer;
  v_from smallint;
  v_to smallint;
  v_lease public.plan_generation_leases;
  v_settled record;
  v_lease_id uuid;
  v_seconds integer := greatest(coalesce(p_lease_seconds, 300), 30);
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select p.owner_id, p.duration_days into v_owner, v_duration
    from public.prayer_plans p
   where p.id = p_plan_id;
  if not found then
    return query select 'not_found', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;
  if v_owner <> v_user then
    return query select 'not_owner', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  -- Serializa las reclamaciones de este plan.
  perform pg_advisory_xact_lock(hashtextextended(p_plan_id::text, 0));

  -- Idempotencia: este request ya generó su tramo (y quedó resuelto).
  select into v_settled
    from public.generation_ledger
   where request_id = p_request_id
     and scope = 'continuation';
  if found then
    return query select 'already', v_settled.from_day, v_settled.to_day,
                        null::uuid,
                        (select count(*)::smallint from public.prayer_plan_days d
                          where d.plan_id = p_plan_id),
                        v_duration;
    return;
  end if;

  -- Idempotencia: este request ya está en vuelo con un lease.
  select * into v_lease
    from public.plan_generation_leases
   where request_id = p_request_id;
  if found then
    return query select 'already', v_lease.from_day, v_lease.to_day,
                        v_lease.lease_id,
                        (select count(*)::smallint from public.prayer_plan_days d
                          where d.plan_id = p_plan_id),
                        v_duration;
    return;
  end if;

  -- El tramo se calcula AQUÍ, no en el cliente: desde el día siguiente al
  -- último escrito hasta, a lo sumo, 7 días o el final del plan.
  select count(*) into v_written
    from public.prayer_plan_days d
   where d.plan_id = p_plan_id;

  if v_written >= v_duration then
    return query select 'complete', null::smallint, null::smallint,
                        null::uuid, v_written::smallint, v_duration;
    return;
  end if;

  v_from := v_written + 1;
  v_to := least(v_written + 7, v_duration::integer);

  -- Reclamar con lease. Si otro request distinto tiene el lease vivo,
  -- `in_flight`; si el lease venció (la invocación anterior murió), se reclama.
  select * into v_lease
    from public.plan_generation_leases
   where plan_id = p_plan_id;

  if found and v_lease.leased_until > now() then
    return query select 'in_flight', v_lease.from_day, v_lease.to_day,
                        null::uuid, v_written::smallint, v_duration;
    return;
  end if;

  v_lease_id := gen_random_uuid();

  if found then
    update public.plan_generation_leases
       set request_id = p_request_id,
           from_day = v_from,
           to_day = v_to,
           lease_id = v_lease_id,
           claimed_by = v_user,
           leased_until = now() + make_interval(secs => v_seconds)
     where plan_id = p_plan_id;
  else
    insert into public.plan_generation_leases
      (plan_id, request_id, from_day, to_day, lease_id, claimed_by, leased_until)
    values
      (p_plan_id, p_request_id, v_from, v_to, v_lease_id, v_user,
       now() + make_interval(secs => v_seconds));
  end if;

  return query select 'claimed', v_from, v_to, v_lease_id,
                      v_written::smallint, v_duration;
end;
$$;

revoke execute on function public.claim_generation_chunk(uuid, uuid, integer)
  from public;
grant execute on function public.claim_generation_chunk(uuid, uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. settle_generation_chunk — resolver el tramo y soltar el lease
-- ---------------------------------------------------------------------------

create function public.settle_generation_chunk(
  p_lease_id uuid,
  p_outcome text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_lease public.plan_generation_leases;
  v_duration smallint;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_outcome not in ('completed', 'failed') then
    raise exception 'settle_generation_chunk: unknown outcome %', p_outcome;
  end if;

  select * into v_lease
    from public.plan_generation_leases
   where lease_id = p_lease_id;
  if not found then
    -- Ya resuelto (o el lease expiró y fue reclamado por otra invocación):
    -- un reintento idempotente, no un fallo.
    return false;
  end if;

  if v_lease.claimed_by <> v_user then
    raise exception 'settle_generation_chunk: not the lease holder';
  end if;

  select p.duration_days into v_duration
    from public.prayer_plans p
   where p.id = v_lease.plan_id;

  -- Append-only: el resultado del tramo queda escrito, nada se reescribe.
  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, duration_days,
    from_day, to_day, status, error
  )
  values (
    v_lease.request_id, v_user, 'continuation', v_lease.plan_id, v_duration,
    v_lease.from_day, v_lease.to_day,
    case when p_outcome = 'completed' then 'completed' else 'failed' end,
    p_error
  );

  delete from public.plan_generation_leases where lease_id = p_lease_id;

  return true;
end;
$$;

revoke execute on function public.settle_generation_chunk(uuid, text, text)
  from public;
grant execute on function public.settle_generation_chunk(uuid, text, text)
  to authenticated;
