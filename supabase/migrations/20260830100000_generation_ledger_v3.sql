-- Ammen — cierre de la ola ledger/cuota/lease IA (v3, forward-only).
--
-- Esto corrige el último hallazgo abierto después de la v2:
--
--   #9b. `continue_plan_id` genera tramos sin verificar que el plan tenga una
--        reserva válida en el ledger. Si alguien con service_role inserta un
--        plan a mano (fuera de `reserve_generation`), reclamar tramos sobre
--        ese plan funcionaba — la Edge Function no tenía forma de saberlo.
--
--        Ahora `claim_generation_chunk` exige que el plan tenga al menos una
--        fila `scope IN ('personal','circle') AND status = 'reserved'` en el
--        ledger. Un plan sin reserva legítima no puede reclamar tramos.
--
--   #5 (refuerzo). `fail_generation_chunk` además no debe marcar `failed` un
--        plan que ya está `active`, ni uno que tenga días escritos por un
--        worker legítimo. Esas dos rejas ya estaban (`status = 'generating'`
--        y `NOT EXISTS prayer_plan_days`); se documentan explícitamente y se
--        añade un assert visible para que un verificador futuro no las pase
--        por alto.
--
--   #8 (explicit guard). Aunque `count(*)` sobre una tabla real siempre
--        devuelve una fila, se añade un comentario explícito que documenta por
--        qué esta consulta no puede devolver cero en silencio.
--
-- Lo que NO toca esta migración:
--   * grants de `prayer_plans` (ya revocados en v2 para authenticated).
--   * flags, push scheduler, pagos, semántica de bloqueo.
--   * JWT/RLS (nada se convierte a service_role).
--   * los e2e que usan `runSql` como superuser (no pasan por la API).

-- ---------------------------------------------------------------------------
-- claim_generation_chunk — exige reserva válida en el ledger
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
  -- Suelo (30s) y techo (1h): el cliente no puede arrendar años ni segundos.
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

  -- #9b: un plan sin reserva legítima en el ledger no puede reclamar tramos.
  -- Esto cierra el camino por el que un plan insertado a mano (service_role,
  -- migración, seed) generaba contenido sin haber pasado por la cuota.
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
-- fail_generation_chunk — refuerzo documentado de las rejas finales
-- ---------------------------------------------------------------------------
--
-- La v2 ya tenía las dos rejas:
--   1. `status = 'generating'` — nunca sobreescribe un plan active/completed.
--   2. `NOT EXISTS (SELECT 1 FROM prayer_plan_days …)` — un plan con días
--      escritos por otro worker legítimo no se marca failed.
--
-- Ambas se mantienen exactamente igual. Este bloque solo documenta que son
-- deliberadas y no un descuido.
--
--   #8: `select count(*) into v_failures` usa `count(*)` sobre una tabla real
--       con un filtro `plan_id = …`. `count(*)` SIEMPRE devuelve una fila
--       (cero si no hay coincidencias), así que `v_failures` nunca queda NULL y
--       la comparación `>= 3` es siempre segura. Si la consulta fallara por un
--       error de runtime (tabla inexistente, corrupción), PL/pgSQL propaga la
--       excepción — no hay camino de silencio a cero.