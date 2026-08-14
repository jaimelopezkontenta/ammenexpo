\set ON_ERROR_STOP on

-- Que un plan pueda terminar, y que se puedan tener varios.
--
-- Las dos trampas que este archivo fija: un plan de N días que se acaba tiene
-- que *decir* que se acabó — hasta ahora la app se quedaba en el último día
-- para siempre — y el plan que estás recorriendo tiene que ser tuyo.

\set ANA  '''11111111-1111-1111-1111-111111111111'''
\set BETO '''22222222-2222-2222-2222-222222222222'''

\set PLAN_DONE    '''aaaa0000-0000-0000-0000-0000000000d1'''
\set PLAN_RUNNING '''aaaa0000-0000-0000-0000-0000000000d2'''
\set PLAN_STALLED '''aaaa0000-0000-0000-0000-0000000000d3'''
\set PLAN_BETO    '''aaaa0000-0000-0000-0000-0000000000d4'''
\set PLAN_PUBLIC  '''aaaa0000-0000-0000-0000-0000000000d5'''
\set PLAN_ARCHIVE '''aaaa0000-0000-0000-0000-0000000000a1'''
\set PLAN_DONE_ST '''aaaa0000-0000-0000-0000-0000000000a2'''
\set PLAN_FAIL    '''aaaa0000-0000-0000-0000-0000000000a3'''
\set PLAN_GEN     '''aaaa0000-0000-0000-0000-0000000000a4'''
\set LEDGER_ARCH  '''bbbb0000-0000-0000-0000-0000000000a1'''

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

-- Un plan de 3 días que empezó hace una semana: los tres días escritos, el
-- último desbloqueado hace cuatro días. Está terminado.
insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values (:PLAN_DONE, :ANA, 'Plan terminado', 3, current_date - 6,
        'private', 'active');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body,
                                     unlock_date, intercession_count)
values (:PLAN_DONE, 1, 'Día uno',  'Privado', current_date - 6, 2),
       (:PLAN_DONE, 2, 'Día dos',  'Privado', current_date - 5, 1),
       (:PLAN_DONE, 3, 'Día tres', 'Privado', current_date - 4, 0);

-- Uno en marcha: 3 días, el de hoy es el segundo.
insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values (:PLAN_RUNNING, :ANA, 'Plan en marcha', 3, current_date - 1,
        'private', 'active');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body,
                                     unlock_date)
values (:PLAN_RUNNING, 1, 'Día uno', 'Privado', current_date - 1),
       (:PLAN_RUNNING, 2, 'Día dos', 'Privado', current_date),
       (:PLAN_RUNNING, 3, 'Día tres', 'Privado', current_date + 1);

-- Uno que prometía 30 días y se quedó en 2, con la última fecha ya pasada.
-- Se parece a un plan terminado y no lo es: la salida que necesita es
-- reintentar, no celebrarlo.
insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values (:PLAN_STALLED, :ANA, 'Plan a medias', 30, current_date - 6,
        'private', 'active');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body,
                                     unlock_date)
values (:PLAN_STALLED, 1, 'Día uno', 'Privado', current_date - 6),
       (:PLAN_STALLED, 2, 'Día dos', 'Privado', current_date - 5);

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values (:PLAN_BETO, :BETO, 'Plan de Beto', 3, current_date, 'private', 'active');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body,
                                     unlock_date)
values (:PLAN_BETO, 1, 'Su día', 'Privado', current_date);

commit;

-- Ana oró los dos primeros días del plan terminado, y se saltó el tercero.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.prayer_logs (user_id, plan_day_id)
select :ANA, d.id from public.prayer_plan_days d
where d.plan_id = :PLAN_DONE and d.day_number in (1, 2);

commit;


-- ===========================================================================
-- Un plan sabe cuándo se ha acabado
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select finished from public.plan_progress(:PLAN_DONE)),
  'a plan whose last day is behind us knows it has finished');

select pg_temp.assert(
  not (select finished from public.plan_progress(:PLAN_RUNNING)),
  'and one still running does not');

