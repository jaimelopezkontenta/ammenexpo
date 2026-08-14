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
-- El plan común del círculo, y su racha
--
-- `prayer_plans.group_id` y `group_prayer_days` llevan desde la Fase 1 con
-- policies y GRANT completos y sin un solo escritor. La regla decidida: cuenta
-- el día si ora **la mitad** del círculo, redondeando hacia arriba, con día de
-- gracia como la racha personal.
-- ===========================================================================

\set CIRCLE_D '''cccc0000-0000-0000-0000-000000000003'''
\set PLAN_D   '''aaaa0000-0000-0000-0000-0000000000e1'''

begin;

insert into public.groups (id, owner_id, name, visibility)
values (:CIRCLE_D, :ANA, 'Célula del jueves', 'private');

insert into public.group_members (group_id, user_id)
values (:CIRCLE_D, :BETO), (:CIRCLE_D, :CARLA), (:CIRCLE_D, :DANI);

commit;

-- Cuatro miembros ⇒ hacen falta dos.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  not public.can_create_circle_plan(:CIRCLE_D),
  'an ordinary member cannot start the circle''s plan');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  public.can_create_circle_plan(:CIRCLE_D),
  'the person who runs it can');

commit;

begin;

insert into public.prayer_plans (id, owner_id, group_id, title, duration_days,
                                 start_date, visibility, status)
values (:PLAN_D, :ANA, :CIRCLE_D, 'Siete días juntos', 7,
        current_date - 6, 'group', 'active');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body,
                                     unlock_date)
select :PLAN_D, n, 'Día ' || n, 'Privado', current_date - 7 + n
from generate_series(1, 7) n;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not public.can_create_circle_plan(:CIRCLE_D),
  'and only one at a time');

-- El índice único parcial es lo que de verdad lo impide: la comprobación de la
-- Edge Function la pueden saltar dos peticiones a la vez.
select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.prayer_plans (owner_id, group_id, title, duration_days,
                                     start_date, visibility, status)
    values ('11111111-1111-1111-1111-111111111111',
            'cccc0000-0000-0000-0000-000000000003', 'Otro', 7,
            current_date, 'group', 'active')
  $q$),
  'and the database refuses a second one even if the check is skipped');

commit;


-- ===========================================================================
-- Marcar el día del círculo
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  public.mark_circle_day(
    (select id from public.prayer_plan_days
      where plan_id = :PLAN_D and day_number = 1)),
  'Beto marks the first day');

-- Una acción, dos registros: `prayer_logs` es lo que mueve su racha personal,
-- `group_prayer_days` lo que el círculo puede leer.
select pg_temp.assert(
  (select count(*) from public.prayer_logs
    where user_id = :BETO
      and plan_day_id = (select id from public.prayer_plan_days
                          where plan_id = :PLAN_D and day_number = 1)) = 1,
  'and it counts for him personally too');

commit;

begin;

select pg_temp.assert(
  (select streak_count from public.profiles where id = :BETO) > 0,
  'so his own streak moves');

-- Con uno solo, en un círculo de cuatro, el día no cuenta.
select pg_temp.assert(
  (select streak_count from public.groups where id = :CIRCLE_D) = 0,
  'one person out of four is not the circle praying');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  public.mark_circle_day(
    (select id from public.prayer_plan_days
      where plan_id = :PLAN_D and day_number = 1)),
  'Carla marks it too');

commit;

begin;

select pg_temp.assert(
  (select streak_count from public.groups where id = :CIRCLE_D) = 1,
  'half the circle is, and the streak opens at one');

commit;

-- Pulsar dos veces no suma dos.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  public.mark_circle_day(
    (select id from public.prayer_plan_days
      where plan_id = :PLAN_D and day_number = 1)),
  'marking the same day again is not an error');

commit;

begin;

select pg_temp.assert(
  (select streak_count from public.groups where id = :CIRCLE_D) = 1,
  'and does not count twice');

commit;


-- ===========================================================================
-- El día de gracia, y lo que sí la rompe
-- ===========================================================================

