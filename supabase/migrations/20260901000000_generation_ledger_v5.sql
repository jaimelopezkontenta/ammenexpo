-- Ammen — hardening final del ledger IA (v5, forward-only).
--
-- Resuelve los 8 hallazgos del REJECT v4:
--
--   1. `isStuckGenerating`: progress null/undefined → false (aún cargando).
--      generation_heartbeat_at dedicado para que rename/visibility no reseteen.
--   2. Columna `generation_heartbeat_at` en prayer_plans, actualizada por
--      `complete_generation_chunk`. El cliente ya no lee `updated_at`.
--   3. CreateAttemptKey: limpiar tras errores definitivos (400/402/403/409),
--      conservar en red/timeout. Si un retry de alta encuentra reserva/plan
--      existente tras timeout, el servidor lo devuelve honestamente (ya
--      funcionaba — la idempotencia del claim ya lo reanuda).
--   4. Continue attempt key estable por plan ante timeout/retry — no UUID por
--      tap (arreglado en TypeScript, no en SQL).
--   5. Serializar claim/complete/settle/fail con el MISMO advisory lock por
--      plan, adquirido ANTES de la re-lectura del lease. complete/settle/fail
--      leen el lease DOS veces (antes y después del lock) para cerrar el gap
--      con reclaim. El harness multi-conexión se añade.
--   6. `already` por request_id filtra plan_id + user_id/ownership en AMBAS
--      vías (ledger post-settle y lease en vuelo).
--   7. Worker viejo no liquida/escribe tras reclaim: complete/settle/fail
--      verifican lease_id vigente BAJO LOCK y borran exactamente una fila, o
--      fallan sin transición.
--   8. Mantener revocación de prayer_plan_days (v4) y todos los gates previos.
--
-- Solo migraciones forward-only nuevas. No toca flags/push scheduler/pagos
-- ni semántica de bloqueo. JWT/RLS se conservan.

-- ---------------------------------------------------------------------------
-- 2. Columna dedicada de heartbeat de generación
-- ---------------------------------------------------------------------------

alter table public.prayer_plans
  add column if not exists generation_heartbeat_at timestamptz;

comment on column public.prayer_plans.generation_heartbeat_at is
  'Latido de generación: cada tramo completado lo refresca. Independiente de
   updated_at (rename/visibility), para que el detector de atascos no se
   resetee por acciones que no son de generación.';

