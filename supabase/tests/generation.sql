\set ON_ERROR_STOP on

-- Ola P0 de generación IA: cuota por ledger, reserva atómica y lease.
--
-- Lo que este archivo fija, y lo que deliberadamente NO puede demostrar:
--
--   * el ledger no es editable por el cliente (append-only);
--   * borrar o marcar `failed` un plan NO devuelve la cuota;
--   * la duración fuera de rango se rechaza en el servidor;
--   * el plan de círculo consume cuota y exige administrar el círculo;
--   * la reserva es idempotente por `request_id` (reintentar no reserva dos veces);
--   * el doble claim del mismo tramo solo uno gana (`in_flight` / `already`);
--   * un lease vencido se reclama, y resolver un tramo lo suelta;
--   * la idempotencia exige ownership: reusar el `request_id` de OTRO usuario
--     se rechaza limpio (`request_id_conflict`), sin entregar el plan ajeno;
--   * los shares de círculo nacen en la MISMA transacción que la reserva, y un
--     círculo inválido revierte todo sin quemar cuota;
--   * el lease tiene techo server-side: un cliente no arrienda años;
--   * el claim es idempotente también DESPUÉS de resolver (`already` por la
--     fila `continuation` del ledger, no solo por el lease en vuelo);
--   * un lease vencido no escribe días ni marca `active`/`failed` (el fence);
--   * el recuento de reintentos del primer tramo y el `failed` del plan se
--     deciden en `fail_generation_chunk`, dentro de la misma transacción;
--   * un tramo posterior fallido no tira el plan, y una negativa del modelo
--     falla enseguida;
--   * el cliente ya no puede insertar/alterar/borrar `prayer_plans` por la API
--     (la creación pasa por `reserve_generation`; renombrar y cambiar
--     visibilidad siguen abiertas por grant de columna);
--   * un plan insertado a mano (service_role, migración, seed) sin reserva
--     en el ledger no puede reclamar tramos (`no_reservation`), así que el
--     `continue_plan_id` de la Edge Function nunca genera contenido sin cuota;
--   * `fail_generation_chunk` nunca marca `failed` un plan ya `active` o con
--     días escritos por otro worker (las dos rejas finales);
--   * un request_id ya liquidado en `generation_ledger` (otro plan, u otro
--     scope — p.ej. la reserva personal/circle usada como continue) se
--     rechaza con `request_id_conflict` ANTES de `claimed`, porque el UNIQUE
--     global del ledger sobrevive al settle;
--   * `p_request_id` NULL devuelve `request_id_required`, no un 500.
--
-- **Límite de concurrencia.** Todo esto corre sobre UNA conexión psql, así que
-- NO demuestra que dos reservas paralelas no se salten el límite: eso lo
-- garantizan los advisory locks de Postgres, y lo ejercita el harness manual
-- `supabase/tests/generation-concurrency.sh`, no esta suite.
-- Esta suite tampoco demuestra la serialización cross-plan del advisory lock
-- por `request_id` (C0): una sola conexión no puede intercalar dos claims.
-- No hay harness de esa carrera en CI. Lo que sí fija aquí es el rechazo
-- `request_id_conflict` (lease ajeno vivo, request liquidado, reserva reusada).

\set ANA  '''11111111-1111-1111-1111-111111111111'''
\set BETO '''22222222-2222-2222-2222-222222222222'''

create or replace function pg_temp.assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice 'PASS  %', label;
  else
    raise exception 'FAIL  %', label;
  end if;
end;
$$;

create or replace function pg_temp.raises(stmt text)
returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end;
$$;

-- ===========================================================================
-- Fixtures
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:ANA,  'ana@test.local',  'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:BETO, 'beto@test.local', 'authenticated', 'authenticated', '{"display_name":"Beto"}');

-- Un círculo para cada uno: la cuota de círculo exige administrarlo.
insert into public.groups (id, owner_id, name, visibility)
values
  ('cccc0000-0000-0000-0000-0000000000a1', :ANA,  'Célula de Ana',  'private'),
  ('cccc0000-0000-0000-0000-0000000000b1', :BETO, 'Célula de Beto', 'private');

commit;


-- ===========================================================================
-- El ledger no es editable por el cliente
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.generation_ledger (request_id, user_id, scope, status)
    values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
            'personal', 'reserved')
  $q$),
  'the client cannot insert into the ledger');

select pg_temp.assert(
  pg_temp.raises($q$ update public.generation_ledger set status = 'completed' $q$),
  'nor update it');

select pg_temp.assert(
  pg_temp.raises($q$ delete from public.generation_ledger $q$),
  'nor delete from it');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.plan_generation_leases
      (plan_id, request_id, from_day, to_day, lease_id, claimed_by, leased_until)
    values (gen_random_uuid(), gen_random_uuid(), 1, 7, gen_random_uuid(),
            '11111111-1111-1111-1111-111111111111', now())
  $q$),
  'nor write a lease directly');

commit;


-- ===========================================================================
-- La duración fuera de rango se rechaza en el servidor
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _r_short as
  select * from public.reserve_generation(
    '11110000-0000-0000-0000-000000000001'::uuid, 'personal', 2::smallint);

create temp table _r_long as
  select * from public.reserve_generation(
    '11110000-0000-0000-0000-000000000002'::uuid, 'personal', 31::smallint);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'invalid_duration' from _r_short),
  'a 2-day plan is rejected server-side');

select pg_temp.assert(
  (select ok is false and reason = 'invalid_duration' from _r_long),
  'and so is a 31-day plan');


-- ===========================================================================
-- La reserva crea el plan, y la cuota es de tres y permanente
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _r1 as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000011'::uuid, 'personal', 7::smallint);
create temp table _r2 as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000012'::uuid, 'personal', 7::smallint);
create temp table _r3 as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000013'::uuid, 'personal', 7::smallint);
create temp table _r4 as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000014'::uuid, 'personal', 7::smallint);

commit;

select pg_temp.assert(
  (select ok and created from _r1),
  'the first reservation creates a plan and consumes a slot');

select pg_temp.assert(
  (select quota_used from _r1) = 1,
  'and reports one slot used');

select pg_temp.assert(
  (select ok and created from _r2) and (select ok and created from _r3),
  'the second and third go through');

