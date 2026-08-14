\set ON_ERROR_STOP on

-- Bloque F: flags server-side.
--
-- Una superficie comunitaria que se enciende y apaga desde el servidor, sin
-- redeploy y sin fiarse del cliente. Lo que se prueba aquí es que el
-- interruptor es real: quién puede moverlo (y que queda escrito), que
-- `home_feed` y las demás entradas comunitarias responden a él —OFF es
-- conjunto vacío, ON es el contrato B2 de siempre—, y que un flag desconocido
-- o ausente lee `false`, que es la mitad de la promesa de fail-closed.

\set ANA   '''11111111-1111-1111-1111-111111111111'''
\set BETO  '''22222222-2222-2222-2222-222222222222'''
\set CARLA '''33333333-3333-3333-3333-333333333333'''

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
  (:ANA,   'ana@test.local',   'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:BETO,  'beto@test.local',  'authenticated', 'authenticated', '{"display_name":"Beto"}'),
  (:CARLA, 'carla@test.local', 'authenticated', 'authenticated', '{"display_name":"Carla"}');

commit;

-- Contenido para que las superficies comunitarias tengan algo que servir (o
-- no servir) cuando el flag cambie de lado: dos peticiones del muro, un
-- testimonio, un plan público, y —para probar que apagar la comunidad no rompe
-- los círculos— un círculo privado con su petición.
begin;

insert into public.posts (id, author_id, body)
values ('ffff0000-0000-0000-0000-000000000001', :BETO,  'Oren por mi madre, está en el hospital'),
       ('ffff0000-0000-0000-0000-000000000002', :CARLA, 'Gracias por haber orado');

insert into public.testimonies (user_id, body, visibility)
values (:BETO, 'Encontré trabajo en septiembre', 'public');

insert into public.prayer_plans (id, owner_id, title, duration_days, visibility, status)
values ('ffff0000-0000-0000-0000-0000000000a1', :BETO, 'Confiar más que controlar',
        14, 'public', 'active');

insert into public.groups (id, owner_id, name, description, visibility)
values ('ffff0000-0000-0000-0000-0000000000c1', :BETO, 'Familia',
        'El círculo de la prueba', 'private');

insert into public.posts (id, author_id, group_id, body)
values ('ffff0000-0000-0000-0000-000000000003', :BETO,
        'ffff0000-0000-0000-0000-0000000000c1', 'Solo para el círculo');

commit;

-- Ana es staff desde antes de tocar el interruptor, igual que en el resto de
-- suites: el bit se pone como superuser. Aquí sirve para probar lo contrario
-- de antes —que ni el staff mueve un flag— porque el canal es solo service_role.
begin;

update public.profiles set is_staff = true where id = :ANA;

commit;


-- ===========================================================================
-- La migración registra community_feed OFF: comprobación estructural
-- ===========================================================================
--
-- El harness (`supabase db reset`) aplica el seed DESPUÉS de las migraciones,
-- y el seed enciende `community_feed` a propósito para conservar el contrato
-- B2. Por eso, en esta base no se puede observar el estado "recién migrado,
-- pre-seed" a nivel de fila: cualquier `select enabled from feature_flags` ya
-- ve el `true` que escribió el seed, no el `false` que insertó la migración
-- `20260826100000_feature_flags.sql`.
--
-- Lo que sí se puede comprobar sin falsear evidencia es la DEFINICIÓN, que el
-- seed no toca: la columna `enabled` nace con `default false`, de modo que un
-- flag recién insertado (o ausente) lee apagado. Esa es la mitad estructural
-- del fail-closed que el INSERT de la migración aprovecha al registrar
-- `community_feed` con `enabled = false`.
begin;

select pg_temp.assert(
  (select column_default
     from information_schema.columns
    where table_schema = 'public'
      and table_name = 'feature_flags'
      and column_name = 'enabled') = 'false',
  'the registry column default is false: a flag is born off, structurally');

commit;


-- ===========================================================================
-- La lectura: fail-closed, y las tablas no salen por la API
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select public.flag_enabled('flag_que_no_existe')) = false,
  'an unknown flag reads as disabled, never as on');

select pg_temp.assert(
  pg_temp.raises($q$ select * from public.feature_flags $q$),
  'the registry table is not readable over the API');

select pg_temp.assert(
  pg_temp.raises($q$ select * from public.feature_flag_events $q$),
  'nor is the audit log');

commit;


-- ===========================================================================
-- Quien no es staff no mueve un flag
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    select public.admin_set_flag('community_feed', false, 'carla', 'quiero apagarlo')
  $q$),
  'somebody who is not staff cannot flip a flag');

commit;


-- ===========================================================================
-- El canal es solo administrativo: ni el staff lo mueve desde la app
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    select public.admin_set_flag('community_feed', false, 'ana', 'apagado de emergencia')
  $q$),
  'even a staff account cannot flip a flag — the channel is service_role only');

commit;


-- ===========================================================================
-- El canal administrativo (service_role) sí, y queda escrito
-- ===========================================================================
begin;
set local role service_role;

