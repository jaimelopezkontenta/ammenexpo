-- Ammen — hardening final de la ola ledger/cuota/lease IA (v4, forward-only).
--
-- Esto cierra los hallazgos abiertos tras la v3, sin tocar flags, push
-- scheduler, pagos ni la semántica de bloqueo, y sin convertir nada a
-- service_role (JWT/RLS se conservan). Hallazgo por hallazgo:
--
--   1. `claim_generation_chunk` no miraba el `status` del plan: un cliente
--      manipulado podía reclamar tramos sobre un plan `failed`, `completed` o
--      `archived`. Ahora solo `generating` y `active` — los dos estados en que
--      la generación es legítima — pueden reclamar; cualquier otro devuelve
--      `not_generatable` y no crea lease ni escribe nada.
--
--   2. La idempotencia del claim por `request_id` devolvía `already` ante
--      CUALQUIER lease con esa clave, vivo o vencido. Un worker muerto (lease
--      vencido, sin settle) dejaba la clave envenenada para siempre: reintentar
--      el mismo request devolvía `already` con un `lease_id` ya inservible. Ahora
--      solo un lease VIGENTE devuelve `already`; un lease vencido cae al camino
--      de reclaim (nuevo `lease_id`, nuevo `leased_until`), así que una
--      invocación muerta no congela su propia clave. El `already` post-settle
--      (fila `continuation` en el ledger) se conserva intacto.
--
--   4 (servidor). `complete_generation_chunk` refresca `updated_at` del plan en
--      CADA tramo completado. Ese es el "latido" que el detector del cliente
--      (`isStuckGenerating`) usa para distinguir "sigue generando" de "el tramo
--      posterior quedó atascado": sin él, `updated_at` solo se movía en el
--      primer tramo (generating→active) y un plan de 30 días en plena
--      generación parecía atascado, o a la inversa.
--
--   3. Cierre del bypass de escritura directa a `prayer_plan_days`. El inventario
--      de writers legítimos es: `complete_generation_chunk` (security definer,
--      escribe días y ya está fenceado) y el trigger `sync_intercession_count`
--      (definer, mantiene `intercession_count`). No hay escritura directa desde
--      el cliente. Se revoca INSERT/UPDATE/DELETE al rol `authenticated`;
--      SELECT (con sus grants de columna) queda intacto, y las RPC definer
--      siguen pasando por encima del grant.
--
--   7. `settle_generation_chunk` ya exige dueño (`claimed_by`) + `lease_id`
--      vigente (no vencido); no se altera su lógica. Los tests negativos que lo
--      demuestran (un extraño no liquida el lease ajeno; un lease vencido o
--      desconocido devuelve false sin escribir) viven en generation.sql.

-- ---------------------------------------------------------------------------
-- 1/2. claim_generation_chunk — puerta de estado + reclaim del lease vencido
-- ---------------------------------------------------------------------------

create or replace function public.claim_generation_chunk(
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
  v_status public.plan_status;
  v_duration smallint;
  v_written integer;
  v_from smallint;
  v_to smallint;
  v_settled_from smallint;
  v_settled_to smallint;
  v_lease public.plan_generation_leases;
  v_lease_id uuid;
  -- Suelo (30s) y techo (1h): el cliente no puede arrendar años ni segundos.
  v_seconds integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 3600);
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select p.owner_id, p.duration_days, p.status
    into v_owner, v_duration, v_status
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

  -- Hallazgo 1: la generación solo es legítima mientras el plan está
  -- `generating` o `active`. `failed`, `completed` y `archived` son terminales:
  -- reclamar un tramo sobre ellos sería seguir quemando presupuesto de
  -- proveedor sobre un plan que ya no debe generar. Un cliente manipulado
  -- recibe `not_generatable`, no un lease.
  if v_status not in ('generating', 'active') then
    return query select 'not_generatable', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  -- #9b: un plan sin reserva legítima en el ledger no puede reclamar tramos.
  if not exists (
    select 1 from public.generation_ledger
     where plan_id = p_plan_id
       and user_id = v_user
       and scope in ('personal', 'circle')
       and status = 'reserved'
  ) then
    return query select 'no_reservation', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  -- Serializa las reclamaciones de este plan.
  perform pg_advisory_xact_lock(hashtextextended(p_plan_id::text, 0));

  -- Idempotencia post-settle: este request ya generó su tramo y quedó resuelto.
  select l.from_day, l.to_day into v_settled_from, v_settled_to
    from public.generation_ledger l
   where l.request_id = p_request_id
     and l.plan_id = p_plan_id
     and l.scope = 'continuation';
  if found then
    return query select 'already', v_settled_from, v_settled_to,
                        null::uuid,
                        (select count(*)::smallint from public.prayer_plan_days d
                          where d.plan_id = p_plan_id),
                        v_duration;
    return;
  end if;

  -- Idempotencia en vuelo: SOLO un lease VIGENTE significa "ya lo estoy
  -- escribiendo". Un lease vencido es un worker muerto, no un worker activo:
  -- devolver `already` aquí entregaría al reintento un `lease_id` inservible y
  -- congelaría la clave para siempre. Un lease vencido cae al reclaim de abajo.
  select * into v_lease
    from public.plan_generation_leases
   where request_id = p_request_id
     and leased_until > now();
  if found then
    return query select 'already', v_lease.from_day, v_lease.to_day,
                        v_lease.lease_id,
                        (select count(*)::smallint from public.prayer_plan_days d
                          where d.plan_id = p_plan_id),
                        v_duration;
    return;
  end if;

  -- El tramo se calcula AQUÍ, no en el cliente.
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
  -- `in_flight`; si el lease venció (la invocación anterior murió), se reclama
  -- con un `lease_id` nuevo — el worker antiguo, si siguiera vivo, ya no puede
  -- resolver porque su token dejó de existir.
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
-- 4 (servidor). complete_generation_chunk — latido `updated_at` por tramo
-- ---------------------------------------------------------------------------