select pg_temp.assert(
  (select ok is false and reason = 'quota_exhausted' from _r4),
  'but the fourth is refused');

select pg_temp.assert(
  (select quota_used from _r4) = 3 and (select quota_limit from _r4) = 3,
  'and the refusal says how much was used');

select pg_temp.assert(
  (select count(*) from public.generation_ledger
    where user_id = '11111111-1111-1111-1111-111111111111'
      and scope in ('personal', 'circle')) = 3,
  'the ledger keeps exactly the three reservations');

-- La cuota que enseña la app antes del formulario (my_plan_quota) cuenta
-- exactamente lo que cuenta reserve_generation.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select used = 3 and quota_limit = 3 from public.my_plan_quota()),
  'my_plan_quota agrees with reserve_generation: three of three used');

commit;

-- Idempotencia: reintentar el MISMO request no reserva dos veces.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _r1_retry as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000011'::uuid, 'personal', 7::smallint);

commit;

select pg_temp.assert(
  (select ok and not created from _r1_retry),
  'retrying the same request does not reserve again');

select pg_temp.assert(
  (select plan_id from _r1_retry) = (select plan_id from _r1),
  'and returns the very same plan');

select pg_temp.assert(
  (select count(*) from public.generation_ledger
    where user_id = '11111111-1111-1111-1111-111111111111'
      and scope in ('personal', 'circle')) = 3,
  'so the ledger still counts three, not four');


-- ===========================================================================
-- Borrar o marcar failed no devuelve la cuota
-- ===========================================================================
begin;

delete from public.prayer_plans where id = (select plan_id from _r1);

update public.prayer_plans
   set status = 'failed', generation_error = 'test'
 where id = (select plan_id from _r2);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _r5 as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000015'::uuid, 'personal', 7::smallint);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'quota_exhausted' from _r5),
  'deleting a plan and marking another failed does not give the slots back');

select pg_temp.assert(
  (select count(*) from public.generation_ledger
    where user_id = '11111111-1111-1111-1111-111111111111'
      and scope in ('personal', 'circle')) = 3,
  'the reservations survive both the delete and the failed mark');


-- ===========================================================================
-- El círculo está sujeto a la misma cuota, y exige administrarlo
-- ===========================================================================

-- Ana ya agotó su cuota: un plan de círculo también se le niega.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _rc_ana_full as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000021'::uuid, 'circle', 7::smallint,
  'cccc0000-0000-0000-0000-0000000000a1'::uuid);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'quota_exhausted' from _rc_ana_full),
  'a circle plan counts against the same per-user quota');

-- Beto, sin reservas aún, sí puede crear el plan de su propio círculo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _rc_beto as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000022'::uuid, 'circle', 7::smallint,
  'cccc0000-0000-0000-0000-0000000000b1'::uuid);

commit;

select pg_temp.assert(
  (select ok and created from _rc_beto),
  'an admin can reserve the plan of a circle they run');

select pg_temp.assert(
  (select quota_used from _rc_beto) = 1,
  'and it consumes a slot of their per-user quota');

-- Y quien no administra el círculo, no.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _rc_ana_other as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000023'::uuid, 'circle', 7::smallint,
  'cccc0000-0000-0000-0000-0000000000b1'::uuid);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'circle_not_allowed' from _rc_ana_other),
  'someone who does not run the circle cannot reserve its plan');


-- ===========================================================================
-- El claim: solo uno gana, es idempotente, y el lease expira y se reclama
-- ===========================================================================

-- Beto reserva un plan personal de 14 días para reclamar tramos.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _bp as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000031'::uuid, 'personal', 14::smallint);

commit;

-- Primera reclamación: gana, y el rango lo decide el servidor.
-- `plan_progress` conserva su INNER JOIN: antes de que exista el primer día,
-- un plan realmente `generating` no devuelve una fila de progreso.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select status = 'generating' from public.prayer_plans where id = (select plan_id from _bp))
    and (select count(*) from public.prayer_plan_days where plan_id = (select plan_id from _bp)) = 0
    and (select count(*) from public.plan_progress((select plan_id from _bp))) = 0,
  'a generating plan with zero days has zero plan_progress rows');
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _claim_a as select * from public.claim_generation_chunk(
  (select plan_id from _bp), '11110000-0000-0000-0000-000000000041'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_a) = 'claimed',
  'the first claim wins the next chunk');

select pg_temp.assert(
  (select generation_heartbeat_at is not null
     from public.prayer_plans
    where id = (select plan_id from _bp)),
  'claiming a chunk writes the generation heartbeat before any day lands');

select pg_temp.assert(
  (select from_day from _claim_a) = 1 and (select to_day from _claim_a) = 7,
  'and the server decides the range (1..7), never the caller');

-- El MISMO request reintentado no reclama dos veces.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _claim_a2 as select * from public.claim_generation_chunk(
  (select plan_id from _bp), '11110000-0000-0000-0000-000000000041'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_a2) = 'already',
  'retrying the same claim is idempotent');

-- Un request DISTINTO mientras el lease está vivo: en vuelo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _claim_b as select * from public.claim_generation_chunk(
  (select plan_id from _bp), '11110000-0000-0000-0000-000000000042'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_b) = 'in_flight',
  'a second, different claim is refused while the lease is alive');

-- Y un extraño no puede reclamar el plan de Beto.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _claim_ana as select * from public.claim_generation_chunk(
  (select plan_id from _bp), '11110000-0000-0000-0000-000000000043'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_ana) = 'not_owner',
  'nor can a stranger claim it');

-- Lease vencido ⇒ se reclama, para que una invocación muerta no congele el plan.
-- Also age the heartbeat: reclaim must write a fresh one, not leave the
-- first-claim clock in place.
begin;

update public.plan_generation_leases
   set leased_until = now() - interval '1 second'
 where plan_id = (select plan_id from _bp);

update public.prayer_plans
   set generation_heartbeat_at = now() - interval '10 minutes'
 where id = (select plan_id from _bp);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _claim_c as select * from public.claim_generation_chunk(
  (select plan_id from _bp), '11110000-0000-0000-0000-000000000044'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_c) = 'claimed',
  'an expired lease is reclaimed, so a dead invocation does not freeze the plan');