-- La distinción que evita felicitar a alguien por un plan que se rompió: los
-- días escritos tienen que llegar a los prometidos.
select pg_temp.assert(
  not (select finished from public.plan_progress(:PLAN_STALLED)),
  'a generation that stalled is not a plan that finished');

commit;


-- ===========================================================================
-- El resumen que se enseña al cerrar
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select days_total from public.plan_progress(:PLAN_DONE)) = 3
  and (select days_written from public.plan_progress(:PLAN_DONE)) = 3
  and (select days_unlocked from public.plan_progress(:PLAN_DONE)) = 3,
  'the summary counts the days');

-- Dos de tres. Contar tres sería el error que convierte un resumen honesto en
-- una felicitación vacía.
select pg_temp.assert(
  (select days_prayed from public.plan_progress(:PLAN_DONE)) = 2,
  'and counts only the days actually prayed');

select pg_temp.assert(
  (select intercessions_received from public.plan_progress(:PLAN_DONE)) = 3,
  'and how many times somebody prayed for her');

select pg_temp.assert(
  (select count(*) from public.plan_progress(:PLAN_BETO)) = 0,
  'and says nothing at all about somebody else''s plan');

commit;

-- La función es SECURITY DEFINER, así que la policy de `prayer_logs` —que solo
-- deja ver los tuyos— no la protege: sin acotar el join por `user_id` contaría
-- los rezos de cualquiera como si fueran del dueño.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into public.prayer_logs (user_id, plan_day_id)
select :BETO, d.id from public.prayer_plan_days d
where d.plan_id = :PLAN_DONE and d.day_number = 3;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select days_prayed from public.plan_progress(:PLAN_DONE)) = 2,
  'somebody else praying her day does not count as her having prayed it');

commit;


-- ===========================================================================
-- El plan que estás recorriendo es tuyo
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.profile_settings
   set active_plan_id = :PLAN_RUNNING
 where id = :ANA;

select pg_temp.assert(
  (select active_plan_id from public.profile_settings where id = :ANA)
    = :PLAN_RUNNING,
  'Ana can choose which of her plans she is walking');

-- La policy de UPDATE mira de quién es la fila, no qué se escribe dentro.
select pg_temp.assert(
  pg_temp.raises($q$
    update public.profile_settings
       set active_plan_id = 'aaaa0000-0000-0000-0000-0000000000d4'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'but not somebody else''s plan');

select pg_temp.assert(
  (select active_plan_id from public.profile_settings where id = :ANA)
    = :PLAN_RUNNING,
  'and the refusal leaves her own choice standing');

commit;

-- Un plan borrado no puede dejar apuntando al vacío de una forma que rompa
-- la pantalla de inicio: la FK es `on delete set null`.
begin;

delete from public.prayer_plans where id = 'aaaa0000-0000-0000-0000-0000000000d2';

select pg_temp.assert(
  (select active_plan_id from public.profile_settings where id = :ANA) is null,
  'deleting the active plan clears the pointer instead of dangling');

commit;


-- ===========================================================================
-- El plan público
--
-- La visibilidad nueva de la red social: un plan que cualquiera puede abrir
-- desde tu perfil y por el que puede orar, sin enlace y sin círculo. Lo que
-- **no** cambia es nada de lo que ya protegía un plan.
-- ===========================================================================
-- Plan propio, y no el activo de arriba: ese lo borra la assertion anterior
-- para comprobar que el puntero no queda colgando.
begin;

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values (:PLAN_PUBLIC, :ANA, 'Plan abierto', 3, current_date - 1,
        'public', 'active');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body,
                                     unlock_date)
values (:PLAN_PUBLIC, 1, 'Día uno', 'Privado', current_date - 1),
       (:PLAN_PUBLIC, 2, 'Día dos', 'Privado', current_date + 1);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  public.can_read_plan(:PLAN_PUBLIC),
  'a stranger can open a public plan');

select pg_temp.assert(
  (select count(*) from public.prayer_plans where id = :PLAN_PUBLIC) = 1,
  'and the row itself is readable, not just the helper');

