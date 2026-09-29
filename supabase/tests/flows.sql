\set ON_ERROR_STOP on

-- Acquisition loop: a stranger opens a shared plan, signs up, and must end up
-- genuinely connected to the person who shared it.

\set ANA  '''11111111-1111-1111-1111-111111111111'''
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
  (:ANA,   'ana2@test.local',   'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:CARLA, 'carla@test.local',  'authenticated', 'authenticated', '{}');

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility)
values ('aaaa0000-0000-0000-0000-000000000009', :ANA, 'Plan de Ana', 2,
        current_date, 'link');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body, unlock_date)
values ('aaaa0000-0000-0000-0000-000000000009', 1, 'Día uno', 'Privado', current_date),
       ('aaaa0000-0000-0000-0000-000000000009', 2, 'Día dos', 'Privado', current_date + 1);

insert into public.share_links (token, scope, plan_id, created_by)
values ('shared-with-carla', 'plan', 'aaaa0000-0000-0000-0000-000000000009', :ANA);

-- Carla arrived through the link before she had an account; the web preview
-- stashed the token on her settings row at signup.
update public.profile_settings
   set pending_share_token = 'shared-with-carla'
 where id = :CARLA;

commit;

-- ===========================================================================
-- Before onboarding: Carla is a stranger
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plans) = 0,
  'before redeeming, Carla cannot see the shared plan');

commit;

-- ===========================================================================
-- Onboarding redeems the token
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (public.complete_onboarding(
     'Carla',
     '{"seasons":["work"],"topics":["peace"]}'::jsonb,
     'America/Mexico_City',
     array[7]::smallint[],
     'es') ->> 'ok') = 'true',
  'complete_onboarding succeeds');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plans) = 1,
  'after redeeming, Carla sees the shared plan');

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days) = 1,
  'Carla sees today only, not tomorrow');

select pg_temp.assert(
  (select display_name from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 'Carla',
  'display name was saved');

select pg_temp.assert(
  (select reminder_hours from public.profile_settings
    where id = '33333333-3333-3333-3333-333333333333') = array[7]::smallint[],
  'reminder hour was saved');

select pg_temp.assert(
  (select onboarding_answers is not null from public.profile_settings
    where id = '33333333-3333-3333-3333-333333333333'),
  'onboarding answers were saved');

select pg_temp.assert(
  (select pending_share_token is null from public.profile_settings
    where id = '33333333-3333-3333-3333-333333333333'),
  'pending token was consumed, so it cannot be replayed');

-- Antes esto comprobaba `are_friends`, y la amistad era invisible: se creaba
-- sola y no se podía ni ver ni deshacer. Ahora Carla sigue a Ana — en una
-- dirección, y con un botón para dejar de hacerlo.
select pg_temp.assert(
  exists (
    select 1 from public.follows
    where follower_id = '33333333-3333-3333-3333-333333333333'
      and followee_id = '11111111-1111-1111-1111-111111111111'
  ),
  'Carla now follows the person whose link she opened');

select pg_temp.assert(
  not exists (
    select 1 from public.follows
    where follower_id = '11111111-1111-1111-1111-111111111111'
      and followee_id = '33333333-3333-3333-3333-333333333333'
  ),
  'and only in that direction: Ana was not made to follow anybody');

-- The whole point of the loop: Carla can pray for Ana's day right away.
insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id)
select d.id, '11111111-1111-1111-1111-111111111111',
       '33333333-3333-3333-3333-333333333333'
from public.prayer_plan_days d limit 1;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.intercessions) = 1,
  'Ana sees that Carla prayed for her');

select pg_temp.assert(
  (select count(*) from public.notifications where type = 'intercession') = 1,
  'Ana got the notification that closes the loop');

commit;

-- ===========================================================================
-- Invalid tokens fail closed
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (public.redeem_share_token('not-a-real-token') ->> 'ok') = 'false',
  'an unknown share token is rejected');

commit;

-- ===========================================================================
-- The share screen: an owner creates, revokes, and nobody else can
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.share_links (scope, plan_id, created_by)
values ('plan', 'aaaa0000-0000-0000-0000-000000000009', :ANA);

select pg_temp.assert(
  (select count(*) from public.share_links where created_by = :ANA) = 2,
  'the owner can create a share link from the client');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

update public.share_links set revoked_at = now() where token = 'shared-with-carla';