create or replace function pg_temp.circle_prays(p_day integer)
returns integer language plpgsql as $$
declare v_day uuid;
begin
  select id into v_day from public.prayer_plan_days
   where plan_id = 'aaaa0000-0000-0000-0000-0000000000e1' and day_number = p_day;

  insert into public.group_prayer_days (group_id, plan_day_id, user_id)
  values ('cccc0000-0000-0000-0000-000000000003', v_day,
          '22222222-2222-2222-2222-222222222222'),
         ('cccc0000-0000-0000-0000-000000000003', v_day,
          '33333333-3333-3333-3333-333333333333')
  on conflict do nothing;

  return (select streak_count from public.groups
           where id = 'cccc0000-0000-0000-0000-000000000003');
end;
$$;

begin;

select pg_temp.assert(
  pg_temp.circle_prays(2) = 2,
  'praying the next day carries the streak to two');

-- Se salta el día 3. Con una regla ya exigente —la mitad del círculo, cada
-- día— quitar la gracia significa que un círculo de ocho no sobrevive a un
-- domingo, y una racha que se rompe siempre deja de mirarse.
select pg_temp.assert(
  pg_temp.circle_prays(4) = 3,
  'and one missed day is forgiven, like the personal streak');

-- Dos seguidos no.
select pg_temp.assert(
  pg_temp.circle_prays(7) = 1,
  'but two in a row start it over');

-- Rellenar un día antiguo no puede hacer retroceder la racha ni contarse otra
-- vez: es la trampa de un trigger que solo mira la fila que acaba de entrar.
select pg_temp.assert(
  pg_temp.circle_prays(5) = 1,
  'filling in an older day neither re-counts nor rewinds');

commit;


-- ===========================================================================
-- Quién puede marcar, y qué día
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  not public.mark_circle_day('aaaa0000-0000-0000-0000-0000000000ff'),
  'a day that does not exist cannot be marked');

commit;

-- Alguien que ya no está en el círculo no puede marcar su día aunque conozca
-- el id: es la misma puerta que cierra la expulsión en el chat.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

delete from public.group_members
 where group_id = :CIRCLE_D and user_id = :BETO;

select pg_temp.assert(
  not public.mark_circle_day(
    (select id from public.prayer_plan_days
      where plan_id = :PLAN_D and day_number = 6)),
  'somebody who left the circle cannot mark its day');

commit;


-- ===========================================================================
-- La regla 1, para la tabla que estrena escritor
--
-- Una policy de SELECT que vuelve a consultar su propia tabla rompe los
-- inserts, y Postgres lo reporta igual que un fallo de WITH CHECK.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  not pg_temp.raises($q$
    insert into public.group_prayer_days (group_id, plan_day_id, user_id)
    select 'cccc0000-0000-0000-0000-000000000003', d.id,
           '44444444-4444-4444-4444-444444444444'
    from public.prayer_plan_days d
    where d.plan_id = 'aaaa0000-0000-0000-0000-0000000000e1'
      and d.day_number = 6
    returning group_id
  $q$),
  'insert ... returning works on group_prayer_days');

commit;


-- ===========================================================================
-- Mensajes sin leer
--
-- La membresía del chat se deriva de la del círculo desde este mismo bloque,
-- así que casi nadie tiene fila en `conversation_members`. La marca de lectura
-- se crea cuando hace falta y es solo eso: una marca, no un segundo censo.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.messages (conversation_id, sender_id, body)
values (public.circle_conversation(:CIRCLE_D), :ANA, 'Buenos días, célula');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- Sin marca de lectura, todo lo ajeno está sin leer: es la primera vez que
-- Carla abre ese chat.
select pg_temp.assert(
  (select unread from public.my_unread_counts() where group_id = :CIRCLE_D) = 1,
  'a chat never opened counts as unread');

select public.mark_conversation_read(:CIRCLE_D);

select pg_temp.assert(
  (select unread from public.my_unread_counts() where group_id = :CIRCLE_D) = 0,
  'and opening it clears the count');

commit;

-- Lo propio no cuenta: un punto rojo por lo que acabas de escribir tú es un
-- punto rojo que no se puede quitar.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.messages (conversation_id, sender_id, body)
values (public.circle_conversation(:CIRCLE_D), :CARLA, 'Lo mío');