-- Lo que sigue cerrado, que es la mitad que importa: los días futuros y el
-- texto de la oración en primera persona.
select pg_temp.assert(
  not public.can_read_plan_day((
    select id from public.prayer_plan_days
    where plan_id = :PLAN_PUBLIC and unlock_date > current_date
    order by day_number limit 1
  )),
  'but a day that has not opened yet stays shut, public or not');

select pg_temp.assert(
  pg_temp.raises($q$
    select prayer_body from public.prayer_plan_days
     where plan_id = 'aaaa0000-0000-0000-0000-0000000000d5'
  $q$),
  'and the first-person prayer is not published with the plan');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  not public.can_read_plan(:PLAN_DONE),
  'a private plan of hers is still nobody else''s business');

commit;


-- ===========================================================================
-- B2: el contrato entre público y Orar
--
-- El experimento dirigido (docs/evidencias/b2-public-orar-antes.md) mostró
-- que, sin esta migración, este mismo plan público sin share entraba en
-- `plans_shared_with_me()` y aceptaba `insert` en `intercessions` desde la
-- API. Estas assertions fijan el "después": descubrible/legible desde
-- Comunidad sigue igual arriba; orar exige un share explícito.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- El día 1 de PLAN_PUBLIC ya está desbloqueado (unlock_date = ayer).
select pg_temp.assert(
  not public.can_pray_plan(:PLAN_PUBLIC),
  'a stranger cannot pray a public plan without an explicit share');

select pg_temp.assert(
  not public.can_pray_plan_day((
    select id from public.prayer_plan_days
    where plan_id = :PLAN_PUBLIC and day_number = 1
  )),
  'nor its already-unlocked day');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id)
    select id, '11111111-1111-1111-1111-111111111111',
           '22222222-2222-2222-2222-222222222222'
      from public.prayer_plan_days
     where plan_id = 'aaaa0000-0000-0000-0000-0000000000d5' and day_number = 1
  $q$),
  'and the insert the experiment used to accept is now rejected');

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()
    where plan_id = :PLAN_PUBLIC) = 0,
  'Orar does not list the public plan without a share');

select pg_temp.assert(
  (select count(*) from public.get_shared_plan_day(:PLAN_PUBLIC)) = 0,
  '/orar/[planId] resolves to nothing, server-side, without a share');

-- Comunidad sigue abierta: leer no es orar.
select pg_temp.assert(
  (select count(*) from public.get_public_plan_day(:PLAN_PUBLIC)) = 1,
  'but Comunidad still opens the same public plan for reading');

commit;

-- Ana comparte explícitamente con Beto: las tres superficies de oración
-- concuerdan a partir de aquí.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
values (:PLAN_PUBLIC, :BETO, :ANA);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  public.can_pray_plan(:PLAN_PUBLIC),
  'once shared explicitly, the same plan can be prayed for');

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()
    where plan_id = :PLAN_PUBLIC) = 1,
  'Orar lists it now');

select pg_temp.assert(
  (select count(*) from public.get_shared_plan_day(:PLAN_PUBLIC)) = 1,
  'and /orar/[planId] resolves it too');

insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id)
select id, :ANA, :BETO
  from public.prayer_plan_days
 where plan_id = :PLAN_PUBLIC and day_number = 1;

select pg_temp.assert(
  (select count(*) from public.intercessions i
    join public.prayer_plan_days d on d.id = i.plan_day_id
    where d.plan_id = :PLAN_PUBLIC and i.intercessor_id = :BETO) = 1,
  'and praying for the shared day is accepted');

commit;

-- Se revoca el share antes de seguir: lo que prueba la siguiente sección es
-- que despublicar cierra el acceso *público*, y un share explícito vigente
-- seguiría abriendo el plan por su propio derecho — eso ya lo prueba el
-- bloque de arriba, no hay que mezclarlo con este.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

delete from public.plan_shares
 where plan_id = :PLAN_PUBLIC and shared_with_user_id = :BETO;

commit;

-- Y lo que hace que publicar no sea un camino sin vuelta: quitarlo. Hasta esta
-- assertion, la única salida de un plan público habría sido borrarlo entero,
-- con los días ya orados dentro.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.prayer_plans set visibility = 'private' where id = :PLAN_PUBLIC;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  not public.can_read_plan(:PLAN_PUBLIC),
  'and unpublishing closes it again');