-- Not an error, just zero rows: the policy hides them from her entirely.
select pg_temp.assert(
  (select revoked_at is null from public.share_links where token = 'shared-with-carla') is null,
  'someone else cannot revoke a link they did not create');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select revoked_at from public.share_links where token = 'shared-with-carla') is null,
  'and the link really is still live');

update public.share_links set revoked_at = now() where token = 'shared-with-carla';

select pg_temp.assert(
  (select count(*) from public.get_shared_plan_preview('shared-with-carla')) = 0,
  'once the owner revokes it, the public preview closes');

commit;

-- ===========================================================================
-- Un enlace abierto por alguien que ya tiene cuenta
--
-- El canje vivía en un solo sitio: `complete_onboarding()`, que solo corre la
-- primera vez. Quien ya tenía cuenta —o quien tenía que confirmar el correo y
-- volvía por `entrar`— dejaba el token en el almacenamiento del dispositivo y
-- nadie lo volvía a leer jamás. La invitación desaparecía sin decir nada, y la
-- persona aterrizaba en "Aún no tienes un plan", a una pestaña de distancia de
-- aquello por lo que había venido.
--
-- El cliente lo canjea ahora en cualquier inicio de sesión. Esto fija la parte
-- del servidor de la que depende: que la RPC funcione fuera del onboarding y
-- que repetirla no rompa nada.
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('44444444-4444-4444-4444-444444444444', 'dani@test.local',
        'authenticated', 'authenticated', '{"display_name":"Dani"}');

-- Dani hizo el onboarding hace meses: ese camino ya no va a volver a pasar
-- por su cuenta.
update public.profile_settings
   set onboarding_answers = '{"topics":["peace"]}'::jsonb
 where id = '44444444-4444-4444-4444-444444444444';

insert into public.share_links (token, scope, plan_id, created_by)
values ('enlace-para-dani', 'plan',
        'aaaa0000-0000-0000-0000-000000000009', :ANA);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()) = 0,
  'Dani starts with nothing shared with her');

select pg_temp.assert(
  (public.redeem_share_token('enlace-para-dani') ->> 'ok')::boolean,
  'and can redeem a link without ever going through onboarding again');

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()) = 1,
  'so the plan she came for is on her Orar tab');

-- El cliente lo intenta en cada inicio de sesión hasta que lo consigue, así
-- que repetirlo tiene que ser inofensivo.
select pg_temp.assert(
  (public.redeem_share_token('enlace-para-dani') ->> 'ok')::boolean,
  'redeeming the same link twice is not an error');

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()) = 1,
  'and does not duplicate the share');

-- La assertion que protege el borrado de `friendships`. El acceso al plan lo
-- daba `plan_shares` y no la amistad, pero eso era una creencia hasta que se
-- escribió aquí: si quitar los amigos hubiera cerrado un acceso, esta línea es
-- la que lo habría dicho.
select pg_temp.assert(
  public.can_read_plan('aaaa0000-0000-0000-0000-000000000009'),
  'and the plan stays readable with no friendship anywhere in the schema');

commit;

-- Un enlace muerto responde `ok:false` sin lanzar excepción: es lo que permite
-- al cliente distinguir "este enlace ya no vale, deja de intentarlo" de "se
-- cayó la red, guárdalo para la próxima".
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  not (public.redeem_share_token('no-existe') ->> 'ok')::boolean,
  'a dead token answers no without raising');

commit;

-- ===========================================================================
-- El botón que decía que sí sin hacer nada
--
-- `complete_onboarding` actualizaba `profile_settings` sin mirar cuántas filas
-- había tocado y terminaba devolviendo `ok:true` igualmente. Sin fila, escribía
-- cero y contestaba que todo bien; `bienvenida.tsx` no navega por su cuenta, y
-- lo único que saca a alguien de ahí es que `hasOnboarded` cambie. Resultado:
-- el botón gira, para, y la persona se queda encerrada en el onboarding sin un
-- error ni una línea en consola.
--
-- La assertion de arriba —`-> 'ok' = 'true'`— no lo habría cazado nunca: es una
-- constante, y pasaría igual contra una función que no hiciera absolutamente
-- nada. Esta sí.
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('55555555-5555-5555-5555-555555555555', 'sinfila@test.local',
        'authenticated', 'authenticated', '{"display_name":"Sin fila"}');