select pg_temp.assert(
  (select unread from public.my_unread_counts() where group_id = :CIRCLE_D) = 0,
  'your own message does not mark your own chat unread');

commit;

-- Ni lo de alguien a quien has bloqueado, porque esa pantalla no se lo va a
-- enseñar nunca y el punto se quedaría encendido para siempre.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.messages (conversation_id, sender_id, body)
values (public.circle_conversation(:CIRCLE_D), :ANA, 'Algo más');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select unread from public.my_unread_counts() where group_id = :CIRCLE_D) = 1,
  'somebody else writing does mark it unread');

insert into public.blocks (blocker_id, blocked_id) values (:CARLA, :ANA);

select pg_temp.assert(
  (select unread from public.my_unread_counts() where group_id = :CIRCLE_D) = 0,
  'but not once he is blocked, since it will never be shown');

delete from public.blocks where blocker_id = :CARLA and blocked_id = :ANA;

commit;

-- Quien no está dentro no tiene contador que mirar.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.my_unread_counts()
    where group_id = :CIRCLE_D) = 0,
  'somebody who left the circle has no unread count for it');

commit;


-- ===========================================================================
-- Qué se comparte con este círculo
--
-- La consulta inversa —de plan a círculos— existía desde el principio.
-- Círculo→planes no existía en todo el proyecto, así que desde dentro de un
-- círculo no se veía absolutamente nada de lo que pasa en él.
-- ===========================================================================
begin;

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date,
                                 visibility, status)
values ('aaaa0000-0000-0000-0000-0000000000f1', :CARLA, 'Plan de Carla', 3,
        current_date, 'private', 'active');

insert into public.plan_shares (plan_id, group_id, created_by)
values ('aaaa0000-0000-0000-0000-0000000000f1', :CIRCLE_D, :CARLA);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.circle_shared_plans(:CIRCLE_D)) = 1,
  'the circle shows what is shared with it');

-- Saber que estás compartiendo el tuyo ahí importa tanto como ver los de los
-- demás: es lo que responde "¿esta gente está viendo mis peticiones?".
select pg_temp.assert(
  (select is_mine from public.circle_shared_plans(:CIRCLE_D)),
  'and marks your own as yours');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.circle_shared_plans(:CIRCLE_D)) = 0,
  'somebody outside the circle sees nothing of it');

commit;

-- ===========================================================================
-- El cuarto bucle: la oración respondida
--
-- La tabla lleva desde la Fase 1 con RLS completa y sin un solo escritor. Y
-- nacía `is_public default true`: alguien escribe lo más íntimo que tiene y se
-- publica por omisión. Ahora el valor por defecto son los círculos.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.testimonies (user_id, body)
values (:ANA, 'Mi madre salió del hospital ayer.');

-- La assertion que importa. No es un detalle de esquema: es la diferencia
-- entre una app en la que confías y una que te expuso sin preguntarte.
select pg_temp.assert(
  (select visibility from public.testimonies limit 1) = 'circles',
  'a testimony is not public by default');

commit;

-- Eva no está en ningún círculo con nadie: es la única forma de comprobar el
-- caso negativo, porque a estas alturas del fixture todos los demás comparten
-- algo con Ana.
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('55555555-5555-5555-5555-555555555555', 'eva@test.local',
        'authenticated', 'authenticated', '{"display_name":"Eva"}');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.testimonies) = 0,
  'somebody who shares no circle with her sees nothing');

commit;

-- Carla sí: está en la célula del jueves con Ana.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.visible_testimonies()) = 1,
  'somebody who prayed alongside her does see it');

select pg_temp.assert(
  not (select is_mine from public.visible_testimonies()),
  'and it is not marked as hers');

commit;

-- Guardado solo para ti: ni siquiera quien comparte círculo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.testimonies set visibility = 'private';

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.testimonies) = 0,
  'made private, it goes back to being hers alone');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.testimonies) = 1,
  'she can always read her own');

update public.testimonies set visibility = 'public';

commit;

-- Y en público, cualquiera — incluida Eva, que no comparte nada con ella. Si
-- esta assertion usara a alguien de su círculo no tendría dientes: lo leería
-- igual con 'circles'.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.testimonies) = 1,
  'made public, a stranger reads it');