commit;


-- ===========================================================================
-- Archivar un plan propio (C2)
--
-- `status` ya no se escribe por grant. Solo `archive_my_plan`, y solo el
-- dueño, y solo desde `active`/`completed`. El ledger no se toca.
-- ===========================================================================
begin;

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values (:PLAN_ARCHIVE, :ANA, 'Plan a archivar', 7, current_date, 'private', 'active'),
       (:PLAN_DONE_ST, :ANA, 'Plan completed', 7, current_date, 'private', 'completed'),
       (:PLAN_FAIL,    :ANA, 'Plan fallido',   7, current_date, 'private', 'failed'),
       (:PLAN_GEN,     :ANA, 'Plan generando', 7, current_date, 'private', 'generating');

insert into public.generation_ledger
  (id, request_id, user_id, scope, plan_id, duration_days, status)
values
  (:LEDGER_ARCH, :LEDGER_ARCH, :ANA, 'personal', :PLAN_ARCHIVE, 7, 'reserved');

update public.profile_settings
   set active_plan_id = :PLAN_ARCHIVE
 where id = :ANA;

commit;

-- El cliente no puede archivar tocando la columna.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    update public.prayer_plans
       set status = 'archived'
     where id = 'aaaa0000-0000-0000-0000-0000000000a1'
  $q$),
  'the client cannot archive by updating status directly');

commit;

-- Beto no archiva el plan de Ana.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$ select public.archive_my_plan('aaaa0000-0000-0000-0000-0000000000a1') $q$),
  'a stranger cannot archive someone else''s plan');

commit;

select pg_temp.assert(
  (select status from public.prayer_plans where id = :PLAN_ARCHIVE) = 'active',
  'and the refusal leaves the plan active');

-- Failed y generating no se archivan.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$ select public.archive_my_plan('aaaa0000-0000-0000-0000-0000000000a3') $q$),
  'a failed plan cannot be archived');

select pg_temp.assert(
  pg_temp.raises($q$ select public.archive_my_plan('aaaa0000-0000-0000-0000-0000000000a4') $q$),
  'nor can a generating one');

commit;

-- Sin sesión no hay RPC. Un plan *active*: uno ya archived fallaría igual
-- con sesión (`not_archivable`) y no probaría el grant. Rol `anon` de verdad.
begin;
set local role anon;

select pg_temp.assert(
  pg_temp.raises($q$ select public.archive_my_plan('aaaa0000-0000-0000-0000-0000000000a1') $q$),
  'unauthenticated callers cannot archive');

commit;

select pg_temp.assert(
  (select status from public.prayer_plans where id = :PLAN_ARCHIVE) = 'active',
  'and the refusal leaves the plan active');

-- Ana sí archiva el suyo active. El ledger no se reembolsa.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.archive_my_plan(:PLAN_ARCHIVE);

commit;

select pg_temp.assert(
  (select status from public.prayer_plans where id = :PLAN_ARCHIVE) = 'archived',
  'the owner can archive an active plan');

select pg_temp.assert(
  (select active_plan_id from public.profile_settings where id = :ANA) is null,
  'archiving the walking plan clears the pointer');

select pg_temp.assert(
  (select count(*) from public.generation_ledger where id = :LEDGER_ARCH) = 1,
  'archiving does not delete the ledger row');

select pg_temp.assert(
  (select status from public.generation_ledger where id = :LEDGER_ARCH) = 'reserved',
  'and does not change its status — quota is not refunded');

-- Segunda vez: ya archived, no se rearchiva.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$ select public.archive_my_plan('aaaa0000-0000-0000-0000-0000000000a1') $q$),
  'an already archived plan is not archivable again');

-- Completed también.
select public.archive_my_plan(:PLAN_DONE_ST);

commit;

select pg_temp.assert(
  (select status from public.prayer_plans where id = :PLAN_DONE_ST) = 'archived',
  'the owner can archive a completed plan');

\echo '===================================='
\echo ' PLAN ASSERTIONS PASSED'
\echo '===================================='
