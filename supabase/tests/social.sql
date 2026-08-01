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
-- Encontrar a una persona
--
-- No existía ninguna forma. Y la lección de la eñe ya se pagó dos veces: la
-- eñe no es una ene acentuada y la configuración `spanish` la conserva, así
-- que sin `immutable_unaccent` buscar "nunez" no encuentra a nadie.
-- ===========================================================================
begin;

update public.profiles set display_name = 'María Núñez' where id = :CARLA;

-- Ana la bloqueó tres bloques más arriba, al probar que bloquear deshace el
-- seguimiento. Se deshace aquí para que el buscador parta de limpio; el
-- bloqueo se vuelve a poner más abajo, que es donde se prueba.
delete from public.blocks where blocker_id = :ANA and blocked_id = :CARLA;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.search_people('María')) = 1,
  'you can find somebody by name');

select pg_temp.assert(
  (select count(*) from public.search_people('maria')) = 1,
  'without the accent, which is how a phone keyboard types');

select pg_temp.assert(
  (select count(*) from public.search_people('nunez')) = 1,
  'and without the enye, which is not an accented n');

select pg_temp.assert(
  (select count(*) from public.search_people('mar')) = 1,
  'and while you are still typing');

-- La misma familia de entradas que hacía reventar a `to_tsquery` en el
-- buscador de círculos.
select pg_temp.assert(
  (select count(*) from public.search_people('a & | b')) >= 0
  and (select count(*) from public.search_people(':::')) >= 0
  and (select count(*) from public.search_people('"sin cerrar')) >= 0,
  'and nothing anybody types makes it raise');

select pg_temp.assert(
  not exists (
    select 1 from public.search_people('Ana') where id = :ANA
  ),
  'you never appear in your own search results');

commit;

-- Bloquear quita a esa persona del buscador **en un solo sentido**: si también
-- desapareciera para quien te bloqueó, el bloqueo dejaría de ser silencioso.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.blocks (blocker_id, blocked_id) values (:ANA, :CARLA);

select pg_temp.assert(
  (select count(*) from public.search_people('maria')) = 0,
  'somebody you blocked is not in your results');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.search_people('Ana')) = 1,
  'but you still appear in theirs, because blocking says nothing');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

delete from public.blocks where blocker_id = :ANA;

commit;


-- ===========================================================================
-- El feed
-- ===========================================================================
begin;

insert into public.posts (id, author_id, body, is_anonymous)
values ('bbbb0000-0000-0000-0000-000000000001', :BETO,
        'Oren por mi madre, está en el hospital', false),
       ('bbbb0000-0000-0000-0000-000000000002', :CARLA,
        'Algo que no quiero firmar', true);

insert into public.testimonies (user_id, body, visibility)
values (:BETO, 'Encontró trabajo en septiembre', 'public');

-- Ana sigue a Beto desde el bloque del perfil. Se deshace para probar el caso
-- que de verdad decide si alguien vuelve al día siguiente: el primer día, sin
-- seguir a nadie.
delete from public.follows where follower_id = :ANA;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Ana no sigue a nadie: el feed le enseña lo público reciente. Un feed en
-- blanco el primer día es la forma más rápida de no volver, y es exactamente
-- el día en que no sigues a nadie.
select pg_temp.assert(
  (select count(*) from public.home_feed()) >= 3,
  'with nobody followed yet, the feed shows what is public');

select pg_temp.assert(
  (select count(*) from public.home_feed() where kind = 'testimony') = 1,
  'and it mixes testimonies in with the requests');

select pg_temp.assert(
  (select author_id from public.home_feed()
    where id = 'bbbb0000-0000-0000-0000-000000000002') is null,
  'an anonymous request carries no author, not even an id');

-- La tarjeta del muro y la del feed son la misma desde que el feed devuelve
-- estas dos. `is_anonymous` se adivinaba por un `author_id` nulo —cierto pero
-- indirecto— y `answered_at` no llegaba de ninguna forma, así que una petición
-- ya respondida se leía en el feed como si siguiera abierta.
select pg_temp.assert(
  (select is_anonymous from public.home_feed()
    where id = 'bbbb0000-0000-0000-0000-000000000002'),
  'and says plainly that it is anonymous, instead of leaving it to be guessed');

select pg_temp.assert(
  (select answered_at from public.home_feed()
    where id = 'bbbb0000-0000-0000-0000-000000000001') is null,
  'an open request has no answered date');

commit;