-- Bloquear vale aquí también, y lo resuelve la policy: ninguna pantalla tiene
-- que acordarse.
insert into public.blocks (blocker_id, blocked_id)
values ('55555555-5555-5555-5555-555555555555', :ANA);

select pg_temp.assert(
  (select count(*) from public.testimonies) = 0,
  'unless she blocked her, and no screen has to remember that');

delete from public.blocks
 where blocker_id = '55555555-5555-5555-5555-555555555555';

commit;

-- La regla 1, para la tabla que estrena escritor: una policy de SELECT que
-- decidiera consultando su propia tabla rompería el insert, y Postgres lo
-- reporta igual que un fallo de WITH CHECK.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  not pg_temp.raises($q$
    insert into public.testimonies (user_id, body)
    values ('33333333-3333-3333-3333-333333333333', 'Encontré trabajo.')
    returning id
  $q$),
  'insert ... returning works on testimonies');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.testimonies (user_id, body)
    values ('11111111-1111-1111-1111-111111111111', 'No es mío')
  $q$),
  'and nobody can write one in somebody else''s name');

commit;

-- ===========================================================================
-- Peticiones de oración
--
-- Lo que la gente hace de verdad en un grupo: "oren por la operación de mi
-- madre mañana". Las tablas existen desde la Fase 1 con contadores por trigger
-- y sin una sola pantalla; lo que se prueba aquí es que las herramientas que ya
-- existían —bloquear, ocultar, reportar— alcanzan a esta superficie, que es
-- pública y por tanto la más expuesta que tiene la app.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.posts (id, author_id, body)
values ('9051d000-0000-0000-0000-000000000001', :ANA,
        'Mi madre entra al quirófano mañana.');

insert into public.posts (id, author_id, body, is_anonymous)
values ('9051d000-0000-0000-0000-000000000002', :ANA,
        'Llevo meses sin poder dormir.', true);

insert into public.posts (id, author_id, group_id, body)
values ('9051d000-0000-0000-0000-000000000003', :ANA, :CIRCLE_D,
        'Solo para la célula.');

commit;

-- Eva no comparte nada con Ana y no está en ningún círculo: es exactamente
-- quien tiene que ver el muro abierto y nada más.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_feed()) = 2,
  'the open wall shows the two public requests');

select pg_temp.assert(
  (select count(*) from public.prayer_feed(:CIRCLE_D)) = 0,
  'and a circle she is not in shows her nothing');

