\set ON_ERROR_STOP on

-- Ammen — correo: outbox, cadencia, token de baja, jobs. Nunca llama a Resend.

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
exception
  when others then
    return true;
end;
$$;

begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:ANA,  'ana-mail@test.local',  'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:BETO, 'beto-mail@test.local', 'authenticated', 'authenticated', '{"display_name":"Beto"}')
on conflict (id) do nothing;

commit;

-- Preferencias al alta; cuentas viejas del seed ya tienen cadence off.
begin;

select pg_temp.assert(
  (select cadence::text from public.email_preferences where user_id = :ANA) = 'daily',
  'new accounts default to daily cadence');

select pg_temp.assert(
  (select last_seen_at is not null from public.profiles where id = :ANA),
  'last_seen_at is set so win-back is not blind');

commit;

-- ===========================================================================
-- Idempotencia y lease
-- ===========================================================================
begin;

select public.enqueue_email(
  'welcome', 'ana-mail@test.local', :ANA, 'es', 'T',
  jsonb_build_object('first_name', 'Ana'),
  'welcome/' || :ANA::text, now()
);

select public.enqueue_email(
  'welcome', 'ana-mail@test.local', :ANA, 'es', 'T',
  jsonb_build_object('first_name', 'Ana'),
  'welcome/' || :ANA::text, now()
);

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where idempotency_key = 'welcome/' || :ANA::text) = 1,
  're-enqueue with the same key does not duplicate');

commit;

begin;

select outbox_id as mail_lease_id
  from public.claim_email_outbox_batch(10, 120)
 where idempotency_key = 'welcome/' || :ANA::text
\gset

select pg_temp.assert(
  :'mail_lease_id' is not null,
  'claim leases the pending welcome');

select pg_temp.assert(
  (select count(*) from public.claim_email_outbox_batch(10, 120)
    where outbox_id = :'mail_lease_id') = 0,
  'a second claim does not see the leased row');

select public.mark_email_delivery(:'mail_lease_id'::uuid, 'sent', 're_test_1', null);

select pg_temp.assert(
  (select status from public.email_outbox where id = :'mail_lease_id') = 'sent',
  'mark sent is terminal');

commit;

-- ===========================================================================
-- Cadence off, suppression, daily cap, no prayer text
-- ===========================================================================
begin;

update public.email_preferences
   set cadence = 'off'
 where user_id = :ANA;

select public.enqueue_email(
  'habit', 'ana-mail@test.local', :ANA, 'es', 'P',
  jsonb_build_object('verse_ref', 'Salmos 23:1'),
  'habit/' || :ANA::text || '/off-test', now()
);

select pg_temp.assert(
  (select status from public.email_outbox
    where idempotency_key = 'habit/' || :ANA::text || '/off-test') = 'skipped',
  'habit is skipped when cadence is off');

select pg_temp.assert(
  (select last_error from public.email_outbox
    where idempotency_key = 'habit/' || :ANA::text || '/off-test') = 'channel_off',
  'and the skip reason is channel_off');

insert into public.email_suppressions (email, reason)
values ('bounced@test.local', 'bounce');

select public.enqueue_email(
  'welcome', 'bounced@test.local', :ANA, 'es', 'T',
  '{}'::jsonb, 'welcome-bounced-test', now()
);

select pg_temp.assert(
  (select status from public.email_outbox
    where idempotency_key = 'welcome-bounced-test') = 'skipped',
  'suppressed addresses are not sent');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.email_outbox (
      template, locale, to_email, channel, payload, idempotency_key
    ) values (
      'habit', 'es', 'x@test.local', 'P',
      '{"prayer_body":"Señor, ayúdame"}'::jsonb,
      'prayer-leak'
    )
  $q$),
  'first-person prayer text is rejected in the payload');

commit;

begin;

update public.email_preferences
   set cadence = 'daily', social = true, nudge = true
 where user_id = :ANA;

-- Un P ya pending hoy ocupa el tope.
select public.enqueue_email(
  'habit', 'ana-mail@test.local', :ANA, 'es', 'P',
  jsonb_build_object('verse_ref', 'Salmos 23:1'),
  'habit/' || :ANA::text || '/cap-a', now()
);

select public.enqueue_email(
  'digest_social', 'ana-mail@test.local', :ANA, 'es', 'S',
  jsonb_build_object('count', 1, 'names', jsonb_build_array('Beto')),
  'digest/' || :ANA::text || '/cap-b', now()
);

select pg_temp.assert(
  (select last_error from public.email_outbox
    where idempotency_key = 'digest/' || :ANA::text || '/cap-b') = 'daily_cap',
  'a second non-T email the same local day is skipped');

commit;

-- ===========================================================================
-- Token de baja sin sesión (anon)
-- ===========================================================================
begin;

select public.issue_email_prefs_token(:ANA) as ana_token \gset

select pg_temp.assert(
  public.verify_email_prefs_token(:'ana_token') = :ANA,
  'hmac token round-trips to the user');

select pg_temp.assert(
  public.verify_email_prefs_token('deadbeef.notasignature') is null,
  'a forged token does not resolve');

commit;

begin;
set local role anon;

