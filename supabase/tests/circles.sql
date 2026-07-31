\set ON_ERROR_STOP on

-- Bloque D: descubrir un círculo público, hablar dentro de él, y las tres
-- salidas que tiene que haber cuando alguien hace daño — bloquear, ocultar y
-- expulsar. Se prueban juntas porque se abrieron juntas: el buscador es lo que
-- mete desconocidos en la sala.

\set ANA   '''11111111-1111-1111-1111-111111111111'''
\set BETO  '''22222222-2222-2222-2222-222222222222'''
\set CARLA '''33333333-3333-3333-3333-333333333333'''
\set DANI  '''44444444-4444-4444-4444-444444444444'''

\set CIRCLE_PUB  '''cccc0000-0000-0000-0000-000000000001'''
\set CIRCLE_PRIV '''cccc0000-0000-0000-0000-000000000002'''

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
  (:CARLA, 'carla@test.local', 'authenticated', 'authenticated', '{"display_name":"Carla"}'),
  (:DANI,  'dani@test.local',  'authenticated', 'authenticated', '{"display_name":"Dani"}');

insert into public.groups (id, owner_id, name, description, visibility)
values
  (:CIRCLE_PUB, :ANA, 'Círculo de Oración de la Mañana',
   'Oramos juntos al empezar el día', 'public'),
  (:CIRCLE_PRIV, :ANA, 'Familia Rodríguez', 'Solo nosotros', 'private');

commit;


-- ===========================================================================
-- El chat existe desde que existe el círculo
--
-- Sin el trigger habría una pantalla de chat y ninguna conversación detrás, y
-- el fallo aparecería en el primer mensaje que alguien intentara mandar.
-- ===========================================================================
begin;

select pg_temp.assert(
  (select count(*) from public.conversations where group_id = :CIRCLE_PUB) = 1,
  'creating a circle creates its conversation');

commit;


select id as conv_pub from public.conversations
 where group_id = 'cccc0000-0000-0000-0000-000000000001' \gset


-- ===========================================================================
-- La promesa que llevaba publicada desde el principio
--
-- "Aparecerá en las búsquedas" lo decía circulos.tsx sin que hubiera búsqueda.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.search_public_circles('oración')) = 1,
  'Beto finds a public circle he is not in');

-- Lo que de verdad hace falta en un teclado de móvil, y lo mismo que se fijó
-- para la Biblia: el acento no puede ser un requisito para encontrar algo.
select pg_temp.assert(
  (select count(*) from public.search_public_circles('oracion')) = 1,
  'and finds it typing without the accent');

-- Una caja de búsqueda filtra mientras escribes. Sin el prefijo `:*` habría
-- que escribir la palabra entera para que apareciera nada.
select pg_temp.assert(
  (select count(*) from public.search_public_circles('orac')) = 1,
  'and while still typing the word');

select pg_temp.assert(
  (select count(*) from public.search_public_circles('mañana')) = 1,
  'the eñe survives the round trip');

-- Y sin ella, que es como se escribe en un teclado de móvil. Esto lo encontró
-- el navegador y no el test: yo escribía `mañana` con la eñe puesta.
select pg_temp.assert(
  (select count(*) from public.search_public_circles('oracion manana')) = 1,
  'and typing manana finds Mañana');

-- El círculo privado es privado: no está en el directorio ni por su nombre
-- exacto. Es la mitad de la promesa que más importa.
select pg_temp.assert(
  (select count(*) from public.search_public_circles('Rodríguez')) = 0,
  'a private circle never appears in the directory');

select pg_temp.assert(
  (select is_member from public.search_public_circles('oración')) = false,
  'and Beto is told he is not in it yet');

-- Buscar y recibir cero se lee como "no hay ninguno". Con la consulta vacía o
-- reducida a palabras vacías, lo honesto es enseñar el directorio.
select pg_temp.assert(
  (select count(*) from public.search_public_circles('')) = 1,
  'an empty query browses instead of filtering');

select pg_temp.assert(
  (select count(*) from public.search_public_circles('de la')) = 1,
  'and so does a query that is nothing but stopwords');

-- Toda la razón de limpiar la entrada a mano en vez de pasarla a to_tsquery.
select pg_temp.assert(
  not pg_temp.raises($q$ select * from public.search_public_circles('a & | b') $q$),
  'punctuation does not raise');