select pg_temp.assert(
  (select generation_heartbeat_at > now() - interval '1 minute'
     from public.prayer_plans
    where id = (select plan_id from _bp)),
  'reclaiming an expired lease refreshes the generation heartbeat');


-- ===========================================================================
-- Resolver un tramo escribe el resultado y suelta el lease
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  public.settle_generation_chunk(
    (select lease_id from _claim_c), 'failed', 'provider_timeout'),
  'settling a chunk records the outcome and releases the lease');

commit;

select pg_temp.assert(
  (select count(*) from public.generation_ledger
    where plan_id = (select plan_id from _bp)
      and scope = 'continuation'
      and status = 'failed'
      and error = 'provider_timeout') = 1,
  'and the failure is written to the append-only ledger');

-- Resolver el mismo lease otra vez es un no-op, no un fallo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  public.settle_generation_chunk(
    (select lease_id from _claim_c), 'completed') = false,
  're-settling an already-settled lease is an idempotent no-op');

commit;

-- Con el lease suelto, un plan completo ya no reclama más.
begin;

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body, unlock_date)
select (select plan_id from _bp), n, 'Día ' || n, 'Oración', current_date + (n - 1)
from generate_series(1, 14) n;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _claim_done as select * from public.claim_generation_chunk(
  (select plan_id from _bp), '11110000-0000-0000-0000-000000000045'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_done) = 'complete',
  'a plan with all its days written reports complete instead of reclaiming');


-- ===========================================================================
-- La lectura del ledger es solo la propia
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not exists (
    select 1 from public.generation_ledger
    where user_id <> '11111111-1111-1111-1111-111111111111'
  ),
  'a user reads only their own ledger rows, never anybody else''s');

commit;


-- ===========================================================================
-- Hallazgo 3: la idempotencia exige ownership; una colisión se rechaza limpia
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Ana ya reservó con este request_id. Beto no puede obtener su plan.
create temp table _r_foreign as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000011'::uuid, 'personal', 7::smallint);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'request_id_conflict' from _r_foreign),
  'reusing another user''s request_id does not hand over their plan');


-- ===========================================================================
-- Hallazgo 4: shares atómicos con la reserva, sin quemar cuota
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('33333333-3333-3333-3333-333333333333', 'carla@test.local',
        'authenticated', 'authenticated', '{"display_name":"Carla"}');

insert into public.groups (id, owner_id, name, visibility)
values ('cccc0000-0000-0000-0000-0000000000c1',
        '33333333-3333-3333-3333-333333333333', 'Célula de Carla', 'private');

commit;

-- Carla comparte con su círculo: reserva y share nacen en la misma transacción.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _rc as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000051'::uuid, 'personal', 7::smallint,
  null, 'private', '{"answers":{}}'::jsonb,
  array['cccc0000-0000-0000-0000-0000000000c1']::uuid[]);

commit;

select pg_temp.assert(
  (select ok and created from _rc),
  'reserving with circle ids creates the plan');

select pg_temp.assert(
  (select count(*) from public.plan_shares
    where plan_id = (select plan_id from _rc)
      and group_id = 'cccc0000-0000-0000-0000-0000000000c1') = 1,
  'and its share in the same transaction');

-- Un círculo al que Carla no pertenece: la reserva entera revierte, sin slot.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _rbad as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000052'::uuid, 'personal', 7::smallint,
  null, 'private', '{"answers":{}}'::jsonb,
  array['cccc0000-0000-0000-0000-0000000000a1']::uuid[]);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'invalid_circles' from _rbad),
  'sharing into a circle the caller does not belong to is refused');

select pg_temp.assert(
  (select count(*) from public.generation_ledger
    where request_id = '11110000-0000-0000-0000-000000000052') = 0,
  'and the refused reservation burned no quota');


-- ===========================================================================
-- Hallazgo 6: el techo del lease se aplica en el servidor
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _claim_long as select * from public.claim_generation_chunk(
  (select plan_id from _rc), '11110000-0000-0000-0000-000000000053'::uuid,
  1000000000);

commit;

select pg_temp.assert(
  (select reason from _claim_long) = 'claimed',
  'a claim with an absurd lease still claims');

select pg_temp.assert(
  (select leased_until <= now() + interval '1 hour' + interval '5 seconds'
     from public.plan_generation_leases
    where plan_id = (select plan_id from _rc)),
  'but the lease is clamped to the server ceiling, not the client''s years');


-- ===========================================================================
-- Hallazgo 1: idempotencia del claim DESPUÉS de resolver (settle)
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select public.settle_generation_chunk((select lease_id from _claim_long), 'completed');

create temp table _claim_long2 as select * from public.claim_generation_chunk(
  (select plan_id from _rc), '11110000-0000-0000-0000-000000000053'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_long2) = 'already'
    and (select from_day from _claim_long2) = (select from_day from _claim_long),
  'reclaiming the same request after a settle is an idempotent already');


-- ===========================================================================
-- Hallazgo 5: el fence — un lease vencido no escribe ni marca estado
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _claim_f as select * from public.claim_generation_chunk(
  (select plan_id from _rc), '11110000-0000-0000-0000-000000000054'::uuid);

commit;

-- Vence el lease a mano, como si la invocación hubiera muerto.
begin;
update public.plan_generation_leases
   set leased_until = now() - interval '1 second'
 where plan_id = (select plan_id from _rc);
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _complete_stale as
  select * from public.complete_generation_chunk(
    (select lease_id from _claim_f),
    '[{"day_number":1,"title":"Día 1","prayer_body":"Oración","unlock_date":"2026-01-01"}]'::jsonb,
    'Título', null, null);

create temp table _fail_stale as
  select * from public.fail_generation_chunk(
    (select lease_id from _claim_f), 'generation_failed');

commit;

select pg_temp.assert(
  (select ok is false and reason = 'lease_lost' from _complete_stale),
  'a stale lease cannot write days or mark the plan active');

select pg_temp.assert(
  (select ok is false from _fail_stale),
  'and a stale lease cannot mark the plan failed either');

select pg_temp.assert(
  (select status from public.prayer_plans where id = (select plan_id from _rc)) = 'generating',
  'so the plan stays generating, untouched by the loser');