select pg_temp.assert(
  public.unsubscribe_email_one_click(:'ana_token'),
  'anon one-click unsubscribe works without a session');

commit;

begin;

select pg_temp.assert(
  (select cadence::text from public.email_preferences where user_id = :ANA) = 'off',
  'one-click sets cadence to off');

select pg_temp.assert(
  (select social from public.email_preferences where user_id = :ANA),
  'and leaves social as it was');

update public.email_preferences
   set cadence = 'daily'
 where user_id = :ANA;

commit;

-- ===========================================================================
-- Bienvenida solo al completar onboarding
-- ===========================================================================
begin;

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where template = 'welcome'
      and user_id = :BETO) = 0,
  'welcome is not enqueued at raw signup');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select public.complete_onboarding(
  'Beto',
  '{"gender":"masculine"}'::jsonb,
  'UTC',
  array[8]::smallint[],
  'es',
  'daily'
);

commit;

begin;

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where template = 'welcome'
      and user_id = :BETO
      and status = 'pending') = 1,
  'welcome is enqueued when onboarding completes');

select pg_temp.assert(
  (select cadence::text from public.email_preferences where user_id = :BETO) = 'daily',
  'onboarding writes the chosen cadence');

commit;

-- ===========================================================================
-- Waitlist + hábito skip si ya oró / abrió
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.plus_waitlist (user_id, name, email)
values (:ANA, 'Ana', 'ana-mail@test.local')
on conflict (user_id) do nothing;

commit;

begin;

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where template = 'waitlist' and user_id = :ANA) = 1,
  'joining the waitlist enqueues the confirmation mail');

update public.profiles
   set last_seen_at = now(),
       streak_last_day = public.local_today(:ANA)
 where id = :ANA;

update public.email_preferences set cadence = 'daily' where user_id = :ANA;
update public.profile_settings
   set timezone = 'UTC',
       reminder_hours = array[
         extract(hour from now() at time zone 'UTC')::smallint
       ]
 where id = :ANA;

select public.enqueue_habit_emails();

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where template = 'habit'
      and user_id = :ANA
      and idempotency_key = 'habit/' || :ANA::text || '/'
        || public.local_today(:ANA)::text) = 0,
  'habit is not enqueued if she already prayed or opened the app today');

commit;

-- Heartbeat
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  public.heartbeat_last_seen(),
  'the owner can heartbeat last_seen_at');

commit;

-- ===========================================================================
-- Drip D2 (T, onboarding incompleto) + win-back 90d / D7
-- ===========================================================================
begin;

update public.profiles
   set created_at = now() - interval '3 days'
 where id = :ANA;

select public.enqueue_drip_emails();

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where template = 'drip_d2'
      and user_id = :ANA
      and status = 'pending') = 1,
  'D2 drip is enqueued when onboarding is still incomplete');

select pg_temp.assert(
  (select channel from public.email_outbox
    where template = 'drip_d2' and user_id = :ANA) = 'T',
  'and D2 is transactional so cadence off would not stop it');

commit;

begin;

update public.profiles
   set last_seen_at = now() - interval '91 days'
 where id = :BETO;

update public.email_preferences
   set nudge = true, cadence = 'daily'
 where user_id = :BETO;

select public.enqueue_winback_emails();

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where user_id = :BETO
      and template like 'winback_%'
      and status = 'pending') = 0,
  'win-back is not sent after 90 days idle');

update public.profiles
   set last_seen_at = now() - interval '7 days'
 where id = :BETO;

select public.enqueue_winback_emails();

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where template = 'winback_d7'
      and user_id = :BETO
      and status = 'pending') = 1,
  'win-back D7 is enqueued on the seventh idle day');

commit;


-- ===========================================================================
-- Topes de invitación por correo (Oleada 1a, 2026-09-29)
--
-- Sin tope por remitente, una cuenta recién creada podía mandar correo con la
-- marca de ammen a cualquier dirección. Ahora: solo con onboarding hecho, 10
-- al día (3 si la cuenta tiene menos de 24 h) y el nombre, acotado.
-- ===========================================================================
\set CARLA '''33333333-3333-3333-3333-333333333333'''
\set DANI  '''44444444-4444-4444-4444-444444444444'''

begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:CARLA, 'carla-mail@test.local', 'authenticated', 'authenticated', '{"display_name":"Carla"}'),
  (:DANI,  'dani-mail@test.local',  'authenticated', 'authenticated', '{"display_name":"Dani"}')
on conflict (id) do nothing;

-- Ana: cuenta de hace dos días, con onboarding. Carla: recién llegada, con
-- onboarding. Dani: sin onboarding.
update public.profiles set created_at = now() - interval '2 days' where id = :ANA;
update public.profile_settings set onboarding_answers = '{}'::jsonb
 where id in (:ANA, :BETO, :CARLA);
update public.profiles set created_at = now() - interval '2 days' where id = :BETO;
update public.profile_settings set onboarding_answers = null where id = :DANI;

insert into public.groups (owner_id, name, visibility)
values (:ANA, 'Círculo de Ana', 'private'),
       (:BETO, 'Círculo de Beto', 'private'),
       (:CARLA, 'Círculo de Carla', 'private'),
       (:DANI, 'Círculo de Dani', 'private');

