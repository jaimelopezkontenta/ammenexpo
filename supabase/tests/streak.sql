\set ON_ERROR_STOP on

-- The daily loop: a streak that forgives one missed day, the list of people you
-- can pray for, and the list of people who prayed for you.

\set ANA  '''11111111-1111-1111-1111-111111111111'''
\set BETO '''22222222-2222-2222-2222-222222222222'''
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

-- Re-runs the streak trigger as if the user last prayed `gap` days ago.
create or replace function pg_temp.log_after_gap(
  p_user uuid, p_day uuid, p_previous_streak integer, p_gap integer
) returns integer language plpgsql as $$
begin
  update public.profiles
     set streak_count = p_previous_streak,
         streak_last_day = case when p_gap is null then null
                                else current_date - p_gap end
   where id = p_user;

  delete from public.prayer_logs where user_id = p_user and plan_day_id = p_day;
  insert into public.prayer_logs (user_id, plan_day_id) values (p_user, p_day);

  return (select streak_count from public.profiles where id = p_user);
end;
$$;

begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:ANA,   'ana-streak@test.local',   'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:BETO,  'beto-streak@test.local',  'authenticated', 'authenticated', '{"display_name":"Beto"}'),
  (:CARLA, 'carla-streak@test.local', 'authenticated', 'authenticated', '{"display_name":"Carla"}');

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility)
values ('bbbb0000-0000-0000-0000-000000000001', :ANA, 'Plan de Ana', 3,
        current_date, 'link');

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values ('dddd0000-0000-0000-0000-000000000001',
        'bbbb0000-0000-0000-0000-000000000001', 1, 'Día uno', 'Oración', current_date),
       ('dddd0000-0000-0000-0000-000000000002',
        'bbbb0000-0000-0000-0000-000000000001', 2, 'Día dos', 'Oración', current_date + 1);

insert into public.share_links (token, scope, plan_id, created_by)
values ('ana-streak-link', 'plan', 'bbbb0000-0000-0000-0000-000000000001', :ANA);

commit;

-- ===========================================================================
-- The streak forgives one day, but not two
-- ===========================================================================
begin;

select pg_temp.assert(
  pg_temp.log_after_gap(:ANA, 'dddd0000-0000-0000-0000-000000000001', 0, null) = 1,
  'a first prayer starts the streak at 1');

select pg_temp.assert(
  pg_temp.log_after_gap(:ANA, 'dddd0000-0000-0000-0000-000000000001', 5, 1) = 6,
  'praying on consecutive days continues the streak');

-- The decision that matters: someone too flattened to open the app for a day
-- should not be told they lost everything.
select pg_temp.assert(
  pg_temp.log_after_gap(:ANA, 'dddd0000-0000-0000-0000-000000000001', 5, 2) = 6,
  'missing exactly one day keeps the streak: the day of grace');

select pg_temp.assert(
  pg_temp.log_after_gap(:ANA, 'dddd0000-0000-0000-0000-000000000001', 5, 3) = 1,
  'missing two consecutive days does reset the streak');

-- Idempotence: the streak counts days, not taps.
update public.profiles
   set streak_count = 4, streak_last_day = current_date where id = :ANA;
insert into public.prayer_logs (user_id, plan_day_id)
values (:ANA, 'dddd0000-0000-0000-0000-000000000002');

select pg_temp.assert(
  (select streak_count from public.profiles where id = :ANA) = 4,
  'a second prayer on the same day does not bump the streak twice');

rollback;

-- ===========================================================================
-- plans_shared_with_me — SECURITY INVOKER, so RLS still decides
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()) = 0,
  'a stranger sees nothing before redeeming the link');

select public.redeem_share_token('ana-streak-link');

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()) = 1,
  'after redeeming the link Carla can pray for Ana');

select pg_temp.assert(
  (select day_number from public.plans_shared_with_me()) = 1,
  'she sees today''s day, not the one that unlocks tomorrow');

select pg_temp.assert(
  not (select already_prayed from public.plans_shared_with_me()),
  'and it is marked as not yet prayed for');

insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id)
values ('dddd0000-0000-0000-0000-000000000001', :ANA, :CARLA);

select pg_temp.assert(
  (select already_prayed from public.plans_shared_with_me()),
  'once she prays, the button knows');

commit;

-- ===========================================================================
-- Beto never had access, so the function must not invent any
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.plans_shared_with_me()) = 0,
  'someone with no share sees no plans, even though the function is invoker-side');

select pg_temp.assert(
  (select count(*) from public.who_prayed_for_me()) = 0,
  'and nobody prayed for him');

commit;

-- ===========================================================================
-- who_prayed_for_me — the half of the loop that brings people back
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.who_prayed_for_me()) = 1,
  'Ana sees that Carla prayed for her today');

select pg_temp.assert(
  (select intercessor_name from public.who_prayed_for_me()) = 'Carla',
  'and she sees who it was, not an anonymous count');

select pg_temp.assert(
  (select count(*) from public.who_prayed_for_me(current_date + 1)) = 0,
  'the date filter is respected');

commit;

-- ===========================================================================
-- Messages are user-to-user text, so they must be reportable
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.reports (reporter_id, target_type, target_id, reason)
select :ANA, 'intercession', id, 'texto inapropiado'
from public.intercessions limit 1;

select pg_temp.assert(
  (select count(*) from public.reports where target_type = 'intercession') = 1,
  'an intercession message can be reported');

commit;

\echo ''
\echo '===================================='
\echo ' DAILY LOOP ASSERTIONS PASSED'
\echo '===================================='
