\set ON_ERROR_STOP on

-- Bloque S: seguir a alguien, que es lo que sustituye al modelo de amigos que
-- llevaba aquí desde la Fase 1 sin una sola pantalla.
--
-- Lo que de verdad se prueba aquí no es el `insert`: es que **el bloqueo llega
-- hasta el final**. Seguir crea un vínculo permanente entre dos personas, y un
-- bloqueo que solo callara el chat dejaría a alguien con su bloqueado de
-- seguidor, contado en su perfil.

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


-- ===========================================================================
-- Seguir, y que se note
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- La regla 1 de este proyecto: una policy de SELECT que consultara su propia
-- tabla rompería esto, y Postgres lo reportaría igual que un fallo de WITH
-- CHECK. Cada tabla nueva se lo gana con su assertion.
with inserted as (
  insert into public.follows (follower_id, followee_id)
  values (:ANA, :BETO)
  returning followee_id
)
select pg_temp.assert(
  (select count(*) from inserted) = 1,
  'insert ... returning works on follows (rule 1)');

select pg_temp.assert(
  (select following_count from public.profiles where id = :ANA) = 1
  and (select follower_count from public.profiles where id = :BETO) = 1,
  'and the counters move on both sides');

-- Nadie más ve el grafo: los números son públicos, la lista no.
select pg_temp.assert(
  (select count(*) from public.follows) = 1,
  'the person following sees their own follow');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.follows) = 1,
  'and so does the person followed, so they can remove them');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.follows) = 0,
  'but nobody else sees who follows whom');

commit;


-- ===========================================================================
-- Lo que no se puede hacer
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises(format(
    'insert into public.follows (follower_id, followee_id) values (%L, %L)',
    :ANA, :ANA)),
  'you cannot follow yourself');

select pg_temp.assert(
  pg_temp.raises(format(
    'insert into public.follows (follower_id, followee_id) values (%L, %L)',
    :BETO, :CARLA)),
  'nor make somebody else follow anyone');

commit;


-- ===========================================================================
-- El bloqueo, que es la mitad del trabajo
-- ===========================================================================

-- Carla sigue a Ana; Ana la bloquea. Nótese la dirección: quien bloquea **no**
-- es quien seguía. Si el trigger solo mirara hacia adelante, Carla se quedaría
-- de seguidora de Ana para siempre.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.follows (follower_id, followee_id) values (:CARLA, :ANA);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select follower_count from public.profiles where id = :ANA) = 1,
  'Carla follows Ana');

insert into public.blocks (blocker_id, blocked_id) values (:ANA, :CARLA);

select pg_temp.assert(
  not exists (
    select 1 from public.follows
    where follower_id = :CARLA and followee_id = :ANA
  ),
  'blocking somebody drops the follow they had on you');

select pg_temp.assert(
  (select follower_count from public.profiles where id = :ANA) = 0,
  'and the counter goes back down');

select pg_temp.assert(
  pg_temp.raises(format(
    'insert into public.follows (follower_id, followee_id) values (%L, %L)',
    :ANA, :CARLA)),
  'and you cannot follow somebody you blocked');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- Y en el otro sentido, que es el que se olvida: bloquear es silencioso, así
-- que Carla no sabe que la bloquearon. Lo que no puede es volver a seguirla.
select pg_temp.assert(
  pg_temp.raises(format(
    'insert into public.follows (follower_id, followee_id) values (%L, %L)',
    :CARLA, :ANA)),
  'nor follow somebody who blocked you');

commit;


-- ===========================================================================
-- Dejar de seguir, y quitarte un seguidor
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Beto se quita a Ana de encima sin bloquearla: el bloqueo es un martillo para
-- algo que muchas veces solo pide un "prefiero que no".
delete from public.follows where follower_id = :ANA and followee_id = :BETO;

select pg_temp.assert(
  (select follower_count from public.profiles where id = :BETO) = 0
  and (select following_count from public.profiles where id = :ANA) = 0,
  'you can drop a follower without blocking them, and the counts follow');

commit;


-- ===========================================================================
-- El perfil
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.follows (follower_id, followee_id) values (:ANA, :BETO);

select pg_temp.assert(
  (select i_follow from public.public_profile(:BETO)),
  'the profile knows whether you already follow them');

select pg_temp.assert(
  (select follower_count from public.public_profile(:BETO)) = 1,
  'and how many follow them');

commit;

-- La racha se decide en el servidor y con **el día de esa persona**, no con el
-- del dispositivo de quien mira. Beto oró hace tres días: la gracia perdona uno
-- y la racha ya no está viva, aunque el número guardado siga ahí.
begin;

update public.profiles
   set streak_count = 9,
       streak_last_day = (now() at time zone 'UTC')::date - 3
 where id = :BETO;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select streak from public.public_profile(:BETO)) = 0,
  'a lapsed streak reads as zero, not as the stale stored number');

commit;

begin;

update public.profiles
   set streak_last_day = (now() at time zone 'UTC')::date - 1
 where id = :BETO;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select streak from public.public_profile(:BETO)) = 9,
  'and a live one reads whole — the grace day is the same as the personal rule');

commit;


-- ===========================================================================
-- RLS sigue puesta
-- ===========================================================================
begin;

select pg_temp.assert(
  (select relrowsecurity from pg_class where oid = 'public.follows'::regclass),
  'RLS is on for follows');

commit;

\echo '===================================='
\echo ' SOCIAL ASSERTIONS PASSED'
\echo '===================================='