commit;

select invite_token as ana_token from public.groups where owner_id = '11111111-1111-1111-1111-111111111111' \gset
select invite_token as beto_token from public.groups where owner_id = '22222222-2222-2222-2222-222222222222' \gset
select invite_token as carla_token from public.groups where owner_id = '33333333-3333-3333-3333-333333333333' \gset
select invite_token as dani_token from public.groups where owner_id = '44444444-4444-4444-4444-444444444444' \gset

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select bool_and((public.enqueue_invite_email('circle', 'amiga' || n || '@test.local', :'ana_token')) ->> 'ok' = 'true')
     from generate_series(1, 10) n),
  'an established account sends ten invitation emails in a day');

select pg_temp.assert(
  public.enqueue_invite_email('circle', 'amiga11@test.local', :'ana_token') ->> 'reason'
    = 'sender_rate_limited',
  'the eleventh invitation email in a day is refused');

commit;

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where invited_by = :ANA and template = 'invite_circle') = 10,
  'each queued invitation records who sent it');

-- R1 S6: invitar no puede servir para preguntar si otra persona ya invitó a
-- una dirección. Beto prueba con una que Ana acaba de invitar y con una nueva:
-- la respuesta tiene que ser idéntica, y las dos gastan su cupo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select public.enqueue_invite_email('circle', 'amiga1@test.local', :'beto_token') as beto_known \gset
select public.enqueue_invite_email('circle', 'solo-de-beto@test.local', :'beto_token') as beto_fresh \gset

commit;

select pg_temp.assert(
  (:'beto_known')::jsonb = '{"ok": true}'::jsonb
    and (:'beto_known')::jsonb = (:'beto_fresh')::jsonb,
  'an address someone else already invited answers exactly like a fresh one');

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where to_email = 'amiga1@test.local' and status in ('pending', 'sent')) = 1,
  'and the recipient still gets one invitation a week, not two');

select pg_temp.assert(
  (select count(*) from public.email_outbox where invited_by = :BETO) = 2
    and (select last_error from public.email_outbox
          where invited_by = :BETO and to_email = 'amiga1@test.local') = 'recipient_recent',
  'the silent one still spends the sender''s quota, so counting «ok»s does not tell either');

-- Con el cupo gastado, la respuesta tampoco distingue: el tope de remitente
-- va antes que nada que dependa de otros.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select count(*) from generate_series(1, 8) n
 where (public.enqueue_invite_email('circle', 'relleno' || n || '@test.local', :'beto_token') ->> 'ok')::boolean;

select pg_temp.assert(
  public.enqueue_invite_email('circle', 'amiga2@test.local', :'beto_token')
    = public.enqueue_invite_email('circle', 'nadie-la-invito@test.local', :'beto_token')
    and public.enqueue_invite_email('circle', 'amiga2@test.local', :'beto_token') ->> 'reason'
      = 'sender_rate_limited',
  'once the sender is out of quota, known and unknown addresses get the same refusal');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select bool_and((public.enqueue_invite_email('circle', 'primo' || n || '@test.local', :'carla_token')) ->> 'ok' = 'true')
     from generate_series(1, 3) n),
  'a brand-new account can still invite its own people');

select pg_temp.assert(
  public.enqueue_invite_email('circle', 'primo4@test.local', :'carla_token') ->> 'reason'
    = 'sender_rate_limited',
  'a brand-new account stops at three invitation emails in its first day');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  public.enqueue_invite_email('circle', 'alguien@test.local', :'dani_token') ->> 'reason'
    = 'not_onboarded',
  'an account that has not finished onboarding cannot send invitation emails');

commit;

select pg_temp.assert(
  pg_temp.raises(format(
    'update public.profiles set display_name = %L where id = %L',
    repeat('x', 81), :DANI)),
  'a display name longer than 80 characters is refused');

select pg_temp.assert(
  not pg_temp.raises(format(
    'update public.profiles set display_name = %L where id = %L',
    repeat('x', 80), :DANI)),
  'a display name of 80 characters is accepted');