-- El anonimato tiene que serlo también para la máquina: devolver el id
-- permitiría correlacionar dos peticiones de la misma persona, que es
-- justo lo que quien la marca anónima está evitando.
select pg_temp.assert(
  (select author_id is null and author_name is null
     from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000002'),
  'an anonymous request gives away neither the name nor the id');

select pg_temp.assert(
  (select author_name from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000001') = 'Ana',
  'and a signed one does say who wrote it');

commit;


-- ===========================================================================
-- Orar por una petición
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

insert into public.post_prayers (post_id, user_id)
values ('9051d000-0000-0000-0000-000000000001',
        '55555555-5555-5555-5555-555555555555');

select pg_temp.assert(
  (select prayer_count from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000001') = 1,
  'praying for a request counts');

select pg_temp.assert(
  (select i_prayed from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000001'),
  'and the screen can tell you already did');

-- Sin esto, "he orado" sería un contador que sube y nunca baja.
delete from public.post_prayers
 where post_id = '9051d000-0000-0000-0000-000000000001'
   and user_id = '55555555-5555-5555-5555-555555555555';

select pg_temp.assert(
  (select prayer_count from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000001') = 0,
  'and undoing it takes the count back down');

commit;

-- No se puede orar por lo que no se puede leer, ni aunque se sepa el id.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.post_prayers (post_id, user_id)
    values ('9051d000-0000-0000-0000-000000000003',
            '55555555-5555-5555-5555-555555555555')
  $q$),
  'you cannot pray for a circle request you cannot read');

commit;


-- ===========================================================================
-- Bloquear alcanza al muro
--
-- Antes de esto, bloquear a alguien lo callaba en el chat, en la pestaña Orar
-- y en los testimonios, y lo dejaba intacto en la superficie más pública que
-- tiene la app.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

insert into public.blocks (blocker_id, blocked_id)
values ('55555555-5555-5555-5555-555555555555', :ANA);

select pg_temp.assert(
  (select count(*) from public.prayer_feed()) = 0,
  'blocking somebody removes their requests from the wall too');

-- Incluida la anónima, aunque quien lee no pueda saber que era suya: lo
-- resuelve la policy, que sí ve la columna.
delete from public.blocks
 where blocker_id = '55555555-5555-5555-5555-555555555555';

select pg_temp.assert(
  (select count(*) from public.prayer_feed()) = 2,
  'and unblocking brings them back');

commit;


-- ===========================================================================
-- Comentar, y ocultar
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

insert into public.comments (post_id, author_id, body)
values ('9051d000-0000-0000-0000-000000000001',
        '55555555-5555-5555-5555-555555555555', 'Orando por ella.');

select pg_temp.assert(
  (select comment_count from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000001') = 1,
  'a comment counts');

select pg_temp.assert(
  (select count(*) from
     public.post_comments('9051d000-0000-0000-0000-000000000001')) = 1,
  'and can be read');

commit;

-- Ocultar solo existe dentro de un círculo, que es donde hay alguien a cargo.
-- En el muro abierto no hay quien administre: lo que queda es reportar y
-- bloquear, y eso hay que decirlo en voz alta y no fingir lo contrario.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not public.hide_post('9051d000-0000-0000-0000-000000000001'),
  'nobody can hide a request on the open wall, not even its author');

select pg_temp.assert(
  public.hide_post('9051d000-0000-0000-0000-000000000003'),
  'but whoever runs a circle can hide one inside it');

commit;

-- Y el comentario, que era la mitad que faltaba: `hide_comment()` existía en la
-- base desde que existen las peticiones y no la llamaba nadie. Ocultar acababa
-- en el mensaje y en la petición, y un comentario —que es donde más fácil es
-- dejar algo feo, porque cuelga de lo que otra persona escribió— no se podía
-- tocar.
-- Una petición nueva del círculo: la de arriba acaba de quedar oculta, y sobre
-- lo oculto ya no se puede ni comentar.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.posts (id, author_id, group_id, body)
values ('9051d000-0000-0000-0000-000000000009', :ANA, :CIRCLE_D,
        'Otra del círculo');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

insert into public.comments (id, post_id, author_id, body)
values ('c0de0000-0000-0000-0000-000000000001',
        '9051d000-0000-0000-0000-000000000009',
        :DANI, 'Algo que sobra aquí');

select pg_temp.assert(
  not public.hide_comment('c0de0000-0000-0000-0000-000000000001'),
  'a member who does not run the circle cannot hide a comment, not even her own');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  public.hide_comment('c0de0000-0000-0000-0000-000000000001'),
  'but whoever runs the circle can');

select pg_temp.assert(
  not exists (
    select 1 from public.post_comments('9051d000-0000-0000-0000-000000000009')
    where id = 'c0de0000-0000-0000-0000-000000000001'
  ),
  'and it stops coming back for everybody, not just for whoever hid it');

-- Se recoge lo que se sacó: la assertion de más abajo cuenta las peticiones que
-- quedan en el círculo, y una prestada para esta prueba la haría fallar.
delete from public.posts where id = '9051d000-0000-0000-0000-000000000009';

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.comments (id, post_id, author_id, body)
values ('c0de0000-0000-0000-0000-000000000002',
        '9051d000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'En el muro abierto');

select pg_temp.assert(
  not public.hide_comment('c0de0000-0000-0000-0000-000000000002'),
  'and on the open wall nobody can hide a comment, same as the request');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_feed(:CIRCLE_D)) = 0,
  'and it is gone for the circle, on reload, not just in one head');

-- Un contador que sigue subiendo sobre algo que ya nadie ve sería una forma
-- rara de que el ocultado no fuera del todo un ocultado.
select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.post_prayers (post_id, user_id)
    values ('9051d000-0000-0000-0000-000000000003',
            '33333333-3333-3333-3333-333333333333')
  $q$),
  'and nobody can pray for it any more');

commit;