select pg_temp.assert(
  not pg_temp.raises($q$ select * from public.search_public_circles('"sin cerrar') $q$),
  'nor an unclosed quote');

select pg_temp.assert(
  not pg_temp.raises($q$ select * from public.search_public_circles(':::') $q$),
  'nor colons, which is what to_tsquery chokes on');

commit;


-- ===========================================================================
-- El token de invitación deja de viajar con la fila
--
-- La policy de SELECT deja leer *cualquier* círculo público. Con el GRANT de
-- tabla entera, el directorio nuevo le habría entregado a cualquiera el token
-- de todos los círculos públicos en la misma consulta.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$ select invite_token from public.groups $q$),
  'the invite token is no longer a readable column');

select pg_temp.assert(
  (select public.circle_invite_token(:CIRCLE_PUB)) is null,
  'and a non-member gets nothing from the function either');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select public.circle_invite_token(:CIRCLE_PRIV)) is not null,
  'Ana can still get the token to invite people to her circle');

commit;


-- ===========================================================================
-- Beto entra, y el chat se le abre sin escribir una fila de membresía
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into public.group_members (group_id, user_id)
values (:CIRCLE_PUB, :BETO);

select pg_temp.assert(
  (select public.circle_conversation(:CIRCLE_PUB)) is not null,
  'joining the circle is joining the chat — no conversation_members row');

insert into public.messages (conversation_id, sender_id, body)
values (public.circle_conversation(:CIRCLE_PUB), :BETO, 'Buenos días a todos');

select pg_temp.assert(
  (select count(*) from public.circle_messages(:CIRCLE_PUB)) = 1,
  'and he can write in it');

commit;

-- Carla no está dentro. Que el círculo sea público no hace público el chat.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.circle_messages(:CIRCLE_PUB)) = 0,
  'a stranger who can see the circle cannot read what is said inside');

-- Con el id de la conversación en la mano, para que el intento sea real: un
-- `insert ... select` desde fuera del círculo no inserta nada *y tampoco
-- falla*, porque la propia lectura devuelve cero filas. Habría pasado el test
-- sin que la policy de INSERT llegara a evaluarse.
select pg_temp.assert(
  pg_temp.raises(format($q$
    insert into public.messages (conversation_id, sender_id, body)
    values (%L, '33333333-3333-3333-3333-333333333333', 'hola')
  $q$, :'conv_pub')),
  'nor write in it');

commit;


-- ===========================================================================
-- Bloquear
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.group_members (group_id, user_id)
values (:CIRCLE_PUB, :CARLA);

select pg_temp.assert(
  (select count(*) from public.circle_messages(:CIRCLE_PUB)) = 1,
  'Carla joins and reads what Beto wrote');

insert into public.blocks (blocker_id, blocked_id) values (:CARLA, :BETO);

select pg_temp.assert(
  (select count(*) from public.circle_messages(:CIRCLE_PUB)) = 0,
  'she blocks him and his messages are gone for her');

commit;

-- Y solo para ella. Bloquear no es moderar: no le quita la voz a nadie.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.circle_messages(:CIRCLE_PUB)) = 1,
  'Beto still sees his own message, and is never told');

commit;

-- Bloquearse a uno mismo dejaría a alguien sin poder leer su propio chat.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.blocks (blocker_id, blocked_id)
    values ('33333333-3333-3333-3333-333333333333',
            '33333333-3333-3333-3333-333333333333')
  $q$),
  'you cannot block yourself');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.blocks (blocker_id, blocked_id)
    values ('11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222')
  $q$),
  'nor block on somebody else''s behalf');

commit;


-- ===========================================================================
-- Bloquear vale en toda la app, no solo en el chat
--
-- Si solo callara el chat, a Carla le seguiría llegando "Beto oró por ti" con
-- su mensaje, y el plan de Beto seguiría en su pestaña Orar. Eso no es lo que
-- alguien entiende al pulsar "bloquear".
-- ===========================================================================
begin;

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values ('aaaa0000-0000-0000-0000-00000000000b', :BETO, 'Plan de Beto', 3,
        current_date, 'private', 'active');