-- ---------------------------------------------------------------------------
-- claim_generation_chunk — idempotencia filtrada por plan_id + user_id
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
  v_seconds integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 3600);
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  -- Hallazgo 5: adquirir el advisory lock ANTES de leer status, no_reservation
  -- e idempotencia. Así claim y fail/complete/settle sobre el mismo plan se
  -- serializan desde el primer byte: un fail que marca `failed` no puede
  -- intercalarse con un claim que ya leyó `generating` (y viceversa).
  perform pg_advisory_xact_lock(hashtextextended(p_plan_id::text, 0));

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

  if v_status not in ('generating', 'active') then
    return query select 'not_generatable', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

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

  -- Idempotencia post-settle: este request ya generó su tramo y quedó resuelto.
  -- Filtra plan_id + user_id + scope para que un request_id ajeno no colisione
  -- y devuelva `already` sobre un plan distinto.
  select l.from_day, l.to_day into v_settled_from, v_settled_to
    from public.generation_ledger l
   where l.request_id = p_request_id
     and l.plan_id = p_plan_id
     and l.user_id = v_user
     and l.scope = 'continuation';
  if found then
    return query select 'already', v_settled_from, v_settled_to,
                        null::uuid,
                        (select count(*)::smallint from public.prayer_plan_days d
                          where d.plan_id = p_plan_id),
                        v_duration;
    return;
  end if;

  -- Idempotencia en vuelo: SOLO un lease VIGENTE del MISMO plan devuelve
  -- `already`. Un lease vencido o de OTRO plan con el mismo request_id no
  -- bloquea; un lease vencido cae al reclaim.
  select * into v_lease
    from public.plan_generation_leases
   where request_id = p_request_id
     and plan_id = p_plan_id
     and leased_until > now();
  if found then
    return query select 'already', v_lease.from_day, v_lease.to_day,
                        v_lease.lease_id,
                        (select count(*)::smallint from public.prayer_plan_days d
                          where d.plan_id = p_plan_id),
                        v_duration;
    return;
  end if;

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
-- complete_generation_chunk — lock + re-read + generation_heartbeat_at
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
  v_plan_id uuid;
  v_lease public.plan_generation_leases;
  v_duration smallint;
  v_written integer;
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  -- Paso 1: resolver el plan_id desde el lease_id. Si el lease ya no existe
  -- (reclaim, settle previo, expiración), salimos sin tocar nada.
  select plan_id into v_plan_id
    from public.plan_generation_leases
   where lease_id = p_lease_id;
  if not found then
    return query select false, 'lease_lost', false;
    return;
  end if;

  -- Paso 2: adquirir el MISMO advisory lock que claim usa para este plan, así
  -- claim y complete no se intercalan. Esto cierra el gap entre el primer
  -- vistazo al lease y la escritura de días.
  perform pg_advisory_xact_lock(hashtextextended(v_plan_id::text, 0));

  -- Paso 3: re-leer el lease BAJO LOCK. Si ya no es el mismo lease_id (fue
  -- reclamado) o venció, no escribimos nada. Así un worker viejo nunca escribe
  -- días ni ledger tras un reclaim.
  select * into v_lease
    from public.plan_generation_leases
   where plan_id = v_plan_id
     and lease_id = p_lease_id
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

  -- Heartbeat dedicado de generación (hallazgo 2). Independiente de
  -- `updated_at` (rename/visibility), para que el detector de atascos no
  -- se resetee por acciones que no son de generación.
  update public.prayer_plans
     set generation_heartbeat_at = now()
   where id = v_lease.plan_id;

  if v_lease.from_day = 1 then
    update public.prayer_plans
       set title = coalesce(nullif(btrim(p_title), ''), title),
           theme = p_theme,
           source_prompt = coalesce(p_source_prompt, source_prompt),
           status = 'active'
     where id = v_lease.plan_id
       and status = 'generating';
  elsif v_lease.to_day >= v_duration then
    update public.prayer_plans
       set status = 'active'
     where id = v_lease.plan_id
       and status = 'generating';
  end if;

  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, duration_days,
    from_day, to_day, status
  )
  values (
    v_lease.request_id, v_user, 'continuation', v_lease.plan_id, v_duration,
    v_lease.from_day, v_lease.to_day, 'completed'
  );

  -- Borrar exactamente UNA fila por lease_id. Si ya fue borrada (reclaim),
  -- `v_deleted` será 0 — no fallamos, pero tampoco hicimos transición alguna
  -- porque el otro worker ya tomó el control.
  delete from public.plan_generation_leases where lease_id = p_lease_id;
  get diagnostics v_deleted = row_count;

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
-- settle_generation_chunk — lock + re-read + borrado exacto
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
  v_plan_id uuid;
  v_lease public.plan_generation_leases;
  v_duration smallint;
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_outcome not in ('completed', 'failed') then
    raise exception 'settle_generation_chunk: unknown outcome %', p_outcome;
  end if;

  select plan_id into v_plan_id
    from public.plan_generation_leases
   where lease_id = p_lease_id;
  if not found then
    return false;
  end if;

  -- Mismo advisory lock que claim/complete.
  perform pg_advisory_xact_lock(hashtextextended(v_plan_id::text, 0));

  -- Re-leer bajo lock: si el lease ya no es el mismo (reclaim) o venció → no-op.
  select * into v_lease
    from public.plan_generation_leases
   where plan_id = v_plan_id
     and lease_id = p_lease_id
     and leased_until > now();
  if not found then
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

  -- Borrar exactamente UNA fila por lease_id; si ya fue reclamada, 0 filas
  -- borradas — no es fallo, pero tampoco se hace doble ledger.
  delete from public.plan_generation_leases where lease_id = p_lease_id;
  get diagnostics v_deleted = row_count;

  return true;
end;
$$;

revoke execute on function public.settle_generation_chunk(uuid, text, text)
  from public;
grant execute on function public.settle_generation_chunk(uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- fail_generation_chunk — lock + re-read + borrado exacto
-- ---------------------------------------------------------------------------

create or replace function public.fail_generation_chunk(
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
  v_plan_id uuid;
  v_lease public.plan_generation_leases;
  v_failures integer;
  v_marked boolean := false;
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select plan_id into v_plan_id
    from public.plan_generation_leases
   where lease_id = p_lease_id;
  if not found then
    return query select false, 'lease_lost', false, false;
    return;
  end if;

  -- Mismo advisory lock que claim/complete/settle.
  perform pg_advisory_xact_lock(hashtextextended(v_plan_id::text, 0));

  -- Re-leer bajo lock: si el lease ya no es el mismo o venció → no-op.
  select * into v_lease
    from public.plan_generation_leases
   where plan_id = v_plan_id
     and lease_id = p_lease_id
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

  if v_lease.from_day = 1 then
    if p_error = 'refused' then
      v_marked := true;
    else
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
    update public.prayer_plans
       set status = 'failed', generation_error = p_error
     where id = v_lease.plan_id
       and status = 'generating'
       and not exists (
         select 1 from public.prayer_plan_days d where d.plan_id = v_lease.plan_id
       );

    v_marked := found;
  end if;

  -- Borrar exactamente UNA fila por lease_id.
  delete from public.plan_generation_leases where lease_id = p_lease_id;
  get diagnostics v_deleted = row_count;

  return query select true, 'ok',
                      v_marked,
                      (v_lease.from_day = 1 and not v_marked and p_error <> 'refused');
end;
$$;

revoke execute on function public.fail_generation_chunk(uuid, text)
  from public;
grant execute on function public.fail_generation_chunk(uuid, text)
  to authenticated;