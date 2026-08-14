-- Ammen — corrección de la ola ledger/cuota/lease IA (forward-only).
--
-- Esto no toca `20260828100000_generation_ledger_quota_lease.sql` (ya aplicado):
-- corrige por delante los hallazgos del verificador sobre aquel primer slice.
--
-- Lo que arregla, hallazgo por hallazgo:
--
--   1. `claim_generation_chunk` hacía `SELECT INTO record` sin lista de columnas.
--      Un record sin columnas asignadas no tiene estructura y, tras un settle,
--      el reintento del mismo request reventaba con `record has no field
--      from_day`. Ahora lee columnas explícitas.
--
--   2. El alta reserva con el `request_id` del cliente pero reclamaba el primer
--      tramo con un UUID nuevo al azar. Eso rompe la idempotencia del alta
--      entera (un retry avanzaría el plan de más o generaría dos veces). La
--      clave del tramo se deriva de forma estable en la Edge Function
--      (`chunkRequestId.ts`, UUIDv5 sobre la clave de reserva), de modo que la
--      reserva y su tramo usan claves DISTINTAS (no chocan con el UNIQUE
--      global) pero ambas estables ante un reintento.
--
--   3. `reserve_generation` consultaba la idempotencia ANTES del advisory lock
--      y sin filtrar `user_id`: un caller podía leer el plan ajeno adivinando
--      un `request_id`, y dos reservas concurrentes del mismo request caían en
--      UNIQUE violation (un 500). Ahora la comprobación va DENTRO del lock y
--      filtrada por dueño; una colisión de `request_id` con OTRO usuario se
--      rechaza limpia (`request_id_conflict`), sin 500.
--
--   4. Crear shares después de reservar quemaba cuota si el share fallaba (y el
--      "borrar el plan" de compensación NO devuelve el slot, así que el usuario
--      perdía plan y slot). Los shares de círculo se validan y crean AHORA en
--      la misma transacción que la reserva: un círculo inválido revierte todo.
--      No hay reembolso arbitrable desde el cliente.
--
--   5. El lease se convierte en fence de la persistencia: `complete_*` y
--      `fail_*` exigen el `lease_id` vigente (no vencido, no reclamado) y al
--      dueño. Un lease vencido/perdedor no escribe días, no marca active ni
--      failed, y nunca sobreescribe un plan ya activo o con días escritos.
--
--   6. `p_lease_seconds` tenía suelo (30s) pero no techo: un cliente podía
--      arrendar años. Ahora también tiene techo (1h).
--
--   7/8. El recuento de reintentos del primer tramo se mueve al servidor
--      (`fail_generation_chunk`), dentro de la misma transacción: una consulta
--      de conteo que falla ya no se lee como "cero reintentos" porque no hay
--      consulta que pueda fallar a medias.
--
--   9. Revocación forward-only de los grants residuales sobre `prayer_plans`:
--      INSERT/DELETE dejan de estar abiertos al cliente (crear un plan pasa
--      solo por `reserve_generation`), y UPDATE queda restringido a las dos
--      columnas que el cliente edita de verdad (`title`, `visibility`). El
--      estado (`status`/`generation_error`) solo lo mueven las RPC de aquí.

-- ---------------------------------------------------------------------------
-- 1/3. reserve_generation — lock primero, idempotencia por dueño, shares atómicos
-- ---------------------------------------------------------------------------

drop function if exists public.reserve_generation(uuid, text, smallint, uuid, text, jsonb);