insert into public.prayer_plan_days (id, plan_id, day_number, title,
                                     prayer_body, unlock_date)
values ('dddd0000-0000-0000-0000-00000000000b',
        'aaaa0000-0000-0000-0000-00000000000b', 1, 'Su día', 'Privado',
        current_date);

insert into public.plan_shares (plan_id, group_id, created_by)
values ('aaaa0000-0000-0000-0000-00000000000b', :CIRCLE_PUB, :BETO);

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values ('aaaa0000-0000-0000-0000-00000000000c', :CARLA, 'Plan de Carla', 3,
        current_date, 'private', 'active');

insert into public.prayer_plan_days (id, plan_id, day_number, title,
                                     prayer_body, unlock_date)
values ('dddd0000-0000-0000-0000-00000000000c',
        'aaaa0000-0000-0000-0000-00000000000c', 1, 'Su día', 'Privado',
        current_date);

insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id,
                                  message)
values ('dddd0000-0000-0000-0000-00000000000c', :CARLA, :BETO, 'Oré por ti');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.who_prayed_for_me()) = 0,
  'a blocked person does not appear among those who prayed for you');

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()
    where owner_id = '22222222-2222-2222-2222-222222222222') = 0,
  'and his plan is not on the Orar tab either');

commit;

-- Que se pueda deshacer importa tanto como que funcione: bloquear en caliente
-- y no poder volver atrás es su propia trampa.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

delete from public.blocks where blocked_id = :BETO;

select pg_temp.assert(
  (select count(*) from public.who_prayed_for_me()) = 1,
  'unblocking brings him back');

commit;


-- ===========================================================================
-- Ocultar un mensaje
--
-- Bloquear es de quien lo sufre; ocultar es del círculo. Lo hace quien
-- administra y vale para todos, incluido quien lo escribió.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select public.hide_message(
     (select id from public.messages limit 1))) = false,
  'an ordinary member cannot hide what somebody else wrote');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select public.hide_message(
     (select id from public.messages
       where sender_id = '22222222-2222-2222-2222-222222222222'
       limit 1))) = true,
  'Ana, who runs the circle, can');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.circle_messages(:CIRCLE_PUB)) = 0,
  'and it is gone for everyone, on reload, not just in the reporter''s head');

commit;


-- ===========================================================================
-- Expulsar, y a quién no se puede expulsar
--
-- La policy de DELETE dejaba a cualquier admin borrar cualquier fila del
-- censo, incluida la de quien creó el círculo — sin vuelta atrás, porque
-- readmitir exige ser admin.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.group_members set role = 'admin'
 where group_id = :CIRCLE_PUB and user_id = :BETO;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    delete from public.group_members
    where group_id = 'cccc0000-0000-0000-0000-000000000001'
      and user_id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'an admin cannot throw the owner out of her own circle');

delete from public.group_members
 where group_id = :CIRCLE_PUB and user_id = :CARLA;

select pg_temp.assert(
  (select count(*) from public.group_members
    where group_id = :CIRCLE_PUB and user_id = :CARLA) = 0,
  'but he can remove an ordinary member');

commit;

-- Expulsar tiene que cerrar la puerta del chat en el mismo instante. Es la
-- razón de derivar la membresía en vez de llevar dos censos.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select public.circle_conversation(:CIRCLE_PUB)) is null,
  'and she loses the chat the moment she is removed');

commit;

-- El dueño sí puede irse: es él decidiendo, no otro decidiendo por él.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not pg_temp.raises($q$
    delete from public.group_members
    where group_id = 'cccc0000-0000-0000-0000-000000000002'
      and user_id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'the owner can still walk out on her own');

commit;


-- ===========================================================================
-- RLS sigue puesta en todas las tablas
--
-- `blocks` es nueva, y una tabla sin RLS en este esquema significa que
-- cualquiera lee a quién ha bloqueado quién.
-- ===========================================================================
begin;

select pg_temp.assert(
  (select count(*)
     from pg_tables t
     join pg_class c on c.relname = t.tablename
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where t.schemaname = 'public' and not c.relrowsecurity) = 0,
  'RLS is enabled on every table in the public schema, blocks included');

commit;

\echo '===================================='
\echo ' CIRCLE ASSERTIONS PASSED'
\echo '===================================='