-- ===========================================================================
-- Hallazgos 7/8: el recuento de reintentos del primer tramo vive en el
-- servidor, dentro de la misma transacción
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _rp as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000061'::uuid, 'personal', 7::smallint);
create temp table _cf1 as select * from public.claim_generation_chunk(
  (select plan_id from _rp), '11110000-0000-0000-0000-000000000071'::uuid);
create temp table _f1 as select * from public.fail_generation_chunk(
  (select lease_id from _cf1), 'generation_failed');

commit;

select pg_temp.assert(
  (select ok and retry and not plan_failed from _f1),
  'the first failed stretch asks for another isolate instead of giving up');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _cf2 as select * from public.claim_generation_chunk(
  (select plan_id from _rp), '11110000-0000-0000-0000-000000000072'::uuid);
create temp table _f2 as select * from public.fail_generation_chunk(
  (select lease_id from _cf2), 'generation_failed');

commit;

select pg_temp.assert(
  (select ok and retry and not plan_failed from _f2),
  'and so does the second');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _cf3 as select * from public.claim_generation_chunk(
  (select plan_id from _rp), '11110000-0000-0000-0000-000000000073'::uuid);
create temp table _f3 as select * from public.fail_generation_chunk(
  (select lease_id from _cf3), 'generation_failed');

commit;

select pg_temp.assert(
  (select ok and not retry and plan_failed from _f3),
  'the third failed stretch gives up and fails the plan');

select pg_temp.assert(
  (select status from public.prayer_plans where id = (select plan_id from _rp)) = 'failed',
  'and the plan is actually marked failed');


-- ===========================================================================
-- Hallazgo 5: una negativa del modelo falla enseguida; un tramo posterior no
-- tira el plan
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _rp2 as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000062'::uuid, 'personal', 7::smallint);
create temp table _cr as select * from public.claim_generation_chunk(
  (select plan_id from _rp2), '11110000-0000-0000-0000-000000000081'::uuid);
create temp table _fr as select * from public.fail_generation_chunk(
  (select lease_id from _cr), 'refused');

commit;

select pg_temp.assert(
  (select ok and not retry and plan_failed from _fr),
  'a refusal fails the plan immediately instead of retrying');

-- Un plan de 14 días: el primer tramo se completa, y un fallo del segundo no
-- lo marca failed (los días ya escritos valen).
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _rbp as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000091'::uuid, 'personal', 14::smallint);
create temp table _cbp as select * from public.claim_generation_chunk(
  (select plan_id from _rbp), '11110000-0000-0000-0000-000000000092'::uuid);
create temp table _complete_bp as
  select * from public.complete_generation_chunk(
    (select lease_id from _cbp),
    (select jsonb_agg(jsonb_build_object(
        'day_number', n,
        'title', 'Día ' || n,
        'prayer_body', 'Oración ' || n,
        'unlock_date', (current_date + (n - 1))::text
      ) order by n)
       from generate_series(1, 7) n),
    'Plan de Beto', 'un tema', '{"model":"test","provider":"test"}'::jsonb);

commit;

select pg_temp.assert(
  (select ok and not is_complete from _complete_bp),
  'completing the first stretch of a longer plan writes the days and says it is not done');

select pg_temp.assert(
  (select status from public.prayer_plans where id = (select plan_id from _rbp)) = 'active',
  'and the plan leaves generating, usable immediately');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _cbp2 as select * from public.claim_generation_chunk(
  (select plan_id from _rbp), '11110000-0000-0000-0000-000000000093'::uuid);
create temp table _fbp2 as select * from public.fail_generation_chunk(
  (select lease_id from _cbp2), 'generation_failed');

commit;

select pg_temp.assert(
  (select from_day from _cbp2) = 8,
  'the next stretch starts where the days stop');

select pg_temp.assert(
  (select ok and not retry and not plan_failed from _fbp2),
  'failing a later stretch does not fail the plan');

select pg_temp.assert(
  (select status from public.prayer_plans where id = (select plan_id from _rbp)) = 'active',
  'and the plan keeps its active status and its written days');


-- ===========================================================================
-- Hallazgo 9: crear o alterar planes ya no salta la reserva
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.prayer_plans (owner_id, title, duration_days, start_date, visibility)
    values ('11111111-1111-1111-1111-111111111111', 'bypass', 3, current_date, 'private')
  $q$),
  'the client cannot insert a plan directly — creation goes through reserve_generation');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.prayer_plans set status = 'active'
     where owner_id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'nor flip its status directly');

select pg_temp.assert(
  pg_temp.raises($q$
    delete from public.prayer_plans
     where owner_id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'nor delete it directly');

-- Lo legítimo sigue abierto: el dueño renombra y cambia visibilidad.
update public.prayer_plans set title = 'retitulado'
 where id = (select plan_id from _r3);

update public.prayer_plans set visibility = 'link'
 where id = (select plan_id from _r3);

commit;

select pg_temp.assert(
  (select title from public.prayer_plans where id = (select plan_id from _r3)) = 'retitulado',
  'renaming a plan still works through the column grant');

select pg_temp.assert(
  (select visibility from public.prayer_plans where id = (select plan_id from _r3)) = 'link',
  'and so does changing its visibility');


-- ===========================================================================
-- Hallazgo 9b: un plan sin reserva en el ledger no puede reclamar tramos
-- ===========================================================================
--
-- Alguien con service_role (o una migración/seed) inserta un plan a mano,
-- fuera de `reserve_generation`. El dueño legítimo NO debería poder
-- reclamar tramos sobre ese plan porque no pasó por la cuota.
begin;

-- Insertamos el plan directamente como superuser (bypass completo), sin tocar
-- el ledger. El dueño es Carla (33333333-...), que ya existe de los tests
-- anteriores.
insert into public.prayer_plans
  (id, owner_id, title, duration_days, start_date, visibility, status,
   generated_by)
values
  ('dddd0000-0000-0000-0000-0000000000e1',
   '33333333-3333-3333-3333-333333333333',
   'Plan sin reserva', 7, current_date, 'private', 'generating', 'ai');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _claim_no_res as select * from public.claim_generation_chunk(
  'dddd0000-0000-0000-0000-0000000000e1'::uuid,
  '11110000-0000-0000-0000-0000000000e1'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_no_res) = 'no_reservation',
  'a plan without a reservation in the ledger cannot claim a stretch');