create or replace function public.complete_generation_chunk(
  p_lease_id uuid,
  p_days jsonb,
  p_title text default null,
  p_theme text default null,
  p_source_prompt jsonb default null
)
returns table (ok boolean, reason text, is_complete boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_lease public.plan_generation_leases;
  v_duration smallint;
  v_written integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  -- El fence: solo el lease vigente del tramo puede escribir días y mover el
  -- estado del plan. Un lease vencido o reclamado por otro no toca nada.
  select * into v_lease
    from public.plan_generation_leases
   where lease_id = p_lease_id
     and leased_until > now();
  if not found then
    return query select false, 'lease_lost', false;
    return;
  end if;

  if v_lease.claimed_by <> v_user then
    raise exception 'complete_generation_chunk: not the lease holder';
  end if;

  select p.duration_days into v_duration
    from public.prayer_plans p
   where p.id = v_lease.plan_id;

  if p_days is not null and jsonb_array_length(p_days) > 0 then
    insert into public.prayer_plan_days
      (plan_id, day_number, title, scripture_ref, scripture_text,
       interpretation, daily_action, prayer_body, intercessor_prayer, unlock_date)
    select v_lease.plan_id,
           (d->>'day_number')::smallint,
           d->>'title',
           nullif(d->>'scripture_ref', ''),
           nullif(d->>'scripture_text', ''),
           nullif(d->>'interpretation', ''),
           nullif(d->>'daily_action', ''),
           d->>'prayer_body',
           nullif(d->>'intercessor_prayer', ''),
           (d->>'unlock_date')::date
      from jsonb_array_elements(p_days) d
    on conflict (plan_id, day_number) do nothing;
  end if;

  -- Latido: cada tramo completado refresca `updated_at`. Es el reloj que el
  -- detector del cliente usa para distinguir "sigue generando" de "quedó
  -- atascado". Sin este UPDATE, un plan de varios tramos solo movería
  -- `updated_at` en el primero (generating→active) y un tramo posterior en
  -- plena generación parecería atascado, o un tramo posterior muerto no lo
  -- parecería nunca.
  update public.prayer_plans
     set updated_at = now()
   where id = v_lease.plan_id;

  if v_lease.from_day = 1 then
    -- Primer tramo: el plan sale de 'generating' con título/theme/modelo.
    update public.prayer_plans
       set title = coalesce(nullif(btrim(p_title), ''), title),
           theme = p_theme,
           source_prompt = coalesce(p_source_prompt, source_prompt),
           status = 'active'
     where id = v_lease.plan_id
       and status = 'generating';
  elsif v_lease.to_day >= v_duration then
    -- Último tramo de una continuación: el plan se completa.
    update public.prayer_plans
       set status = 'active'
     where id = v_lease.plan_id
       and status = 'generating';
  end if;

  -- Append-only: el resultado del tramo queda escrito.
  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, duration_days,
    from_day, to_day, status
  )
  values (
    v_lease.request_id, v_user, 'continuation', v_lease.plan_id, v_duration,
    v_lease.from_day, v_lease.to_day, 'completed'
  );

  delete from public.plan_generation_leases where lease_id = p_lease_id;

  select count(*)::integer into v_written
    from public.prayer_plan_days
   where plan_id = v_lease.plan_id;

  return query select true, 'ok', v_written >= v_duration;
end;
$$;

revoke execute on function public.complete_generation_chunk(uuid, jsonb, text, text, jsonb)
  from public;
grant execute on function public.complete_generation_chunk(uuid, jsonb, text, text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cerrar el bypass de escritura directa a prayer_plan_days
--
-- Inventario de writers con rol `authenticated` (auditado en
-- `core/plans/*.ts`, `core/intercessions/queries.ts` y la Edge Function):
--   * INSERT de días   — solo `complete_generation_chunk` (security definer).
--   * UPDATE           — nadie directo; `intercession_count` lo mantiene el
--     trigger `sync_intercession_count` (definer), no el cliente.
--   * DELETE           — nadie legítimo.
-- La Edge Function ya persiste mediante la RPC fenceada `complete_generation_chunk`,
-- así que revocar aquí no apaga ningún canal legítimo: el JWT del usuario y la
-- RLS se conservan, y las RPC definer pasan por encima del grant.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.prayer_plan_days from authenticated;
