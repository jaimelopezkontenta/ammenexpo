-- Ammen — C0: recuperación de una generación sin días (forward-only).
--
-- No se edita v5: este reemplazo conserva su serialización por plan y añade:
--   * un heartbeat cuando un worker reclama o reclama de nuevo un tramo;
--   * un rechazo explícito si el request_id de un lease pertenece a otro plan.
--
-- El segundo advisory lock serializa también dos claims de planes distintos
-- que llevan el mismo request_id, cerrando la carrera contra el UNIQUE global
-- de plan_generation_leases.request_id.

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

  -- Keep v5's plan serialization and add a request lock for the UNIQUE key
  -- shared by all plans. The order is stable for every claim: plan, request.
  perform pg_advisory_xact_lock(hashtextextended(p_plan_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

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

  -- Same plan + live lease is an idempotent retry.
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

  -- A lease from another plan owns this globally-unique request id. Return a
  -- normal reason rather than attempting an INSERT that raises UNIQUE. This
  -- includes an expired lease: its UNIQUE constraint would reject the insert
  -- too, and it may only be reclaimed by its own plan.
  if exists (
    select 1 from public.plan_generation_leases l
     where l.request_id = p_request_id
       and l.plan_id <> p_plan_id
  ) then
    return query select 'request_id_conflict', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
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

  -- A claim is work in flight too. In particular this starts the recovery
  -- clock before the first day exists, when plan_progress intentionally has no
  -- row because of its INNER JOIN.
  update public.prayer_plans
     set generation_heartbeat_at = now()
   where id = p_plan_id;

  return query select 'claimed', v_from, v_to, v_lease_id,
                      v_written::smallint, v_duration;
end;
$$;

revoke execute on function public.claim_generation_chunk(uuid, uuid, integer)
  from public;
grant execute on function public.claim_generation_chunk(uuid, uuid, integer)
  to authenticated;