-- R1 S8: `not valid` dejaba que un nombre viejo de más de 80 rompiera
-- cualquier UPDATE de su fila (el latido, la racha…). La migración los
-- recorta y valida la restricción: ya no queda ninguna fila fuera.
select pg_temp.assert(
  (select convalidated from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_display_name_length'),
  'the display name length constraint is validated, so every existing row fits');

-- ===========================================================================
-- Oleada 4b (2026-09-29): lo que el correo hacía sin que nada lo probara —
-- digest social, invitaciones de principio a fin, sunset de cuentas
-- inactivas, suppressions, tokens de preferencias, el secreto HMAC en Vault y
-- el versículo en el idioma de cada cual. Gente nueva para no heredar el
-- estado (cadencias, topes) de las secciones de arriba.
-- ===========================================================================
\set EVA  '''55555555-5555-5555-5555-555555555555'''
\set FEDE '''66666666-6666-6666-6666-666666666666'''
\set GABI '''77777777-7777-7777-7777-777777777777'''
\set HUGO '''88888888-8888-8888-8888-888888888888'''
\set IRIS '''99999999-9999-9999-9999-999999999999'''

-- Una zona horaria en la que ahora mismo son las `p_hour` (Etc/GMT va con el
-- signo al revés). Se usa dentro de la misma transacción que el job: now() no
-- se mueve, así que el cambio de hora no puede colarse entre medias.
create or replace function pg_temp.tz_at_hour(p_hour integer)
returns text language sql as $$
  select 'Etc/GMT' || case
    when o > 0 then '-' || o
    when o < 0 then '+' || (-o)
    else ''
  end
  from (
    select case when d > 12 then d - 24 else d end as o
    from (
      select (((p_hour - extract(hour from now() at time zone 'UTC')::integer) % 24) + 24) % 24 as d
    ) x
  ) y;
$$;

begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:EVA,  'eva-mail@test.local',  'authenticated', 'authenticated', '{"display_name":"Eva Ruiz"}'),
  (:FEDE, 'fede-mail@test.local', 'authenticated', 'authenticated', '{"display_name":"Fede"}'),
  (:GABI, 'gabi-mail@test.local', 'authenticated', 'authenticated', '{"display_name":"Gabi"}'),
  (:HUGO, 'hugo-mail@test.local', 'authenticated', 'authenticated', '{"display_name":"Hugo"}'),
  (:IRIS, 'iris-mail@test.local', 'authenticated', 'authenticated', '{"display_name":"Iris"}');

-- Cuentas de hace una semana, con onboarding, vistas ayer: ni goteo de alta ni
-- tope de «primer día» ni win-back por accidente.
update public.profiles
   set created_at = now() - interval '7 days',
       last_seen_at = now() - interval '1 day'
 where id in (:EVA, :FEDE, :GABI, :HUGO, :IRIS);

update public.profile_settings
   set onboarding_answers = '{}'::jsonb,
       timezone = 'UTC'
 where id in (:EVA, :FEDE, :GABI, :HUGO, :IRIS);

-- Iris no entra hasta su sección (EN-3): con cadencia `off` los enqueues
-- previos la saltan. Sin esto, si la suite corre en la hora de su reminder
-- por defecto, la sección del sunset le encola el hábito con el locale viejo
-- y el assert del correo encolado falla por idempotencia diaria.
update public.email_preferences set cadence = 'off' where user_id = :IRIS;

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility)
values ('eeee0000-0000-0000-0000-000000000001', :EVA, 'Plan de Eva', 7, current_date, 'link');

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values ('eeee0000-0000-0000-0000-0000000000d1', 'eeee0000-0000-0000-0000-000000000001',
        1, 'Día uno', 'Privado', current_date);

-- Fede, Gabi y Hugo oran hoy por Eva; Eva tiene bloqueado a Hugo.
insert into public.intercessions (plan_day_id, intercessor_id)
values ('eeee0000-0000-0000-0000-0000000000d1', :FEDE),
       ('eeee0000-0000-0000-0000-0000000000d1', :GABI),
       ('eeee0000-0000-0000-0000-0000000000d1', :HUGO);

insert into public.blocks (blocker_id, blocked_id) values (:EVA, :HUGO);

-- Y Fede entra hoy en el círculo de Eva.
insert into public.groups (id, owner_id, name, visibility)
values ('eeee0000-0000-0000-0000-00000000c001', :EVA, 'Círculo de Eva', 'private');

insert into public.group_members (group_id, user_id, role)
values ('eeee0000-0000-0000-0000-00000000c001', :FEDE, 'member');

commit;

-- ---------------------------------------------------------------------------
-- Digest social: a las 20:00 locales, solo si pasó algo, sin los bloqueados
-- ---------------------------------------------------------------------------
begin;

update public.profile_settings set timezone = pg_temp.tz_at_hour(20)
 where id in (:EVA, :GABI);

select public.enqueue_digest_emails();

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where user_id = :EVA and template = 'digest_social'
      and status = 'pending' and channel = 'S') = 1,
  'the social digest goes out at 20:00 local when someone prayed for her today');

select pg_temp.assert(
  (select payload from public.email_outbox
    where user_id = :EVA and template = 'digest_social')
    = '{"first_name":"Eva","names":["Fede","Gabi"],"count":2,"joins":1}'::jsonb,
  'and it names who prayed, counts them and counts who joined her circle today');

select pg_temp.assert(
  not exists (
    select 1 from public.email_outbox
     where user_id = :EVA and template = 'digest_social'
       and (payload -> 'names') ? 'Hugo'),
  'someone she blocked is neither named nor counted');

select pg_temp.assert(
  (select idempotency_key from public.email_outbox
    where user_id = :EVA and template = 'digest_social')
    = 'digest/' || :EVA::text || '/' || public.local_today(:EVA)::text,
  'the digest key carries her local date: one a day');

select public.enqueue_digest_emails();

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where user_id = :EVA and template = 'digest_social') = 1,
  'running the job again the same evening does not send a second digest');

select pg_temp.assert(
  not exists (
    select 1 from public.email_outbox
     where user_id = :GABI and template = 'digest_social'),
  'at 20:00 with nothing to tell, there is no digest');