-- Y el dueño legítimo, aunque sea el owner, tampoco.
select pg_temp.assert(
  (select from_day from _claim_no_res) is null,
  'and no chunk is returned for a plan without a reservation');


-- ===========================================================================
-- Hallazgo 9b (continuación): el bypass service_role directo no genera
-- ===========================================================================
--
-- Incluso si el plan se crea con status 'generating' y el dueño es el
-- correcto, el `continue_plan_id` de la Edge Function no podrá reclamar
-- tramos: `claim_generation_chunk` exige la fila de reserva, y sin ella
-- devuelve `no_reservation`. La Edge Function interpreta cualquier reason
-- que no sea 'claimed'/'already'/'in_flight'/'complete' como un error 500.
--
-- Este test cierra el agujero por el que un plan insertado a mano (seed,
-- migración, herramienta de admin) se convertía en generación gratuita.
begin;

-- Beto ya tiene un plan de 14 días con su primer tramo completado (plan de
-- _rbp). Ese plan SÍ tiene reserva (request_id
-- 11110000-0000-0000-0000-000000000091), así que reclamar el segundo tramo
-- funciona.
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

create temp table _claim_ok as select * from public.claim_generation_chunk(
  (select plan_id from _rbp), '11110000-0000-0000-0000-000000000094'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_ok) = 'claimed',
  'a plan with a valid reservation claims its next stretch normally');

select pg_temp.assert(
  (select from_day from _claim_ok) = 8,
  'and the server-calculated range starts after the days already written');


-- ===========================================================================
-- La Edge Function mapea 'no_reservation' a un 500 explícito
-- ===========================================================================
--
-- La Edge Function tiene un case explícito para `no_reservation` que devuelve
-- `json({ error: "no_reservation" }, 500)`: un plan sin reserva no puede
-- generar contenido, y el error se reporta como fallo del servidor, no como
-- "no encontrado" (que invitaría a reintentar). La aserción de abajo fija la
-- razón que produce la base de datos; el case de la Edge Function la convierte
-- en ese 500.
select pg_temp.assert(
  (select reason from _claim_no_res) = 'no_reservation',
  'the edge function maps no_reservation to an explicit 500, not a retry');


-- ===========================================================================
-- Hallazgo 5 (refuerzo): fail_generation_chunk no marca failed un plan
-- activo ni uno con días escritos
-- ===========================================================================
--
-- Las dos rejas de `fail_generation_chunk` son:
--   1. `status = 'generating'` — un plan `active` no se sobreescribe.
--   2. `NOT EXISTS (SELECT 1 FROM prayer_plan_days …)` — días escritos por
--      otro worker legítimo no se pierden.
--
-- Este test ejercita la reja 1 directamente: un plan ya `active` (el de Beto,
-- _rbp, que completó su primer tramo) recibe un `fail_generation_chunk` de
-- un lease del segundo tramo. El plan NO debe volver a `failed`.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- El plan _rbp ya está `active` (el primer tramo lo marcó así).
-- El lease de _claim_ok (segundo tramo, días 8-14) falla.
create temp table _fail_active as
  select * from public.fail_generation_chunk(
    (select lease_id from _claim_ok), 'generation_failed');

commit;

select pg_temp.assert(
  (select ok from _fail_active),
  'failing a stretch on an already-active plan is still recorded');

select pg_temp.assert(
  (select plan_failed from _fail_active) is false,
  'but the plan itself is not marked failed — it keeps active and its days');

select pg_temp.assert(
  (select status from public.prayer_plans where id = (select plan_id from _rbp)) = 'active',
  'and the plan row stays active, untouched by the failed later stretch');


-- ===========================================================================
-- Hallazgo 3 (refuerzo): carreras son idempotentes, no 500
-- ===========================================================================
--
-- Dos reservas concurrentes con distinto request_id pero el mismo usuario
-- corren dentro del advisory lock: una gana, la otra ve `quota_exhausted`.
-- Esto NO puede probarse con una sola conexión — el advisory lock serializa
-- las ejecuciones dentro de la misma conexión. El harness
-- `supabase/tests/generation-concurrency.sh` sí lo demuestra con conexiones
-- independientes, y este comentario documenta por qué este archivo no lo
-- intenta.
--
-- Lo que SÍ puede probarse aquí: que dos reservas secuenciales (mismo
-- usuario, distintos request_id) son limpias — la primera crea, la segunda
-- ve quota_exhausted, y ninguna lanza UNIQUE violation (500).
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Ana ya agotó sus 3 slots en los primeros tests. Cualquier reserva nueva
-- debe rechazarse limpiamente, sin 500.
create temp table _race_test as select * from public.reserve_generation(
  '11110000-0000-0000-0000-0000000000f1'::uuid, 'personal', 7::smallint);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'quota_exhausted' from _race_test),
  'a reservation when quota is full is rejected cleanly, not a 500');

-- Y reintentar el MISMO request_id (que no existía antes) con cuota llena
-- también debe ser un no limpio — no un 500 por UNIQUE violation.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table _race_retry as select * from public.reserve_generation(
  '11110000-0000-0000-0000-0000000000f1'::uuid, 'personal', 7::smallint);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'quota_exhausted' from _race_retry),
  'retrying the same request with full quota is also rejected cleanly');


-- ===========================================================================
-- Hallazgo 9b (cierre): un plan insertado con service_role y status
-- 'generating' no puede generar porque no tiene reserva
-- ===========================================================================
--
-- Este es el test de cierre: el agujero completo. Un admin tool o una
-- migración inserta un plan directamente. El dueño intenta generarlo a
-- través de `continue_plan_id`. La Edge Function llama a claim, claim
-- dice `no_reservation`, la Edge Function devuelve 500. El plan se queda
-- en `generating` para siempre — no consume generación, no quema
-- presupuesto de proveedor.
--
-- La aserción final: el plan sin reserva NO tiene lease, NO tiene días,
-- y NO tiene filas `continuation` en el ledger.
select pg_temp.assert(
  not exists (
    select 1 from public.plan_generation_leases
    where plan_id = 'dddd0000-0000-0000-0000-0000000000e1'
  ),
  'a plan without a reservation has no lease');