-- ===========================================================================
-- El filtro que retiene para revisión
--
-- La cuarta pata de la Guideline 1.2, y la única de la que no había nada.
-- Retiene, no borra: un filtro que traga un mensaje sin decir nada deja a quien
-- lo escribió creyendo que publicó.
-- ===========================================================================
begin;

select pg_temp.assert(
  not public.is_objectionable('Oren por mi madre, está en el hospital'),
  'an ordinary prayer request passes');

select pg_temp.assert(
  public.is_objectionable('eres un IMBÉCIL'),
  'an insult is caught, in caps and with the accent on');

-- El fallo clásico de estos filtros, y la forma más rápida de que la gente
-- aprenda a desconfiar del aviso.
select pg_temp.assert(
  not public.is_objectionable('la reputación de la disputa'),
  'and a word that merely contains another is not');

-- Desde B1b, la crisis vive en su propio clasificador: `is_objectionable` ya
-- no reconoce estas frases, y `is_crisis_text` sí.
select pg_temp.assert(
  not public.is_objectionable('kill yourself'),
  'crisis phrases moved out of the generic filter entirely');

select pg_temp.assert(
  public.is_crisis_text('kill yourself'),
  'and into their own, separate one');

select pg_temp.assert(
  public.is_crisis_text('quiero matarme'),
  'in Spanish too');

select pg_temp.assert(
  not public.is_crisis_text('Oren por mi madre, está en el hospital'),
  'an ordinary prayer request is not a crisis');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

insert into public.posts (id, author_id, body)
values ('9051d000-0000-0000-0000-00000000000f',
        '55555555-5555-5555-5555-555555555555', 'eres un imbecil');

select pg_temp.assert(
  (select held_at from public.posts
    where id = '9051d000-0000-0000-0000-00000000000f') is not null,
  'writing one holds it for review');

-- Quien lo escribió lo sigue viendo, y la RPC le devuelve la marca para que la
-- pantalla pueda decírselo.
select pg_temp.assert(
  (select held_at from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-00000000000f') is not null,
  'and its author still sees it, marked');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not exists (
    select 1 from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-00000000000f'
  ),
  'and nobody else does');

select pg_temp.assert(
  not public.can_read_post('9051d000-0000-0000-0000-00000000000f'),
  'and nothing hangs off it: no comments, no prayers');

commit;

-- Editar tampoco cuela: sin el trigger sobre `update of body`, publicar algo
-- inofensivo y cambiarlo después sería la vuelta obvia.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

insert into public.posts (id, author_id, body)
values ('9051d000-0000-0000-0000-00000000000e',
        '55555555-5555-5555-5555-555555555555', 'Una petición normal');

select pg_temp.assert(
  (select held_at from public.posts
    where id = '9051d000-0000-0000-0000-00000000000e') is null,
  'an innocent request is published');

update public.posts set body = 'kill yourself'
 where id = '9051d000-0000-0000-0000-00000000000e';

select pg_temp.assert(
  (select held_at from public.posts
    where id = '9051d000-0000-0000-0000-00000000000e') is not null,
  'and editing it into something else holds it too');

delete from public.posts
 where id in ('9051d000-0000-0000-0000-00000000000e',
              '9051d000-0000-0000-0000-00000000000f');

commit;

-- ===========================================================================
-- B1a: la cola de lo retenido — reclamar, liberar, retirar
--
-- Hasta aquí el filtro solo sabía retener. Esta sección prueba lo que faltaba:
-- que un falso positivo tenga salida, que uno abusivo se quede fuera para
-- siempre, y que las dos decisiones queden firmadas.
-- ===========================================================================
begin;

-- Nombrar staff a mano, como superusuario: el canal administrativo real
-- (`admin_set_staff`, solo service_role) ya se prueba en rls.sql, y no es lo
-- que este archivo examina.
update public.profiles set is_staff = true where id = :ANA;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

insert into public.posts (id, author_id, body)
values ('9051d000-0000-0000-0000-000000000030',
        '55555555-5555-5555-5555-555555555555', 'eres un idiota');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.held_content_queue()) = 0,
  'a non-staff account sees an empty hold queue, not an error');

commit;