commit;

begin;

delete from public.email_outbox where user_id = :EVA and template = 'digest_social';
update public.profile_settings set timezone = pg_temp.tz_at_hour(21) where id = :EVA;

select public.enqueue_digest_emails();

select pg_temp.assert(
  not exists (
    select 1 from public.email_outbox
     where user_id = :EVA and template = 'digest_social'),
  'at any other hour the digest waits');

rollback;

begin;

delete from public.email_outbox where user_id = :EVA and template = 'digest_social';
update public.profile_settings set timezone = pg_temp.tz_at_hour(20) where id = :EVA;
update public.email_preferences set social = false where user_id = :EVA;

select public.enqueue_digest_emails();

select pg_temp.assert(
  not exists (
    select 1 from public.email_outbox
     where user_id = :EVA and template = 'digest_social'),
  'with social emails turned off there is no digest at all');

rollback;

-- ---------------------------------------------------------------------------
-- Invitaciones: el camino feliz y lo que viaja en el correo
-- ---------------------------------------------------------------------------
begin;

update public.profile_settings set locale = 'en-US' where id = :EVA;

insert into public.invites (inviter_id, code) values (:EVA, 'codigo-de-eva');
insert into public.share_links (token, scope, plan_id, created_by)
values ('plan-de-eva', 'plan', 'eeee0000-0000-0000-0000-000000000001', :EVA);

commit;

select invite_token as eva_circle_token from public.groups
 where id = 'eeee0000-0000-0000-0000-00000000c001' \gset

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select public.enqueue_invite_email('circle', '  Nueva.Amiga@Test.local ', :'eva_circle_token') as eva_circle_invite \gset
select public.enqueue_invite_email('app', 'app-amiga@test.local', 'codigo-de-eva') as eva_app_invite \gset
select public.enqueue_invite_email('plan', 'plan-amiga@test.local', 'plan-de-eva') as eva_plan_invite \gset

commit;

select pg_temp.assert(
  (:'eva_circle_invite')::jsonb = '{"ok": true}'::jsonb
    and (:'eva_app_invite')::jsonb = '{"ok": true}'::jsonb
    and (:'eva_plan_invite')::jsonb = '{"ok": true}'::jsonb,
  'inviting by email to a circle, to the app and to a plan all answer ok');

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where to_email = 'nueva.amiga@test.local'
      and template = 'invite_circle' and status = 'pending'
      and channel = 'S' and user_id is null and invited_by = :EVA) = 1,
  'the circle invitation is queued once, to the trimmed lower-case address, on the social channel');

select pg_temp.assert(
  (select payload from public.email_outbox
    where to_email = 'nueva.amiga@test.local' and template = 'invite_circle')
    = jsonb_build_object(
        'inviter_name', 'Eva Ruiz',
        'circle_name', 'Círculo de Eva',
        'token', :'eva_circle_token'),
  'and it carries who invites, the circle and its token, nothing else');

select pg_temp.assert(
  (select locale from public.email_outbox
    where to_email = 'nueva.amiga@test.local' and template = 'invite_circle') = 'en',
  'in the language of whoever sends it');

select pg_temp.assert(
  (select idempotency_key from public.email_outbox
    where to_email = 'nueva.amiga@test.local' and template = 'invite_circle')
    = 'invite/circle/' || :'eva_circle_token' || '/nueva.amiga@test.local/'
      || to_char(now(), 'IYYY-"W"IW'),
  'and its key is per link, address and week');

select pg_temp.assert(
  (select payload from public.email_outbox
    where to_email = 'app-amiga@test.local' and template = 'invite_app')
    = '{"inviter_name":"Eva Ruiz","token":"codigo-de-eva"}'::jsonb
  and (select payload from public.email_outbox
    where to_email = 'plan-amiga@test.local' and template = 'invite_plan')
    = '{"inviter_name":"Eva Ruiz","plan_title":"Plan de Eva","token":"plan-de-eva"}'::jsonb,
  'an app invitation carries her code, a plan invitation the plan title and link');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

-- Fede es miembro del círculo de Eva, no administrador.
select pg_temp.assert(
  public.enqueue_invite_email('circle', 'otra@test.local', :'eva_circle_token')
      = '{"ok": false, "reason": "not_owner"}'::jsonb
    and public.enqueue_invite_email('app', 'otra@test.local', 'codigo-de-eva')
      = '{"ok": false, "reason": "not_owner"}'::jsonb
    and public.enqueue_invite_email('plan', 'otra@test.local', 'plan-de-eva')
      = '{"ok": false, "reason": "not_owner"}'::jsonb,
  'nobody can send invitations with someone else''s circle, code or plan');

commit;

select pg_temp.assert(
  not exists (select 1 from public.email_outbox where to_email = 'otra@test.local'),
  'and those refusals queue nothing');

-- ---------------------------------------------------------------------------
-- Suppressions: rebote y queja (webhook de Resend) cortan el envío, también el
-- transaccional y el de invitación, sin que quien invita lo note
-- ---------------------------------------------------------------------------
begin;