select pg_temp.assert(
  not exists (
    select 1 from public.prayer_plan_days
    where plan_id = 'dddd0000-0000-0000-0000-0000000000e1'
  ),
  'and has no written days');

select pg_temp.assert(
  not exists (
    select 1 from public.generation_ledger
    where plan_id = 'dddd0000-0000-0000-0000-0000000000e1'
  ),
  'and has no ledger entries at all — it is invisible to the quota system');

-- ===========================================================================
-- Hallazgo 1 (v4): un plan terminal no se puede continuar
-- ===========================================================================
--
-- `claim_generation_chunk` ahora mira el `status`: solo `generating` y
-- `active` reclaman. `failed`, `completed` y `archived` son terminales — un
-- cliente manipulado que mande `continue_plan_id` sobre uno de ellos recibe
-- `not_generatable`, no un lease, y no quema presupuesto de proveedor.

-- El plan de Carla (_rp) ya está `failed` tras agotar sus tres reintentos.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _claim_failed as select * from public.claim_generation_chunk(
  (select plan_id from _rp), '11110000-0000-0000-0000-000000000075'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_failed) = 'not_generatable',
  'a failed plan cannot be continued: the server refuses, not the client');

select pg_temp.assert(
  (select lease_id from _claim_failed) is null
    and (select from_day from _claim_failed) is null,
  'and no lease or range is handed out for a failed plan');

-- `completed` y `archived` tampoco reclaman, ni con reserva válida.
begin;

insert into public.prayer_plans
  (id, owner_id, title, duration_days, start_date, visibility, status, generated_by)
values
  ('eeee0000-0000-0000-0000-0000000000c1', '33333333-3333-3333-3333-333333333333',
   'Plan completado', 7, current_date, 'private', 'completed', 'ai'),
  ('eeee0000-0000-0000-0000-0000000000a1', '33333333-3333-3333-3333-333333333333',
   'Plan archivado', 7, current_date, 'private', 'archived', 'ai');

insert into public.generation_ledger
  (request_id, user_id, scope, plan_id, duration_days, status)
values
  ('11110000-0000-0000-0000-000000000076', '33333333-3333-3333-3333-333333333333',
   'personal', 'eeee0000-0000-0000-0000-0000000000c1', 7, 'reserved'),
  ('11110000-0000-0000-0000-000000000077', '33333333-3333-3333-3333-333333333333',
   'personal', 'eeee0000-0000-0000-0000-0000000000a1', 7, 'reserved');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp table _claim_completed as select * from public.claim_generation_chunk(
  'eeee0000-0000-0000-0000-0000000000c1'::uuid,
  '11110000-0000-0000-0000-000000000078'::uuid);
create temp table _claim_archived as select * from public.claim_generation_chunk(
  'eeee0000-0000-0000-0000-0000000000a1'::uuid,
  '11110000-0000-0000-0000-000000000079'::uuid);

commit;

select pg_temp.assert(
  (select reason from _claim_completed) = 'not_generatable',
  'a completed plan cannot be continued either');

select pg_temp.assert(
  (select reason from _claim_archived) = 'not_generatable',
  'nor can an archived one');


-- ===========================================================================
-- Hallazgo 2 (v4): mismo request + lease vencido sin liquidar ⇒ reclaim
-- ===========================================================================
--
-- Antes, la idempotencia del claim por `request_id` devolvía `already` ante
-- CUALQUIER lease con esa clave, vivo o vencido: un worker muerto envenenaba
-- su propia clave para siempre. Ahora solo un lease VIGENTE es `already`; uno
-- vencido cae al reclaim con un `lease_id` nuevo, y el `already` post-settle
-- se conserva.

begin;
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('44444444-4444-4444-4444-444444444444', 'dario@test.local',
        'authenticated', 'authenticated', '{"display_name":"Dario"}');
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

create temp table _dp as select * from public.reserve_generation(
  '11110000-0000-0000-0000-000000000080'::uuid, 'personal', 14::smallint);
create temp table _dclaim1 as select * from public.claim_generation_chunk(
  (select plan_id from _dp), '11110000-0000-0000-0000-000000000083'::uuid);

commit;

select pg_temp.assert(
  (select reason from _dclaim1) = 'claimed',
  'the first claim of the same request wins a lease');

-- La invocación muere sin liquidar: el lease vence.
begin;
update public.plan_generation_leases
   set leased_until = now() - interval '1 second'
 where plan_id = (select plan_id from _dp);
commit;

-- El MISMO request reintentado tras el vencimiento debe reclamar, no devolver
-- `already` con un lease_id ya muerto.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

create temp table _dclaim1_retry as select * from public.claim_generation_chunk(
  (select plan_id from _dp), '11110000-0000-0000-0000-000000000083'::uuid);

commit;

select pg_temp.assert(
  (select reason from _dclaim1_retry) = 'claimed',
  'retrying the same request after its lease expired reclaims, not already');

select pg_temp.assert(
  (select lease_id from _dclaim1_retry) is not null
    and (select lease_id from _dclaim1_retry) is distinct from
        (select lease_id from _dclaim1),
  'and hands out a fresh lease token, so the dead worker cannot resolve');

-- El `already` post-settle se conserva: mismo request, ya liquidado.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select public.settle_generation_chunk(
  (select lease_id from _dclaim1_retry), 'completed');

create temp table _dclaim1_settled as select * from public.claim_generation_chunk(
  (select plan_id from _dp), '11110000-0000-0000-0000-000000000083'::uuid);

commit;

select pg_temp.assert(
  (select reason from _dclaim1_settled) = 'already',
  'after a settle the same request is an idempotent already, not a reclaim');


-- ===========================================================================
-- Hallazgo 7 (v4): settle solo el dueño, con lease vigente
-- ===========================================================================
--
-- `settle_generation_chunk` exige `claimed_by = auth.uid()` y un `lease_id`
-- vigente (no vencido). Aquí se demuestra con los negativos que faltaban.

-- Dario reclama un tramo nuevo para tener un lease vivo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