-- `handle_new_user()` crea la fila de settings junto con la del perfil, así que
-- toda cuenta real tiene la suya. Borrarla reproduce lo único que hace que
-- falte de verdad: una sesión que apunta a un usuario que ya no existe.
delete from public.profile_settings
 where id = '55555555-5555-5555-5555-555555555555';

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    select public.complete_onboarding(
      'Sin fila',
      '{"seasons":["anxiety"],"topics":["peace"]}'::jsonb,
      'UTC',
      array[8]::smallint[],
      'es')
  $q$),
  'onboarding fails loudly when there is no settings row to write');

commit;


-- ===========================================================================
-- Varias horas al día, hasta tres
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (public.complete_onboarding(
     'Carla',
     '{"seasons":["anxiety","work"],"topics":["peace","hope"]}'::jsonb,
     'America/Mexico_City',
     array[6, 12, 21]::smallint[],
     'es') ->> 'ok') = 'true',
  'three prayer times a day is allowed');

select pg_temp.assert(
  (select reminder_hours from public.profile_settings
    where id = '33333333-3333-3333-3333-333333333333') = array[6, 12, 21]::smallint[],
  'and all three are stored');

commit;

-- El tope vive en la base y no solo en la pantalla: sin él, cada hora extra
-- será un aviso diario más cuando llegue el push.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profile_settings
       set reminder_hours = array[6, 9, 12, 21]::smallint[]
     where id = '33333333-3333-3333-3333-333333333333'
  $q$),
  'a fourth prayer time is refused');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profile_settings
       set reminder_hours = array[24]::smallint[]
     where id = '33333333-3333-3333-3333-333333333333'
  $q$),
  'and so is an hour that does not exist');

  update public.profile_settings
     set reminder_hours = array[]::smallint[]
   where id = '33333333-3333-3333-3333-333333333333';

  select pg_temp.assert(
    (select reminder_hours from public.profile_settings
      where id = '33333333-3333-3333-3333-333333333333') = array[]::smallint[],
    'and none at all is allowed: reminders are not sent today');

commit;

\echo ''

-- ===========================================================================
-- Invitar a alguien a Ammen
--
-- `invites` se podía canjear desde la Fase 1 y **nada insertaba una fila**, así
-- que no podía existir un código que canjear. Esto prueba la mitad que faltaba.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- La regla 1: una policy de SELECT que consultara su propia tabla rompería este
-- `returning`, y es como se lee el código recién creado.
with created as (
  insert into public.invites (inviter_id)
  values ('11111111-1111-1111-1111-111111111111')
  returning code
)
select pg_temp.assert(
  (select length(code) from created) > 8,
  'creating an invite hands back its code (rule 1)');

commit;

select code as invite_code from public.invites
 where inviter_id = '11111111-1111-1111-1111-111111111111' \gset

-- La vista previa la abre alguien **sin cuenta**: es el punto entero de una
-- invitación. Devuelve el nombre y nada más — ni el id de quien invita, ni
-- cuántas veces se ha usado el código.
begin;
set local role anon;

select pg_temp.assert(
  (select inviter_name from public.get_invite_preview(:'invite_code')) = 'Ana',
  'somebody with no account can see who invited them');

select pg_temp.assert(
  (select count(*) from public.get_invite_preview('no-existe')) = 0,
  'and a code that does not exist says nothing at all');

commit;

-- Canjear conecta, y desde el bloque S conectar es seguir: en una dirección, y
-- deshacible con un toque.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  (public.redeem_invite_code(:'invite_code') ->> 'ok')::boolean,
  'redeeming an invite works');

select pg_temp.assert(
  exists (
    select 1 from public.follows
    where follower_id = '44444444-4444-4444-4444-444444444444'
      and followee_id = '11111111-1111-1111-1111-111111111111'
  ),
  'and whoever came in follows whoever invited them');

-- Un código que circula por un grupo de WhatsApp no puede apagarse con la
-- primera persona que lo usa.
select pg_temp.assert(
  (public.redeem_invite_code(:'invite_code') ->> 'ok')::boolean,
  'and the code keeps working after the first acceptance');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not (public.redeem_invite_code(:'invite_code') ->> 'ok')::boolean,
  'but you cannot redeem your own');

commit;


-- ===========================================================================
-- Rotar el código propio (Oleada 4d)
--
-- Un código que circula donde no debía se cambia: el viejo deja de canjearse
-- en el acto, el de los demás no se toca, y lo que ya pasó (quién aceptó) se
-- queda.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Un doble toque en «crear» deja a Ana con dos códigos.
insert into public.invites (inviter_id) values ('11111111-1111-1111-1111-111111111111');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.invites (inviter_id) values ('33333333-3333-3333-3333-333333333333');