select pg_temp.assert(
  public.record_email_event('svix-rebote-1', 'email.bounced', null,
    '{"data":{"to":["Rebota@Test.local"]}}'::jsonb),
  'a bounce webhook is recorded');

select pg_temp.assert(
  not public.record_email_event('svix-rebote-1', 'email.bounced', null,
    '{"data":{"to":["Rebota@Test.local"]}}'::jsonb)
  and (select count(*) from public.email_events where svix_id = 'svix-rebote-1') = 1,
  'and the same webhook delivered twice is recorded once');

select public.record_email_event('svix-queja-1', 'email.complained', null,
  '{"data":{"to":"queja@test.local"}}'::jsonb);
select public.record_email_event('svix-entregado-1', 'email.delivered', null,
  '{"data":{"to":["entregado@test.local"]}}'::jsonb);

select pg_temp.assert(
  (select reason from public.email_suppressions where email = 'rebota@test.local') = 'bounce'
    and (select reason from public.email_suppressions where email = 'queja@test.local') = 'complaint',
  'bounces and complaints suppress the (lower-cased) address, each with its reason');

select pg_temp.assert(
  not exists (select 1 from public.email_suppressions where email = 'entregado@test.local'),
  'a delivered email suppresses nothing');

select public.enqueue_email(
  'welcome', 'REBOTA@test.local', null, 'es', 'T', '{}'::jsonb,
  'welcome-to-bounced', now());

select pg_temp.assert(
  (select (status, last_error)::text from public.email_outbox
    where idempotency_key = 'welcome-to-bounced') = '(skipped,suppressed)',
  'even a transactional email to a bounced address is skipped as suppressed');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select public.enqueue_invite_email('circle', 'queja@test.local', :'eva_circle_token') as invite_to_complainer \gset

commit;

select pg_temp.assert(
  (:'invite_to_complainer')::jsonb = '{"ok": true}'::jsonb
    and (select (status, last_error)::text from public.email_outbox
          where to_email = 'queja@test.local' and template = 'invite_circle')
        = '(skipped,suppressed)',
  'inviting an address that complained answers ok like any other, and sends nothing');

-- ---------------------------------------------------------------------------
-- Tokens de preferencias: sin sesión, solo con el enlace del correo. No
-- caducan (no llevan fecha): los invalida rotar el secreto, más abajo.
-- ---------------------------------------------------------------------------
select public.issue_email_prefs_token(:FEDE) as fede_token \gset
select public.issue_email_prefs_token(:GABI) as gabi_token \gset
select public.issue_email_prefs_token(:HUGO) as hugo_token \gset

-- La firma de Fede con el id de Gabi delante; y la de Fede con un carácter
-- cambiado.
select replace(:'gabi_token', split_part(:'gabi_token', '.', 2), split_part(:'fede_token', '.', 2))
  as swapped_token \gset
select left(:'fede_token', -1)
       || case when right(:'fede_token', 1) = '0' then '1' else '0' end
  as tampered_token \gset

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select pg_temp.assert(
  public.issue_my_email_prefs_token() = :'fede_token',
  'the owner gets the same token the email footer carries');

commit;

begin;
set local role anon;

select pg_temp.assert(
  (select (cadence, social, nudge)::text from public.email_prefs_by_token(:'fede_token'))
    = '(daily,t,t)',
  'a valid token shows its preferences without a session');

select pg_temp.assert(
  public.update_email_prefs_by_token(:'fede_token', 'weekly', false, null),
  'and changes them');

select pg_temp.assert(
  not public.update_email_prefs_by_token(:'tampered_token', 'off', null, null)
    and (select count(*) from public.email_prefs_by_token(:'tampered_token')) = 0,
  'a token with one character changed neither reads nor writes');

select pg_temp.assert(
  not public.update_email_prefs_by_token(:'swapped_token', 'off', false, false)
    and not public.unsubscribe_email_one_click(:'swapped_token'),
  'someone else''s signature does not unlock this account');

select pg_temp.assert(
  public.update_email_prefs_by_token(null, 'off', null, null) is not true
    and not public.update_email_prefs_by_token('', 'off', null, null)
    and not public.update_email_prefs_by_token('sin-punto', 'off', null, null)
    and not public.update_email_prefs_by_token(split_part(:'fede_token', '.', 1) || '.', 'off', null, null),
  'an empty, dotless or unsigned token does nothing');

commit;

select pg_temp.assert(
  (select (cadence, social, nudge)::text from public.email_preferences where user_id = :FEDE)
    = '(weekly,f,t)'
  and (select (cadence, social, nudge)::text from public.email_preferences where user_id = :GABI)
    = '(daily,t,t)',
  'only the valid token changed anything, and only its own account');

-- Con social apagado por el enlace, el correo social se omite; el
-- transaccional sigue saliendo.
begin;

select public.enqueue_email(
  'digest_social', 'fede-mail@test.local', :FEDE, 'es', 'S', '{}'::jsonb,
  'digest/' || :FEDE::text || '/prefs-test', now());
select public.enqueue_email(
  'invite_used', 'fede-mail@test.local', :FEDE, 'es', 'T', '{}'::jsonb,
  'invite_used/prefs-test', now());

