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
     '{"season":"cambio de trabajo","topics":["paz"],"minutes":10}'::jsonb,
     'America/Mexico_City',
     7::smallint,
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
  (select reminder_hour from public.profile_settings
    where id = '33333333-3333-3333-3333-333333333333') = 7,
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

\echo ''
\echo '===================================='
\echo ' ACQUISITION LOOP ASSERTIONS PASSED'
\echo '===================================='