-- En cuanto sigues a alguien, el feed se estrecha a esa gente.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.follows (follower_id, followee_id) values (:ANA, :BETO);

select pg_temp.assert(
  not exists (
    select 1 from public.home_feed()
    where id = 'bbbb0000-0000-0000-0000-000000000002'
  ),
  'once you follow somebody, the feed is theirs and yours');

select pg_temp.assert(
  exists (
    select 1 from public.home_feed()
    where id = 'bbbb0000-0000-0000-0000-000000000001'
  ),
  'and what they wrote is in it');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

update public.posts set answered_at = now()
 where id = 'bbbb0000-0000-0000-0000-000000000001';

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select answered_at from public.home_feed()
    where id = 'bbbb0000-0000-0000-0000-000000000001') is not null,
  'and a request marked answered reads as answered in the feed too');

commit;

-- Lo de un círculo se lee dentro de su círculo. Sacarlo al feed abierto
-- rompería la promesa de que un círculo privado es privado.
begin;

insert into public.groups (id, owner_id, name, visibility)
values ('cccc0000-0000-0000-0000-00000000000f', :BETO, 'Familia', 'private');

insert into public.posts (id, author_id, group_id, body)
values ('bbbb0000-0000-0000-0000-000000000003', :BETO,
        'cccc0000-0000-0000-0000-00000000000f', 'Solo para los de casa');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not exists (
    select 1 from public.home_feed()
    where id = 'bbbb0000-0000-0000-0000-000000000003'
  ),
  'a circle request never reaches the open feed');

commit;


-- ===========================================================================
-- Lo de una persona, en su perfil
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.person_posts(:BETO)) = 1,
  'a profile lists what that person asked prayer for');

select pg_temp.assert(
  (select count(*) from public.person_posts(:CARLA)) = 0,
  'and never their anonymous ones — a per-person list is exactly how anonymity comes undone');

commit;



-- ===========================================================================
-- Los avisos
--
-- La tabla lleva llenándose desde la Fase 1 —una fila por cada persona que ora
-- por ti— y nunca la había leído nadie. Lo que se prueba aquí no es que se lean
-- sino **de quién**: el aviso lleva el nombre dentro del payload, y la policy
-- de la tabla decide por `user_id` y no sabe nada de bloqueos.
-- ===========================================================================
begin;

insert into public.notifications (user_id, type, payload, dedupe_key)
values
  (:ANA, 'intercession',
   jsonb_build_object('intercessor_id', :BETO, 'intercessor_name', 'Beto',
                      'plan_title', 'Siete días'), 'test:beto'),
  (:ANA, 'intercession',
   jsonb_build_object('intercessor_id', :CARLA, 'intercessor_name', 'María',
                      'plan_title', 'Siete días'), 'test:carla'),
  (:BETO, 'intercession',
   jsonb_build_object('intercessor_id', :ANA, 'intercessor_name', 'Ana'),
   'test:ana');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.my_notifications()) = 2,
  'you see your own notifications and nobody else''s');

select pg_temp.assert(
  public.my_unread_notifications() = 2,
  'and the unread count matches what the screen will show');

select pg_temp.assert(
  public.mark_notifications_read() = 2,
  'marking them read reports how many changed');

select pg_temp.assert(
  public.mark_notifications_read() = 0,
  'and doing it again is not an error — the screen calls it on every open');

select pg_temp.assert(
  public.my_unread_notifications() = 0,
  'and the dot goes away');

commit;

-- Bloquear silencia su mensaje en Hoy y su cara en el chat; sin este filtro su
-- nombre seguiría apareciendo aquí, que es la pantalla que se abre justo cuando
-- alguien quiere dejar de saber de esa persona.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.blocks (blocker_id, blocked_id) values (:ANA, :BETO);

select pg_temp.assert(
  (select count(*) from public.my_notifications()) = 1,
  'a notification from somebody you blocked does not reach you');

select pg_temp.assert(
  not exists (
    select 1 from public.my_notifications()
    where payload ->> 'intercessor_name' = 'Beto'
  ),
  'and it is theirs that is gone, not somebody else''s');

delete from public.blocks where blocker_id = :ANA and blocked_id = :BETO;

commit;

-- Y lo que un cliente no puede hacer: fabricarse un aviso. No hay policy de
-- INSERT para `authenticated`, solo el trigger.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises(format(
    'insert into public.notifications (user_id, type) values (%L, ''intercession'')',
    :CARLA)),
  'nobody can write themselves a notification');

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