select pg_temp.assert(
  (select (status, last_error)::text from public.email_outbox
    where idempotency_key = 'digest/' || :FEDE::text || '/prefs-test') = '(skipped,channel_off)'
  and (select status from public.email_outbox
    where idempotency_key = 'invite_used/prefs-test') = 'pending',
  'turning social off by link skips social email, not transactional email');

rollback;

-- Hugo borra su cuenta: su enlace ya no lleva a nadie.
delete from auth.users where id = :HUGO;

select pg_temp.assert(
  public.verify_email_prefs_token(:'hugo_token') is null,
  'a correctly signed token for an account that no longer exists resolves to nobody');

-- ---------------------------------------------------------------------------
-- Sunset: la cuenta que no vuelve deja de recibir correo sola
-- ---------------------------------------------------------------------------
begin;

update public.email_preferences
   set cadence = 'weekdays', nudge = true, sunset_at = null, previous_cadence = null
 where user_id = :GABI;
update public.profiles
   set last_seen_at = now() - interval '30 days'
 where id = :GABI;

select public.enqueue_winback_emails();

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where user_id = :GABI and template = 'winback_d30' and status = 'pending') = 1,
  'after thirty days away the last win-back (D30) is queued');

select pg_temp.assert(
  (select (cadence, previous_cadence, sunset_at is not null)::text
     from public.email_preferences where user_id = :GABI)
    = '(weekdays,weekdays,t)',
  'and the sunset clock starts, remembering her cadence, without turning anything off yet');

commit;

select sunset_at as gabi_sunset from public.email_preferences
 where user_id = '77777777-7777-7777-7777-777777777777' \gset

begin;

select public.enqueue_winback_emails();

select pg_temp.assert(
  (select sunset_at from public.email_preferences where user_id = :GABI) = :'gabi_sunset'
    and (select count(*) from public.email_outbox
          where user_id = :GABI and template = 'winback_d30') = 1,
  'running win-back again neither restarts the clock nor sends a second D30');

select pg_temp.assert(
  public.email_apply_sunset() = 0
    and (select cadence::text from public.email_preferences where user_id = :GABI) = 'weekdays',
  'within the seven days of grace nothing is switched off');

commit;

-- Fede abrió su D30: a él no se le apaga nada.
begin;

update public.email_preferences
   set sunset_at = now() - interval '8 days', nudge = true
 where user_id in (:GABI, :FEDE);

insert into public.email_outbox (
  template, locale, to_email, user_id, channel, idempotency_key, status, resend_id, sent_at
) values (
  'winback_d30', 'es', 'fede-mail@test.local', :FEDE, 'G',
  'winback_d30/' || :FEDE::text, 'sent', 're_fede_d30', now() - interval '8 days'
);

select public.record_email_event('svix-abre-fede', 'email.opened', 're_fede_d30', '{}'::jsonb);

select pg_temp.assert(
  public.email_apply_sunset() = 1,
  'seven days after an unopened D30, the sunset applies');

select pg_temp.assert(
  (select (cadence, nudge)::text from public.email_preferences where user_id = :GABI)
    = '(off,f)',
  'and switches off both her cadence and her nudges');

select pg_temp.assert(
  (select (cadence, nudge)::text from public.email_preferences where user_id = :FEDE)
    = '(weekly,t)',
  'but not for someone who opened the D30');

-- Todo lo necesario para que, sin el sunset, le tocara un win-back D14 y el
-- correo de hábito de esta hora: si llega cualquiera de los dos (aunque sea
-- como `skipped`), el sunset no apagó nada.
update public.profiles
   set last_seen_at = now() - interval '14 days', streak_last_day = null
 where id = :GABI;
update public.profile_settings
   set timezone = 'UTC',
       reminder_hours = array[extract(hour from now() at time zone 'UTC')::smallint]
 where id = :GABI;

select public.enqueue_winback_emails();
select public.enqueue_habit_emails();

select pg_temp.assert(
  not exists (
    select 1 from public.email_outbox
     where user_id = :GABI and template <> 'winback_d30'),
  'after the sunset she gets neither win-backs nor habit emails');

commit;

begin;
set local role anon;

select pg_temp.assert(
  public.reactivate_email_cadence_by_token(:'gabi_token'),
  'one tap on the link in the email reactivates her');

commit;

select pg_temp.assert(
  (select (cadence, nudge, sunset_at is null)::text
     from public.email_preferences where user_id = :GABI)
    = '(weekdays,t,t)',
  'with the cadence she had before, nudges back on and the sunset cleared');

-- ---------------------------------------------------------------------------
-- El versículo del correo de hábito, en su idioma (EN-3)
-- ---------------------------------------------------------------------------
begin;

update public.profile_settings set locale = 'en' where id = :IRIS;
update public.profile_settings set locale = 'es' where id = :GABI;

select pg_temp.assert(
  (select (public.email_habit_payload(:IRIS) ->> 'verse_ref',
           public.email_habit_payload(:IRIS) ->> 'verse_text'))
    = (select (reference, text) from public.verse_of_the_day_for(:IRIS, 'web')),
  'an English speaker''s habit email carries the verse of the day from the WEB');

