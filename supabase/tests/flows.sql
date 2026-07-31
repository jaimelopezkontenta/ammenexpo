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

select pg_temp.assert(
  public.are_friends('11111111-1111-1111-1111-111111111111',
                     '33333333-3333-3333-3333-333333333333'),
  'Ana and Carla are now connected');

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

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profile_settings
       set reminder_hours = array[]::smallint[]
     where id = '33333333-3333-3333-3333-333333333333'
  $q$),
  'and so is none at all');

commit;

\echo ''
\echo '===================================='
\echo ' ACQUISITION LOOP ASSERTIONS PASSED'
\echo '===================================='