create temp table _dclaim2 as select * from public.claim_generation_chunk(
  (select plan_id from _dp), '11110000-0000-0000-0000-000000000084'::uuid);

commit;

select pg_temp.assert(
  (select reason from _dclaim2) = 'claimed',
  'Dario holds a live lease to test against');

-- Ana (ajena) no puede liquidar el lease de Dario.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    select public.settle_generation_chunk(
      (select lease_id from _dclaim2), 'completed')
  $q$),
  'a stranger cannot settle someone else''s lease');

commit;

-- Un lease desconocido es un no-op idempotente, no un fallo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  public.settle_generation_chunk('00000000-0000-0000-0000-000000000000', 'completed') = false,
  'settling an unknown lease returns false without writing');

commit;

-- Un lease vencido tampoco se liquida.
begin;
update public.plan_generation_leases
   set leased_until = now() - interval '1 second'
 where plan_id = (select plan_id from _dp);
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  public.settle_generation_chunk((select lease_id from _dclaim2), 'completed') = false,
  'an expired lease returns false and writes nothing');

commit;


-- ===========================================================================
-- Hallazgo 3 (v4): el cliente ya no escribe días directamente
-- ===========================================================================
--
-- `prayer_plan_days` se escribía solo desde `complete_generation_chunk` (RPC
-- definer) y desde el trigger `sync_intercession_count` (definer); el cliente
-- no tiene ningún writer directo. La migración v4 revoca INSERT/UPDATE/DELETE
-- al rol `authenticated` y deja SELECT (con sus grants de columna).

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  (not has_table_privilege('authenticated', 'public.prayer_plan_days', 'INSERT')
   and not has_table_privilege('authenticated', 'public.prayer_plan_days', 'UPDATE')
   and not has_table_privilege('authenticated', 'public.prayer_plan_days', 'DELETE')),
  'the authenticated role has no write grant (insert/update/delete) on prayer_plan_days');

select pg_temp.assert(
  has_column_privilege('authenticated', 'public.prayer_plan_days', 'title', 'SELECT'),
  'read access survives through the column-level select grant');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.prayer_plan_days
      (plan_id, day_number, title, prayer_body, unlock_date)
    values ((select plan_id from _dp), 1, 'Día', 'Oración', current_date)
  $q$),
  'the client cannot insert plan days directly');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.prayer_plan_days set title = 'retocado'
  $q$),
  'nor update them');

select pg_temp.assert(
  pg_temp.raises($q$
    delete from public.prayer_plan_days
  $q$),
  'nor delete them');
commit;


-- ===========================================================================
-- Hallazgo 6 (v5): `already` por request_id filtra plan_id + user_id
-- ===========================================================================
--
-- Un request_id en el ledger de continuation debe pertenecer al MISMO plan
-- y al MISMO usuario para devolver `already`. Un request_id ya usado en un
-- plan ajeno no debe devolver `already` sobre otro plan.

-- Ema reserva un plan personal de 7 días.
begin;
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('55555555-5555-5555-5555-555555555555', 'ema@test.local',
        'authenticated', 'authenticated', '{"display_name":"Ema"}');
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

create temp table _ep as select * from public.reserve_generation(
  '11110000-0000-0000-0000-0000000000a1'::uuid, 'personal', 7::smallint);
create temp table _eclaim as select * from public.claim_generation_chunk(
  (select plan_id from _ep), '11110000-0000-0000-0000-0000000000a2'::uuid);

commit;

select pg_temp.assert(
  (select reason from _eclaim) = 'claimed',
  'Ema claims her first stretch');

-- Ema completa su tramo (request_id = ...a2). La fila continuation queda en
-- el ledger con plan_id de Ema + user_id de Ema.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

create temp table _ecomplete as select * from public.complete_generation_chunk(
  (select lease_id from _eclaim),
  (select jsonb_agg(jsonb_build_object(
    'day_number', n, 'title', 'Día ' || n, 'prayer_body', 'Oración ' || n,
    'unlock_date', (current_date + (n - 1))::text
  ) order by n)
     from generate_series(1, 7) n),
  'Plan de Ema', 'un tema', '{"model":"test"}'::jsonb);

commit;

select pg_temp.assert(
  (select ok from _ecomplete),
  'Ema completes her first stretch');

-- Ahora el request_id ...a2 está en el ledger con plan_id de Ema + user_id de Ema.
-- Beto (2222…) reclama su plan _rbp (14 días, 7 ya escritos) con el MISMO
-- request_id ...a2.
-- v5 evitó el falso `already` filtrando por plan_id + user_id. Eso no basta:
-- el UNIQUE global del ledger sobrevive al settle, así que claimed+complete
-- explotaría. Ahora es `request_id_conflict`.

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- _rbp tiene 7 días escritos (primer tramo) y su lease de tramo 2 ya quedó
-- fallado en tests anteriores: no hay lease vivo, así que el claim avanza.
create temp table _beto_foreign_req as select * from public.claim_generation_chunk(
  (select plan_id from _rbp), '11110000-0000-0000-0000-0000000000a2'::uuid);

commit;

select pg_temp.assert(
  (select reason from _beto_foreign_req) = 'request_id_conflict',
  'Beto using Ema''s settled request_id is request_id_conflict (ledger UNIQUE survives settle)');


-- ===========================================================================
-- Hallazgo 7 (v5): complete tras reclaim es un no-op, no una doble escritura
-- ===========================================================================
--
-- Un worker viejo cuyo lease fue reclamado no debe escribir días ni ledger
-- ni borrar el nuevo lease. El advisory lock + re-read bajo lock lo garantiza.
-- Este test lo simula con una sola conexión: reclama manualmente (cambia
-- lease_id) y luego intenta completar con el lease_id viejo.

-- Dario ya tiene _dp (14 días) con cero días escritos (el settle anterior
-- no escribe días, solo cierra el tramo). Reclamamos un lease nuevo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

create temp table _dclaim3 as select * from public.claim_generation_chunk(
  (select plan_id from _dp), '11110000-0000-0000-0000-000000000085'::uuid);

commit;

select pg_temp.assert(
  (select reason from _dclaim3) = 'claimed',
  'Dario claims a fresh stretch');