commit;

select code as ana_second_code from public.invites
 where inviter_id = '11111111-1111-1111-1111-111111111111'
   and code <> :'invite_code' \gset
select code as carla_code from public.invites
 where inviter_id = '33333333-3333-3333-3333-333333333333' \gset

-- Una invitación por correo con el código viejo, todavía en cola.
insert into public.email_outbox (template, to_email, channel, payload, idempotency_key)
values ('invite_app', 'en-cola@test.local', 'S',
        jsonb_build_object('inviter_name', 'Ana', 'token', :'invite_code'),
        'flows-rotate-pending');

select pg_temp.assert(
  not has_function_privilege('anon', 'public.rotate_my_invite_code()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.rotate_my_invite_code()', 'EXECUTE'),
  'rotating your invite code needs a session');

begin;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$ select public.rotate_my_invite_code() $q$),
  'and a caller with no user behind it is refused');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.rotate_my_invite_code() as ana_new_code \gset

commit;

select pg_temp.assert(
  :'ana_new_code' not in (:'invite_code', :'ana_second_code')
    and length(:'ana_new_code') > 8,
  'rotating hands back a new code');

select pg_temp.assert(
  (select code from public.invites
    where inviter_id = '11111111-1111-1111-1111-111111111111'
    order by created_at, id limit 1) = :'ana_new_code',
  'the one the app shows (her oldest row)');

select pg_temp.assert(
  (select count(*) from public.invites
    where inviter_id = '11111111-1111-1111-1111-111111111111') = 2
  and not exists (
    select 1 from public.invites where code in (:'invite_code', :'ana_second_code')),
  'every code of hers changes, the double-tap one too, without adding rows');

select pg_temp.assert(
  exists (
    select 1 from public.invites
     where inviter_id = '11111111-1111-1111-1111-111111111111'
       and accepted_by = '44444444-4444-4444-4444-444444444444'),
  'and who already accepted her invitation stays recorded');

begin;
set local role anon;

select pg_temp.assert(
  (select count(*) from public.get_invite_preview(:'invite_code')) = 0
    and (select inviter_name from public.get_invite_preview(:'ana_new_code')) = 'Ana',
  'the old code previews nothing; the new one says who invites');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  public.redeem_invite_code(:'invite_code') ->> 'reason' = 'invalid'
    and public.redeem_invite_code(:'ana_second_code') ->> 'reason' = 'invalid',
  'the old codes stop redeeming at once');

select pg_temp.assert(
  (public.redeem_invite_code(:'ana_new_code') ->> 'ok')::boolean,
  'and the new one works');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (public.redeem_invite_code(:'carla_code') ->> 'ok')::boolean,
  'somebody else''s code still works');

commit;

select pg_temp.assert(
  (select code from public.invites
    where inviter_id = '33333333-3333-3333-3333-333333333333') = :'carla_code',
  'because rotating did not touch it');

select pg_temp.assert(
  exists (select 1 from public.share_links where token = 'shared-with-carla'),
  'and a shared plan link is not an invite code: rotating leaves it alone');

select pg_temp.assert(
  (select (status, last_error)::text from public.email_outbox
    where idempotency_key = 'flows-rotate-pending') = '(skipped,token_rotated)',
  'an invitation email still queued with the old code is dropped, not sent with a dead link');

-- Quien aún no tenía código: rotar le da uno.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select public.rotate_my_invite_code() as dani_code \gset

commit;

select pg_temp.assert(
  (select code from public.invites
    where inviter_id = '44444444-4444-4444-4444-444444444444') = :'dani_code',
  'somebody with no code yet gets one');


-- ===========================================================================
-- Los términos, aceptados dentro de la app
--
-- La Guideline 1.2 de Apple pide un acuerdo **aceptado**, no publicado en una
-- web. Lo que se guarda es la versión, no un booleano: el día que el texto
-- cambie hay que volver a preguntar, y un `true` no sabe de qué texto venía.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select terms_version from public.profile_settings
    where id = '11111111-1111-1111-1111-111111111111') is null,
  'a new account has accepted nothing yet');

select public.accept_terms('2026-08-02');

select pg_temp.assert(
  (select terms_version from public.profile_settings
    where id = '11111111-1111-1111-1111-111111111111') = '2026-08-02',
  'accepting records which text was accepted');