create function public.reserve_generation(
  p_request_id uuid,
  p_scope text,
  p_duration_days smallint,
  p_group_id uuid default null,
  p_visibility text default 'private',
  p_source_prompt jsonb default null,
  p_circle_ids uuid[] default null
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
  v_circle uuid;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_scope not in ('personal', 'circle') then
    raise exception 'reserve_generation: unknown scope %', p_scope;
  end if;

  -- Serializa las reservas de ESTE usuario ANTES de mirar nada: así la
  -- idempotencia y el conteo de cuota no pueden correr.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  -- Idempotencia DENTRO del lock y acotada al dueño: un caller nunca lee el
  -- plan ajeno adivinando un request_id.
  select * into v_existing
    from public.generation_ledger
   where request_id = p_request_id
     and user_id = v_user
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

  -- Un request_id que YA usó otro usuario: rechazo limpio, no un UNIQUE
  -- violation convertido en 500.
  if exists (
    select 1 from public.generation_ledger where request_id = p_request_id
  ) then
    return query
      select false, 'request_id_conflict', null::uuid, null::uuid, 0, v_limit, false;
    return;
  end if;

  -- Revalidación server-side de la duración: nunca se fía del cliente.
  if p_duration_days < 3 or p_duration_days > 30 then
    return query
      select false, 'invalid_duration', null::uuid, null::uuid, 0, v_limit, false;
    return;
  end if;

  -- Un plan de círculo: el dueño debe administrarlo y no puede haber ya un
  -- plan activo en él.
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

  -- Validar los círculos a compartir ANTES de gastar cuota: un id inválido
  -- revierte la reserva entera (sin plan, sin fila de ledger).
  if p_scope = 'personal' and p_circle_ids is not null then
    foreach v_circle in array p_circle_ids loop
      if v_circle is null or not public.is_group_member(v_circle) then
        return query
          select false, 'invalid_circles', null::uuid, null::uuid, 0, v_limit, false;
        return;
      end if;
    end loop;
  end if;

  select count(*) into v_used
    from public.generation_ledger
   where user_id = v_user
     and scope in ('personal', 'circle');

  if v_used >= v_limit then
    return query
      select false, 'quota_exhausted', null::uuid, null::uuid, v_used, v_limit, false;
    return;
  end if;

  -- Plan + reserva + shares nacen en la MISMA transacción: no hay ventana entre
  -- "consumí la cuota" y "existe el plan", ni entre "existe el plan" y "está
  -- compartido con los círculos elegidos".
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

  if p_scope = 'personal' and p_circle_ids is not null then
    insert into public.plan_shares (plan_id, group_id, created_by)
    select v_plan.id, c, v_user from unnest(p_circle_ids) c;
  end if;

  return query
    select true, 'ok', v_plan.id, v_reservation_id, v_used + 1, v_limit, true;
end;
$$;

revoke execute on function public.reserve_generation(uuid, text, smallint, uuid, text, jsonb, uuid[])
  from public;
grant execute on function public.reserve_generation(uuid, text, smallint, uuid, text, jsonb, uuid[])
  to authenticated;

-- ---------------------------------------------------------------------------
-- 1/6. claim_generation_chunk — columnas explícitas + techo de lease
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
  v_duration smallint;
  v_written integer;
  v_from smallint;
  v_to smallint;
  v_settled_from smallint;
  v_settled_to smallint;
  v_lease public.plan_generation_leases;
  v_lease_id uuid;
  -- Suelo (30s: un lease por debajo de eso no da tiempo a resolver) y techo
  -- (1h: el cliente no puede arrendar años y congelar el plan).
  v_seconds integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 3600);
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

  -- Idempotencia: este request ya generó su tramo (y quedó resuelto). Columnas
  -- explícitas: un `SELECT INTO record` sin lista de columnas no asigna
  -- estructura al record y revienta al leer `from_day`.
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
-- 5. settle_generation_chunk — con fence de lease vigente
-- ---------------------------------------------------------------------------