select pg_temp.assert(
  (select (public.email_habit_payload(:GABI) ->> 'verse_ref',
           public.email_habit_payload(:GABI) ->> 'verse_text'))
    = (select (reference, text) from public.verse_of_the_day_for(:GABI, 'rvr1909')),
  'a Spanish speaker''s still carries the Reina-Valera 1909');

update public.profile_settings set locale = 'en-GB' where id = :IRIS;

select pg_temp.assert(
  public.email_habit_payload(:IRIS) ->> 'verse_text'
    = (select text from public.verse_of_the_day_for(:IRIS, 'web')),
  'any English locale (en-GB) gets the English Bible, like the template language');

commit;

begin;

update public.email_preferences set cadence = 'daily' where user_id = :IRIS;
update public.profile_settings
   set reminder_hours = array[extract(hour from now() at time zone 'UTC')::smallint]
 where id = :IRIS;
update public.profiles
   set last_seen_at = now() - interval '2 days', streak_last_day = null
 where id = :IRIS;

select public.enqueue_habit_emails();

select pg_temp.assert(
  (select (locale, payload ->> 'verse_text') from public.email_outbox
    where user_id = :IRIS and template = 'habit')
    = (select ('en'::text, text) from public.verse_of_the_day_for(:IRIS, 'web')),
  'the queued habit email goes in English with the English verse');

rollback;

-- ---------------------------------------------------------------------------
-- El secreto HMAC, en Vault
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  (select count(*) from vault.decrypted_secrets
    where name = 'ammen_email_hmac_secret'
      and length(decrypted_secret) >= 32) = 1
  and (select hmac_secret from public.email_runtime where id) is null,
  'the HMAC secret lives in Vault and no longer in plain text in email_runtime');

select pg_temp.assert(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosrc ~ '\mhmac_secret\M')
    = array['email_hmac_secret', 'email_hmac_secret_to_vault'],
  'nothing but the secret''s accessor and the migration reads the old column');

select pg_temp.assert(
  :'fede_token' = replace(:FEDE::text, '-', '') || '.' || encode(extensions.hmac(
    replace(:FEDE::text, '-', ''),
    (select decrypted_secret from vault.decrypted_secrets where name = 'ammen_email_hmac_secret'),
    'sha256'), 'hex'),
  'tokens are signed with the secret in Vault');

select pg_temp.assert(
  not has_function_privilege('service_role', 'public.email_hmac_secret_to_vault()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.email_hmac_secret_to_vault()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.email_hmac_secret_to_vault()', 'EXECUTE'),
  'moving the secret is for the database owner only');

-- Una base «de antes»: el secreto solo en la tabla. Un token firmado ahí
-- tiene que seguir valiendo cuando el secreto pasa a Vault.
begin;

delete from vault.secrets where name = 'ammen_email_hmac_secret';
update public.email_runtime set hmac_secret = 'secreto-de-antes-de-vault-0123456789' where id;

select public.issue_email_prefs_token(:FEDE) as token_before \gset

select pg_temp.assert(
  :'token_before' = replace(:FEDE::text, '-', '') || '.' || encode(extensions.hmac(
    replace(:FEDE::text, '-', ''), 'secreto-de-antes-de-vault-0123456789', 'sha256'), 'hex'),
  'without the Vault secret, the table still signs (a half-migrated database does not break)');

select pg_temp.assert(
  public.email_hmac_secret_to_vault() = 'created',
  'the move creates the Vault secret');

select pg_temp.assert(
  (select decrypted_secret from vault.decrypted_secrets where name = 'ammen_email_hmac_secret')
    = 'secreto-de-antes-de-vault-0123456789'
  and (select hmac_secret from public.email_runtime where id) is null,
  'with the same value the table had, and then empties the table');

select pg_temp.assert(
  public.issue_email_prefs_token(:FEDE) = :'token_before'
    and public.verify_email_prefs_token(:'token_before') = :FEDE,
  'so a token issued before the move verifies the same after it');

select pg_temp.assert(
  public.email_hmac_secret_to_vault() = 'already_in_vault'
    and (select count(*) from vault.secrets where name = 'ammen_email_hmac_secret') = 1,
  'running the move again changes nothing');

rollback;

-- Rotar el secreto en Vault invalida los enlaces ya enviados.
begin;

select vault.update_secret(
  (select id from vault.secrets where name = 'ammen_email_hmac_secret'),
  'secreto-rotado-9876543210-abcdefghij'
);

select pg_temp.assert(
  public.verify_email_prefs_token(:'fede_token') is null
    and not public.unsubscribe_email_one_click(:'fede_token'),
  'after rotating the secret in Vault, old links stop working');

select pg_temp.assert(
  public.verify_email_prefs_token(public.issue_email_prefs_token(:FEDE)) = :FEDE,
  'and new ones are signed with the new secret');

rollback;

-- Sin secreto en ningún sitio, falla cerrado.
begin;

delete from vault.secrets where name = 'ammen_email_hmac_secret';

select pg_temp.assert(
  public.issue_email_prefs_token(:FEDE) is null
    and public.verify_email_prefs_token(:'fede_token') is null,
  'with no secret anywhere, nothing is signed and nothing verifies');

rollback;
