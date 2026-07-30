\set ON_ERROR_STOP on

-- Test personas
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''

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
-- Fixtures (as superuser, RLS bypassed)
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:A, 'ana@test.local',  'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:B, 'beto@test.local', 'authenticated', 'authenticated', '{"display_name":"Beto"}');

insert into public.prayer_plans (id, owner_id, title, theme, duration_days, start_date, visibility)
values ('aaaa0000-0000-0000-0000-000000000001', :A, 'Paz en el trabajo', 'paz', 3,
        current_date - 1, 'private');

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values
  ('dddd0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', 1,
   'Día uno', 'Texto privado de oración 1', current_date - 1),
  ('dddd0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001', 2,
   'Día dos', 'Texto privado de oración 2', current_date),
  ('dddd0000-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-000000000001', 3,
   'Día tres', 'Texto privado de oración 3', current_date + 1);

insert into public.share_links (id, token, scope, plan_id, created_by)
values ('5111e000-0000-0000-0000-000000000001', 'validtoken', 'plan',
        'aaaa0000-0000-0000-0000-000000000001', :A),
       ('5111e000-0000-0000-0000-000000000002', 'revokedtoken', 'plan',
        'aaaa0000-0000-0000-0000-000000000001', :A);

update public.share_links set revoked_at = now() where token = 'revokedtoken';

commit;

-- ===========================================================================
-- 1. Isolation: Beto must not see Ana's private plan
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plans) = 0,
  'Beto cannot see Ana''s private plan');

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days) = 0,
  'Beto cannot see any of Ana''s plan days');

select pg_temp.assert(
  (select count(*) from public.profile_settings
    where id = '11111111-1111-1111-1111-111111111111') = 0,
  'Beto cannot read Ana''s private profile settings');

select pg_temp.assert(
  (select count(*) from public.profile_settings) = 1,
  'Beto reads exactly one settings row: his own');

commit;

-- ===========================================================================
-- 2. Owner sees the plan, but NOT the future day
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plans) = 1,
  'Ana sees her own plan');

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days) = 2,
  'Ana sees only the 2 unlocked days, not tomorrow''s');

select pg_temp.assert(
  (select count(*) from public.profile_settings) = 1,
  'Ana reads her own settings');

commit;

-- ===========================================================================
-- 3. Ana shares the plan with Beto
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
values ('aaaa0000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111');

commit;

-- ===========================================================================
-- 4. Beto now sees the plan and its unlocked days only
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plans) = 1,
  'Beto sees the shared plan');

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days) = 2,
  'Beto sees the 2 unlocked days only');

-- Beto prays for day 1
insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id)
values ('dddd0000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000', -- deliberately wrong: trigger must fix it
        '22222222-2222-2222-2222-222222222222');

select pg_temp.assert(
  (select plan_owner_id from public.intercessions
    where plan_day_id = 'dddd0000-0000-0000-0000-000000000001')
    = '11111111-1111-1111-1111-111111111111',
  'Spoofed plan_owner_id is overwritten server-side');

commit;

-- ===========================================================================
-- 5. Anti-spam and locked-day enforcement
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
begin
  insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id)
  values ('dddd0000-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222');
  raise exception 'FAIL  praying twice for the same day should be rejected';
exception when unique_violation then
  raise notice 'PASS  praying twice for the same day is rejected';
end;
$$;

do $$
begin
  insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id)
  values ('dddd0000-0000-0000-0000-000000000003',
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222');
  raise exception 'FAIL  praying for a locked future day should be rejected';
exception when insufficient_privilege then
  raise notice 'PASS  praying for a locked future day is rejected by RLS';
end;
$$;

do $$
begin
  delete from public.prayer_plans where id = 'aaaa0000-0000-0000-0000-000000000001';
  if found then
    raise exception 'FAIL  Beto deleted Ana''s plan';
  end if;
  raise notice 'PASS  Beto cannot delete Ana''s plan';
end;
$$;

commit;

-- ===========================================================================
-- 6. Notification created once per intercessor per day (dedupe)
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.notifications where type = 'intercession') = 1,
  'Ana got exactly 1 intercession notification');

commit;

-- Beto prays a second, different day on the same calendar day
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id)
values ('dddd0000-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.intercessions) = 2,
  'Ana sees both intercessions');

select pg_temp.assert(
  (select count(*) from public.notifications where type = 'intercession') = 1,
  'Still only 1 notification: the per-day push throttle holds');

select pg_temp.assert(
  (select intercession_count from public.prayer_plan_days
    where id = 'dddd0000-0000-0000-0000-000000000001') = 1,
  'intercession_count counter is maintained by trigger');

commit;

-- ===========================================================================
-- 7. Anonymous public preview
-- ===========================================================================
begin;
set local role anon;

select pg_temp.assert(
  (select count(*) from public.get_shared_plan_preview('validtoken')) = 1,
  'anon gets a preview for a valid share token');

select pg_temp.assert(
  (select day_number from public.get_shared_plan_preview('validtoken')) = 2,
  'preview returns the CURRENT day, not the whole plan');

select pg_temp.assert(
  (select count(*) from public.get_shared_plan_preview('revokedtoken')) = 0,
  'revoked share token returns nothing');

select pg_temp.assert(
  (select count(*) from public.get_shared_plan_preview('made-up-token')) = 0,
  'unknown share token returns nothing');

do $$
begin
  perform count(*) from public.prayer_plans;
  raise exception 'FAIL  anon could read prayer_plans directly';
exception when insufficient_privilege then
  raise notice 'PASS  anon has no table access to prayer_plans';
end;
$$;

do $$
begin
  perform count(*) from public.share_links;
  raise exception 'FAIL  anon could read share_links directly';
exception when insufficient_privilege then
  raise notice 'PASS  anon has no table access to share_links';
end;
$$;

commit;

-- ===========================================================================
-- 8. Every public table has RLS enabled
-- ===========================================================================
select pg_temp.assert(
  (select count(*) from pg_tables t
     join pg_class c on c.relname = t.tablename
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where t.schemaname = 'public' and not c.relrowsecurity) = 0,
  'RLS is enabled on every table in the public schema');

\echo ''
\echo '================================'
\echo ' ALL RLS ASSERTIONS PASSED'
\echo '================================'