select pg_temp.assert(
  public.admin_set_flag('community_feed', false, 'ops-runner', 'ventana de mantenimiento'),
  'the service role can disable a flag');

commit;

begin;

select pg_temp.assert(
  (select enabled from public.feature_flags where key = 'community_feed') = false,
  'and the flag is actually off');

select pg_temp.assert(
  (select count(*) from public.feature_flag_events
    where flag_key = 'community_feed'
      and action = 'disable'
      and actor = 'ops-runner'
      and reason = 'ventana de mantenimiento') = 1,
  'with who, what, why and when written down');

commit;


-- ===========================================================================
-- OFF cierra todas las entradas comunitarias
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.home_feed()) = 0,
  'with the flag off, the feed is empty even though there is content');

select pg_temp.assert(
  (select count(*) from public.home_feed(null, 30)) = 0,
  'and it stays empty no matter how you page it');

select pg_temp.assert(
  (select count(*) from public.search_people('Beto')) = 0,
  'and the people directory closes too');

select pg_temp.assert(
  (select count(*) from public.person_posts(:BETO)) = 0,
  'and a profile stops listing its posts');

select pg_temp.assert(
  (select count(*) from public.person_plans(:BETO)) = 0,
  'and its public plans');

select pg_temp.assert(
  (select count(*) from public.prayer_feed()) = 0,
  'and the open wall is empty');

commit;

-- Apagar la comunidad no rompe los círculos: el feed de un círculo concreto
-- sigue sirviendo a quien es miembro.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_feed('ffff0000-0000-0000-0000-0000000000c1')) = 1,
  'a circle feed still serves its members while the community is off');

commit;


-- ===========================================================================
-- El canal administrativo reenciende, y ON devuelve el contrato B2
-- ===========================================================================
begin;
set local role service_role;

select pg_temp.assert(
  public.admin_set_flag('community_feed', true, 'ops-runner', 'reabrir tras mantenimiento'),
  'the service role can re-enable the flag');

commit;

begin;

select pg_temp.assert(
  (select enabled from public.feature_flags where key = 'community_feed') = true,
  'and the flag is back on');

select pg_temp.assert(
  (select count(*) from public.feature_flag_events
    where flag_key = 'community_feed'
      and action = 'enable'
      and actor = 'ops-runner'
      and reason = 'reabrir tras mantenimiento') = 1,
  'and the enable is audited too');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.home_feed()) >= 3,
  'with the flag on, the feed serves the public surface again (B2 intact)');

select pg_temp.assert(
  (select count(*) from public.home_feed() where kind = 'testimony') = 1,
  'mixing testimonies in with the requests, as before');

select pg_temp.assert(
  (select count(*) from public.search_people('Beto')) = 1,
  'and the directory finds people again');

select pg_temp.assert(
  (select count(*) from public.person_posts(:BETO)) = 1,
  'and a profile lists its posts again');

select pg_temp.assert(
  (select count(*) from public.person_plans(:BETO)) = 1,
  'and its public plans');

select pg_temp.assert(
  (select count(*) from public.prayer_feed()) = 2,
  'and the open wall serves the two public requests');

commit;


-- ===========================================================================
-- Fail-closed por arriba: no se inventan flags, no se escribe sin dejar razón
-- ===========================================================================
begin;
set local role service_role;

select pg_temp.assert(
  pg_temp.raises($q$
    select public.admin_set_flag('flag_que_no_existe', true, 'ops-runner', 'inventar un flag')
  $q$),
  'a flag that was never registered cannot be created through the channel');

select pg_temp.assert(
  pg_temp.raises($q$
    select public.admin_set_flag('community_feed', true, '', 'no operator named')
  $q$),
  'a change without an operator is refused');

select pg_temp.assert(
  pg_temp.raises($q$
    select public.admin_set_flag('community_feed', true, 'ops-runner', '  ')
  $q$),
  'and one without a reason is refused too');

-- Append-only de verdad: ni el service_role corrige el pasado.
select pg_temp.assert(
  pg_temp.raises($q$
    update public.feature_flag_events set reason = 'rewritten'
  $q$),
  'the audit log cannot be rewritten');

select pg_temp.assert(
  pg_temp.raises($q$
    delete from public.feature_flag_events
  $q$),
  'nor emptied');

commit;

-- El historial no se sobrescribe: quedan los dos eventos de arriba.
begin;

select pg_temp.assert(
  (select count(*) from public.feature_flag_events
    where flag_key = 'community_feed') = 2,
  'the log keeps every change, it does not overwrite');

commit;


-- ===========================================================================
-- RLS sigue puesta
-- ===========================================================================
begin;

select pg_temp.assert(
  (select relrowsecurity from pg_class where oid = 'public.feature_flags'::regclass),
  'RLS is on for feature_flags');

select pg_temp.assert(
  (select relrowsecurity from pg_class where oid = 'public.feature_flag_events'::regclass),
  'RLS is on for feature_flag_events');

commit;

\echo '================================'
\echo ' FLAGS ASSERTIONS PASSED'
\echo '================================'
