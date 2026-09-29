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