-- El id de la cola solo se puede leer a través de la RPC —la tabla no tiene
-- grant para `authenticated`—, así que se captura aquí, como staff, y viaja
-- de aquí en adelante como variable de psql: es exactamente lo que una
-- pantalla real haría con el `id` que ya trae la fila.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select id as hold30_id from public.held_content_queue()
 where target_id = '9051d000-0000-0000-0000-000000000030' \gset

select pg_temp.assert(
  (select count(*) from public.held_content_queue()
    where target_id = '9051d000-0000-0000-0000-000000000030') = 1,
  'staff sees the held post in the queue');

select pg_temp.assert(
  public.open_hold_count() >= 1,
  'and the badge counts it');

commit;

-- Ahora sí: el extraño intenta reclamar un id que nunca debería tener, y aun
-- teniéndolo, la RPC lo rechaza por no ser staff — no por no saber el id.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  not public.claim_hold(:'hold30_id'),
  'and cannot claim a hold either, even with its id in hand');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  public.claim_hold(:'hold30_id'),
  'staff claims it');

select pg_temp.assert(
  not public.claim_hold(:'hold30_id'),
  'and claiming an already-claimed hold refuses instead of double-booking it');

select pg_temp.assert(
  pg_temp.raises(format($q$ select public.release_hold(%L, '') $q$, :'hold30_id')),
  'releasing without a reason is refused');

select pg_temp.assert(
  public.release_hold(:'hold30_id',
    'false positive: it is an insult about a Bible character, not a person'),
  'staff releases the false positive, with a reason');

select pg_temp.assert(
  (select status from public.held_content_queue(
      array['pending', 'claimed', 'released', 'removed'])
    where id = :'hold30_id') = 'released',
  'the audit trail says released');

select pg_temp.assert(
  (select held_at from public.posts
    where id = '9051d000-0000-0000-0000-000000000030') is null,
  'and the post is not held any more');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  exists (
    select 1 from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000030'
  ),
  'and a stranger can read it again');

commit;

-- El segundo caso: retirado, no liberado.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

insert into public.posts (id, author_id, body)
values ('9051d000-0000-0000-0000-000000000031',
        '55555555-5555-5555-5555-555555555555', 'zorra');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select id as hold31_id from public.held_content_queue()
 where target_id = '9051d000-0000-0000-0000-000000000031' \gset

select pg_temp.assert(
  public.remove_hold(:'hold31_id', 'targeted harassment, not a false positive'),
  'staff retires the abusive one instead');

select pg_temp.assert(
  (select status from public.held_content_queue(
      array['pending', 'claimed', 'released', 'removed'])
    where id = :'hold31_id') = 'removed',
  'the audit trail says removed, not released');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  not exists (
    select 1 from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000031'
  ),
  'a stranger never sees the removed one');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

-- A propósito no se libera `held_at`: el autor sigue leyendo "en revisión",
-- nunca lo contrario de la verdad, que sería que se publicó con normalidad.
select pg_temp.assert(
  (select held_at from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000031') is not null,
  'its own author still sees it as held, never as a normal, published post');

commit;

-- ===========================================================================
-- B1b: crisis, separada del filtro genérico desde la raíz
--
-- Antes de esta migración, "quiero matarme" entraba en la misma cola que un
-- insulto. Esta sección prueba que ya no: ni comparte clasificador, ni
-- comparte cola, ni espera turno detrás del espam.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

insert into public.posts (id, author_id, body)
values ('9051d000-0000-0000-0000-000000000032',
        '55555555-5555-5555-5555-555555555555', 'quiero matarme');

select pg_temp.assert(
  (select crisis_flagged_at from public.posts
    where id = '9051d000-0000-0000-0000-000000000032') is not null,
  'a crisis phrase is flagged as crisis');

select pg_temp.assert(
  (select held_at from public.posts
    where id = '9051d000-0000-0000-0000-000000000032') is not null,
  'and still never appears as a normal published post');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  not exists (
    select 1 from public.prayer_feed()
    where id = '9051d000-0000-0000-0000-000000000032'
  ),
  'a stranger does not see it either');

select pg_temp.assert(
  (select count(*) from public.crisis_queue()) = 0,
  'a non-staff account sees an empty crisis queue');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not exists (
    select 1 from public.held_content_queue(array['pending', 'claimed'])
    where target_id = '9051d000-0000-0000-0000-000000000032'
  ),
  'the generic hold queue never receives a crisis case');