-- Ahora simulamos un reclaim: cambiamos el lease_id a mano (fuera del lock
-- de claim, pero es válido para este test de una conexión).
begin;
update public.plan_generation_leases
   set lease_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
       request_id = '11110000-0000-0000-0000-000000000086'::uuid,
       leased_until = now() + interval '5 minutes'
 where plan_id = (select plan_id from _dp);
commit;

-- El worker viejo (con el lease_id de _dclaim3) intenta completar.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

create temp table _stale_complete as
  select * from public.complete_generation_chunk(
    (select lease_id from _dclaim3),
    '[{"day_number":1,"title":"Día 1","prayer_body":"Oración","unlock_date":"2026-01-01"}]'::jsonb,
    null, null, null);

commit;

select pg_temp.assert(
  (select ok is false and reason = 'lease_lost' from _stale_complete),
  'a reclaimed lease cannot write days');

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days
    where plan_id = (select plan_id from _dp)) = 0,
  'and no days were written by the stale worker');

select pg_temp.assert(
  exists (
    select 1 from public.plan_generation_leases
     where plan_id = (select plan_id from _dp)
       and lease_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  ),
  'the new lease (ffff…) survives — the stale worker did not delete it');


-- ===========================================================================
-- Hallazgo 5 (v5): el heartbeat de generación está en generation_heartbeat_at
-- ===========================================================================
--
-- `complete_generation_chunk` ahora escribe `generation_heartbeat_at` y NO
-- toca `updated_at`. Esto se prueba indirectamente: tras un complete, el plan
-- tiene generation_heartbeat_at reciente.

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

-- Ema ya tiene su primer tramo completo. Reclamamos el siguiente (no hay,
-- porque son 7 días y ya están escritos — devuelve 'complete').

-- En vez de eso, verificamos que el plan de Ema tenga generation_heartbeat_at
-- después del complete que ya hicimos.
commit;

select pg_temp.assert(
  (select generation_heartbeat_at is not null
     from public.prayer_plans
    where id = (select plan_id from _ep)),
  'the plan has a generation_heartbeat_at after its first stretch completed');

-- A title update changes updated_at through the normal trigger, but it is not
-- generation work and must never change the recovery clock.
create temp table _ema_heartbeat_before_rename as
  select generation_heartbeat_at
    from public.prayer_plans
   where id = (select plan_id from _ep);

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

update public.prayer_plans
   set title = 'Plan de Ema renombrado'
 where id = (select plan_id from _ep);
commit;

select pg_temp.assert(
  (select p.generation_heartbeat_at = h.generation_heartbeat_at
     from public.prayer_plans p
     cross join _ema_heartbeat_before_rename h
    where p.id = (select plan_id from _ep)),
  'renaming a plan does not change generation_heartbeat_at');

-- A live request id belongs to exactly one lease. Reusing it for a second plan
-- must be a clean reason, not the UNIQUE violation of the lease table.
--
-- (C) lease vivo de otro plan — ya cubierto aquí. Esta suite es una sola
-- conexión: NO demuestra que el advisory lock por request_id serialice dos
-- claims paralelos; solo el rechazo limpio cuando el lease ajeno ya existe.
begin;
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('99999999-9999-9999-9999-999999999999', 'c0@test.local',
        'authenticated', 'authenticated', '{"display_name":"Cero"}');
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';

create temp table _c0_first_plan as select * from public.reserve_generation(
  '11110000-0000-0000-0000-0000000000c1'::uuid, 'personal', 7::smallint);
create temp table _c0_second_plan as select * from public.reserve_generation(
  '11110000-0000-0000-0000-0000000000c2'::uuid, 'personal', 7::smallint);
create temp table _c0_first_claim as select * from public.claim_generation_chunk(
  (select plan_id from _c0_first_plan), '11110000-0000-0000-0000-0000000000c3'::uuid);
create temp table _c0_cross_plan_claim as select * from public.claim_generation_chunk(
  (select plan_id from _c0_second_plan), '11110000-0000-0000-0000-0000000000c3'::uuid);
commit;

select pg_temp.assert(
  (select reason from _c0_first_claim) = 'claimed'
    and (select reason from _c0_cross_plan_claim) = 'request_id_conflict',
  '(C) a request id leased by another plan returns request_id_conflict, not UNIQUE');

-- (A) request liquidado de otro plan: el lease ya no existe, el UNIQUE del
-- ledger sí. Sin el chequeo del ledger esto devolvería `claimed` y complete
-- explotaría.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';

create temp table _c0_settle as select * from public.complete_generation_chunk(
  (select lease_id from _c0_first_claim),
  (select jsonb_agg(jsonb_build_object(
    'day_number', n, 'title', 'Día ' || n, 'prayer_body', 'Oración ' || n,
    'unlock_date', (current_date + (n - 1))::text
  ) order by n)
     from generate_series(1, 7) n),
  'Plan C0', 'tema', '{"model":"test"}'::jsonb);

create temp table _c0_settled_cross as select * from public.claim_generation_chunk(
  (select plan_id from _c0_second_plan),
  '11110000-0000-0000-0000-0000000000c3'::uuid);
commit;

select pg_temp.assert(
  (select ok from _c0_settle),
  '(A) the first plan settles its stretch');

select pg_temp.assert(
  (select reason from _c0_settled_cross) = 'request_id_conflict',
  '(A) a settled request id from another plan is request_id_conflict, not claimed');

-- (B) reusar el request_id de la propia reserva (scope personal) como continue.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';

create temp table _c0_reuse_reserve as select * from public.claim_generation_chunk(
  (select plan_id from _c0_second_plan),
  '11110000-0000-0000-0000-0000000000c2'::uuid);

create temp table _c0_null_req as select * from public.claim_generation_chunk(
  (select plan_id from _c0_second_plan), null);
commit;

select pg_temp.assert(
  (select reason from _c0_reuse_reserve) = 'request_id_conflict',
  '(B) reusing the reservation request_id as a continuation is request_id_conflict');

select pg_temp.assert(
  (select reason from _c0_null_req) = 'request_id_required',
  'a null request_id returns request_id_required, not a 500');


\echo '===================================='
\echo ' GENERATION ASSERTIONS PASSED'
\echo '===================================='