select pg_temp.assert(
  (select terms_accepted_at from public.profile_settings
    where id = '11111111-1111-1111-1111-111111111111') is not null,
  'and when — a date the server puts, not the phone of the interested party');

select pg_temp.assert(
  pg_temp.raises($q$ select public.accept_terms('') $q$),
  'and accepting nothing in particular is refused');

commit;

-- Nadie escribe la aceptación de otra persona.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select public.accept_terms('2026-08-02');

-- Solo se ve la propia fila —la policy de `profile_settings` es de dueño
-- único— así que esto comprueba las dos cosas a la vez: que Carla registró la
-- suya, y que la de Ana no es asunto suyo.
select pg_temp.assert(
  (select count(*) from public.profile_settings where terms_version is not null) = 1,
  'each account records its own acceptance and cannot even see anybody else''s');

commit;


-- ===========================================================================
-- La lista de oración
--
-- El hueco más grande que tenía la app: solo existía el plan que escribe la IA,
-- y lo que la gente hace de verdad cada día es una lista de nombres. Es lo más
-- privado del producto — no se comparte, no se ve, no se reporta.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- La regla 1: una policy de SELECT que consultara su propia tabla rompería este
-- `returning`, y Postgres lo reportaría igual que un fallo de WITH CHECK.
with inserted as (
  insert into public.prayer_list_items (user_id, body)
  values ('11111111-1111-1111-1111-111111111111', 'Mi madre')
  returning id
)
select pg_temp.assert(
  (select count(*) from inserted) = 1,
  'insert ... returning works on prayer_list_items (rule 1)');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.prayer_list_items (user_id, body)
    values ('11111111-1111-1111-1111-111111111111', '   ')
  $q$),
  'an empty request is refused, not stored as a blank line');

commit;

-- Lo que de verdad importa aquí: nadie más ve tu lista. Ni la ve, ni sabe que
-- existe.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_list_items) = 0,
  'nobody else sees a single item of your list');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.prayer_list_items (user_id, body)
    values ('11111111-1111-1111-1111-111111111111', 'Colado')
  $q$),
  'nor can anybody write into it');

commit;

-- Marcar respondida y poder deshacerlo: alguien que toca la fila equivocada no
-- puede quedarse sin vuelta atrás en la pantalla donde apunta a su madre.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.prayer_list_items set answered_at = now();

select pg_temp.assert(
  (select answered_at from public.prayer_list_items limit 1) is not null,
  'you can mark one answered');

update public.prayer_list_items set answered_at = null;

select pg_temp.assert(
  (select answered_at from public.prayer_list_items limit 1) is null,
  'and take it back');

-- El cuarto bucle vale igual para una petición de la lista que para un plan.
insert into public.testimonies (user_id, body, visibility, list_item_id)
select '11111111-1111-1111-1111-111111111111', 'Se puso bien', 'private', id
from public.prayer_list_items limit 1;

select pg_temp.assert(
  (select count(*) from public.testimonies where list_item_id is not null) = 1,
  'and a testimony can hang off it, the same way it hangs off a plan');

commit;


-- ===========================================================================
-- Por dónde entró cada persona
--
-- Ningún enlace lo decía, y **esto hay que ponerlo antes de que los enlaces
-- circulen**: uno que ya está en un grupo de WhatsApp no se puede reetiquetar.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select signup_source from public.profile_settings
    where id = '11111111-1111-1111-1111-111111111111') is null,
  'a profile starts without knowing where it came from');

update public.profile_settings
   set signup_source = 'plan'
 where id = '11111111-1111-1111-1111-111111111111'
   and signup_source is null;

select pg_temp.assert(
  (select signup_source from public.profile_settings
    where id = '11111111-1111-1111-1111-111111111111') = 'plan',
  'and records it when somebody arrives through a link');

-- La guarda que hace que el dato signifique algo: se escribe una vez. Sin el
-- `is null`, cada inicio de sesión lo reescribiría y el dato pasaría de «por
-- dónde entró» a «lo último que tocó».
update public.profile_settings
   set signup_source = 'invitacion'
 where id = '11111111-1111-1111-1111-111111111111'
   and signup_source is null;

select pg_temp.assert(
  (select signup_source from public.profile_settings
    where id = '11111111-1111-1111-1111-111111111111') = 'plan',
  'and never overwrites it: where you came from happens once');

commit;

\echo '===================================='
\echo ' ACQUISITION LOOP ASSERTIONS PASSED'
\echo '===================================='