select id as crisis32_id from public.crisis_queue()
 where target_id = '9051d000-0000-0000-0000-000000000032' \gset

select pg_temp.assert(
  (select count(*) from public.crisis_queue()
    where target_id = '9051d000-0000-0000-0000-000000000032') = 1,
  'it lands in the crisis queue instead');

select pg_temp.assert(
  public.open_crisis_count() >= 1,
  'and the guard badge counts it');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  not public.acknowledge_crisis(:'crisis32_id', 'attempted by a stranger'),
  'and a non-staff account cannot acknowledge one either');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises(format($q$ select public.acknowledge_crisis(%L, '') $q$, :'crisis32_id')),
  'acknowledging without a note is refused');

select pg_temp.assert(
  public.acknowledge_crisis(:'crisis32_id',
    'reached out directly, they are safe with family tonight'),
  'staff acknowledges the escalation, with a note');

select pg_temp.assert(
  (select acknowledged_by from public.crisis_queue(null, 50)
    where id = :'crisis32_id') = :ANA,
  'and the acknowledgement is attributed');

commit;

-- ===========================================================================
-- La regla 1, para tres tablas que estrenan escritor
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  not pg_temp.raises($q$
    insert into public.posts (author_id, body)
    values ('33333333-3333-3333-3333-333333333333', 'Una petición mía')
    returning id
  $q$),
  'insert ... returning works on posts');

select pg_temp.assert(
  not pg_temp.raises($q$
    insert into public.post_prayers (post_id, user_id)
    values ('9051d000-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333')
    returning post_id
  $q$),
  'and on post_prayers');

select pg_temp.assert(
  not pg_temp.raises($q$
    insert into public.comments (post_id, author_id, body)
    values ('9051d000-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333', 'Aquí estoy')
    returning id
  $q$),
  'and on comments');

commit;

-- ===========================================================================
-- El perfil de otra persona
--
-- Hasta aquí, quien ora por ti era una cadena de texto. Esto le da un sitio.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select display_name from public.public_profile(:ANA)) = 'Ana',
  'Carla can open the profile of somebody who prayed for her');

select pg_temp.assert(
  (select shares_circle from public.public_profile(:ANA)),
  'and it says they are in a circle together');

select pg_temp.assert(
  (select member_since from public.public_profile(:ANA)) is not null,
  'and since when she has been here');

select pg_temp.assert(
  not (select is_me from public.public_profile(:ANA)),
  'and that it is not her own');

commit;

-- La racha no viaja. Está en `profiles` y devolverla sería trivial, pero la
-- racha de este producto es indulgente a propósito para que no apriete;
-- publicarla la convierte en un marcador. En tu perfil es motivación, en el de
-- otra persona es comparación.
begin;

select pg_temp.assert(
  not exists (
    select 1
    from information_schema.routines r
    join information_schema.parameters p
      on p.specific_name = r.specific_name
    where r.routine_name = 'public_profile'
      and p.parameter_name in ('streak_count', 'streak_last_day')
  ),
  'and it does not carry their streak');

commit;

-- Bloquear es de una sola dirección en toda la app y aquí también, para no
-- inventar una regla distinta en una pantalla suelta.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.blocks (blocker_id, blocked_id) values (:CARLA, :ANA);

select pg_temp.assert(
  (select count(*) from public.public_profile(:ANA)) = 0,
  'somebody you blocked has no profile to open');

commit;

-- Y a quien bloquea no se le cierra nada: el bloqueo es silencioso.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.public_profile(:CARLA)) = 1,
  'but she can still open theirs, because blocking says nothing to them');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

delete from public.blocks where blocker_id = :CARLA;

commit;

-- Alguien con quien no compartes nada sigue teniendo perfil —lo necesitas para
-- decidir si le bloqueas tras leer algo suyo en el muro abierto— pero se dice
-- que no compartís círculo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.public_profile(:ANA)) = 1,
  'a stranger from the open wall still has a profile to check');

select pg_temp.assert(
  not (select shares_circle from public.public_profile(:ANA)),
  'and it says plainly that they share no circle');

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