create or replace function public.settle_generation_chunk(
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

  -- El fence: solo un lease VIGENTE (no vencido, no reclamado) se resuelve. Un
  -- lease expirado o ya suelto devuelve false, no escribe nada.
  select * into v_lease
    from public.plan_generation_leases
   where lease_id = p_lease_id
     and leased_until > now();
  if not found then
    -- Ya resuelto, o el lease expiró y fue reclamado por otra invocación:
    -- un reintento idempotente, no un fallo.
    return false;
  end if;

  if v_lease.claimed_by <> v_user then
    raise exception 'settle_generation_chunk: not the lease holder';
  end if;

  select p.duration_days into v_duration
    from public.prayer_plans p
   where p.id = v_lease.plan_id;

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

-- ---------------------------------------------------------------------------
-- 5. complete_generation_chunk — persistencia fenceada del tramo ganador
-- ---------------------------------------------------------------------------

create function public.complete_generation_chunk(
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
-- 5/7/8. fail_generation_chunk — fallo fenceado, con reintentos contados en
--        la misma transacción
-- ---------------------------------------------------------------------------

create function public.fail_generation_chunk(
  p_lease_id uuid,
  p_error text
)
returns table (ok boolean, reason text, plan_failed boolean, retry boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_lease public.plan_generation_leases;
  v_failures integer;
  v_marked boolean := false;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  -- El fence: un lease vencido o reclamado no marca failed ni corrompe el plan.
  select * into v_lease
    from public.plan_generation_leases
   where lease_id = p_lease_id
     and leased_until > now();
  if not found then
    return query select false, 'lease_lost', false, false;
    return;
  end if;

  if v_lease.claimed_by <> v_user then
    raise exception 'fail_generation_chunk: not the lease holder';
  end if;

  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, duration_days,
    from_day, to_day, status, error
  )
  select v_lease.request_id, v_user, 'continuation', v_lease.plan_id,
         (select duration_days from public.prayer_plans where id = v_lease.plan_id),
         v_lease.from_day, v_lease.to_day, 'failed', p_error;

  -- Solo el primer tramo puede fallar el plan entero; los tramos posteriores
  -- dejan los días que ya sirven.
  if v_lease.from_day = 1 then
    if p_error = 'refused' then
      -- Una negativa del modelo no cambia al reintentar.
      v_marked := true;
    else
      -- El recuento se hace AQUÍ, dentro de la misma transacción: no hay una
      -- consulta de conteo que pueda fallar y leerse como "cero".
      select count(*) into v_failures
        from public.generation_ledger
       where plan_id = v_lease.plan_id
         and scope = 'continuation'
         and from_day = 1
         and status = 'failed';
      if v_failures >= 3 then
        v_marked := true;
      end if;
    end if;
  end if;

  if v_marked then
    -- La reja final: nunca sobreescribir un plan activo ni uno con días.
    update public.prayer_plans
       set status = 'failed', generation_error = p_error
     where id = v_lease.plan_id
       and status = 'generating'
       and not exists (
         select 1 from public.prayer_plan_days d where d.plan_id = v_lease.plan_id
       );

    v_marked := found;
  end if;

  delete from public.plan_generation_leases where lease_id = p_lease_id;

  return query select true, 'ok',
                      v_marked,
                      (v_lease.from_day = 1 and not v_marked and p_error <> 'refused');
end;
$$;

revoke execute on function public.fail_generation_chunk(uuid, text)
  from public;
grant execute on function public.fail_generation_chunk(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Cerrar el bypass de grants sobre prayer_plans
--
-- Inventario de writers legítimos con rol `authenticated` (auditado en
-- `core/plans/queries.ts`, `core/plans/sharing.ts` y la Edge Function):
--   * `title`  — `useRenamePlan`
--   * `visibility` — `useSetPlanPublic`
--   * `status`/`generation_error` — ahora solo las RPC de arriba
--     (`complete_generation_chunk`, `fail_generation_chunk`).
--   * INSERT — solo `reserve_generation` (security definer).
--   * DELETE — nadie legítimo (la compensación "borrar el plan si el share
--     falla" se elimina con el hallazgo 4).
--
-- Así que el rol cliente queda sin INSERT/DELETE y con UPDATE solo sobre las
-- dos columnas que edita de verdad; crear/alterar planes salta el bypass y pasa
-- obligatoriamente por la reserva.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.prayer_plans from authenticated;

grant update (title, visibility) on public.prayer_plans to authenticated;
