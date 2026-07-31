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
-- 8. INSERT ... RETURNING works for the owner
--
-- Regression: the SELECT policy used to re-query prayer_plans through a STABLE
-- function, which cannot see the row being inserted. Every client library
-- returns the created row by default, so this broke plan creation outright
-- while reporting itself as a WITH CHECK violation.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

with created as (
  insert into public.prayer_plans (owner_id, title, duration_days, start_date, visibility)
  values ('11111111-1111-1111-1111-111111111111', 'con returning', 3, current_date, 'private')
  returning id
)
select pg_temp.assert(
  (select count(*) from created) = 1,
  'a plan can be created with INSERT ... RETURNING');

with created as (
  insert into public.groups (owner_id, name) values
    ('11111111-1111-1111-1111-111111111111', 'Grupo con returning')
  returning id
)
select pg_temp.assert(
  (select count(*) from created) = 1,
  'a group can be created with INSERT ... RETURNING');

rollback;

-- ===========================================================================
-- 8b. A plan shared with several circles
--
-- Regression: plan_shares.group_id existed but nothing read it — access checks
-- only looked at prayer_plans.group_id, which holds a single circle. Sharing
-- with two circles wrote both rows and granted access to nobody, silently.
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  ('44444444-4444-4444-4444-444444444444', 'dani@test.local', 'authenticated', 'authenticated', '{"display_name":"Dani"}'),
  ('55555555-5555-5555-5555-555555555555', 'eva@test.local',  'authenticated', 'authenticated', '{"display_name":"Eva"}');

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility)
values ('aaaa0000-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'Plan compartido con circulos', 1, current_date, 'private');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body, unlock_date)
values ('aaaa0000-0000-0000-0000-000000000002', 1, 'Día uno', 'Privado', current_date);

-- Ana owns both circles; the on_group_created trigger adds her as a member.
insert into public.groups (id, owner_id, name)
values ('99990000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Familia'),
       ('99990000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Célula');

insert into public.group_members (group_id, user_id) values
  ('99990000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('99990000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444');

insert into public.plan_shares (plan_id, group_id, created_by) values
  ('aaaa0000-0000-0000-0000-000000000002', '99990000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111'),
  ('aaaa0000-0000-0000-0000-000000000002', '99990000-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select pg_temp.assert(
  (select count(*) from public.prayer_plans
    where id = 'aaaa0000-0000-0000-0000-000000000002') = 1,
  'a member of the first circle sees the shared plan');
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select pg_temp.assert(
  (select count(*) from public.prayer_plans
    where id = 'aaaa0000-0000-0000-0000-000000000002') = 1,
  'a member of the second circle sees it too');

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days
    where plan_id = 'aaaa0000-0000-0000-0000-000000000002') = 1,
  'and can read the unlocked day, so they can pray for it');
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select pg_temp.assert(
  (select count(*) from public.prayer_plans
    where id = 'aaaa0000-0000-0000-0000-000000000002') = 0,
  'someone in neither circle does not');
commit;

-- Sharing into a circle you do not belong to must be rejected.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

do $$
begin
  insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility)
  values ('aaaa0000-0000-0000-0000-000000000003',
          '55555555-5555-5555-5555-555555555555', 'Plan de Eva', 1, current_date, 'private');

  insert into public.plan_shares (plan_id, group_id, created_by)
  values ('aaaa0000-0000-0000-0000-000000000003',
          '99990000-0000-0000-0000-000000000001',
          '55555555-5555-5555-5555-555555555555');

  raise exception 'FAIL  sharing into a circle you do not belong to was allowed';
exception when insufficient_privilege then
  raise notice 'PASS  cannot share a plan into a circle you do not belong to';
end;
$$;

rollback;

-- ===========================================================================
-- 9. Every public table has RLS enabled
-- ===========================================================================
select pg_temp.assert(
  (select count(*) from pg_tables t
     join pg_class c on c.relname = t.tablename
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where t.schemaname = 'public' and not c.relrowsecurity) = 0,
  'RLS is enabled on every table in the public schema');


-- ===========================================================================
-- The owner's own prayer stays the owner's
--
-- 20260730100200 promised this in a comment from the very first migration —
-- "never prayer_body, the personal prayer text stays private even when the link
-- is public" — but until the column grant landed it was only true of the RPCs'
-- column lists. The table grant was table-wide and RLS is row-level, so anyone
-- a plan was shared with could simply ask for the column.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days) > 0,
  'Beto can still read the days of the plan shared with him');

select pg_temp.assert(
  pg_temp.raises($q$ select prayer_body from public.prayer_plan_days $q$),
  'but not Ana''s first-person prayer');

select pg_temp.assert(
  pg_temp.raises($q$ select daily_action from public.prayer_plan_days $q$),
  'nor the action she was given to do');

select pg_temp.assert(
  not pg_temp.raises($q$ select intercessor_prayer from public.prayer_plan_days $q$),
  'the prayer written for him to pray is his to read');

-- The interpretation joined them. It is written in the second person *to Ana*
-- — "si hoy sientes el pecho apretado" — and names what the intercessor prayer
-- is careful not to: it said "tu padre" while the prayer said "alguien a quien
-- ama". Beto was reading Ana's mail with her request spelled out in it.
select pg_temp.assert(
  pg_temp.raises($q$ select interpretation from public.prayer_plan_days $q$),
  'nor what the day was saying to her');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.get_my_day('aaaa0000-0000-0000-0000-000000000001')) = 1,
  'Ana reads her own day through get_my_day');

select pg_temp.assert(
  (select prayer_body is not null from public.get_my_day('aaaa0000-0000-0000-0000-000000000001')),
  'and it carries the prayer the column grant hides from everyone else');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.get_my_day('aaaa0000-0000-0000-0000-000000000001')) = 0,
  'and Beto gets nothing from it, shared plan or not');

-- Belt and braces: the column grant is what enforces it, but the two RPCs run
-- as the *definer* in one case, so a column list quietly re-added there would
-- reopen the door without any grant changing.
select pg_temp.assert(
  pg_temp.raises($q$ select interpretation from public.plans_shared_with_me() $q$),
  'the Orar tab does not carry the interpretation either');

select pg_temp.assert(
  pg_temp.raises(
    $q$ select interpretation from public.get_shared_plan_preview('x') $q$),
  'and neither does the public link, which is read by strangers');

commit;


-- ===========================================================================
-- Leaving, and taking everything with you
--
-- The app collects health, family and faith. Under the GDPR that is
-- special-category data, and there was no way out of it from inside the app.
-- ===========================================================================
-- Read auth.users as the superuser: `authenticated` has no access to it, which
-- is exactly why the account deletion has to be a definer function.
begin;

select pg_temp.assert(
  (select count(*) from auth.users where id = '22222222-2222-2222-2222-222222222222') = 1,
  'Beto exists before he asks to leave');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select public.delete_my_account();

commit;

begin;

select pg_temp.assert(
  (select count(*) from auth.users where id = '22222222-2222-2222-2222-222222222222') = 0,
  'and afterwards he does not');

select pg_temp.assert(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 0,
  'his profile went with him');

select pg_temp.assert(
  (select count(*) from public.intercessions where intercessor_id = '22222222-2222-2222-2222-222222222222') = 0,
  'and so did every prayer he offered');

-- The one that matters if the cascade is ever loosened: no row anywhere should
-- point at a user that no longer exists.
select pg_temp.assert(
  (select count(*) from public.profiles pr
     left join auth.users u on u.id = pr.id where u.id is null) = 0,
  'nothing is left pointing at a deleted account');

select pg_temp.assert(
  (select count(*) from auth.users where id = '11111111-1111-1111-1111-111111111111') = 1,
  'and Ana is untouched');

commit;

begin;
set local role anon;

select pg_temp.assert(
  pg_temp.raises($q$ select public.delete_my_account() $q$),
  'nobody without a session can call it');

commit;


-- ===========================================================================
-- The history, and the line it must not cross
--
-- Being able to reread yesterday is the point; being able to read tomorrow
-- would quietly undo one-day-per-day, which is the mechanic the whole product
-- rests on.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.my_plan_days('aaaa0000-0000-0000-0000-000000000001')
    where unlocked) = 2,
  'Ana sees the days she has reached, not just the last one');

-- Los días que faltan sí aparecen ahora, porque un plan de 30 días que se corta
-- en el de hoy no parece que continúe. Lo que no aparece es su contenido.
select pg_temp.assert(
  (select count(*) from public.my_plan_days('aaaa0000-0000-0000-0000-000000000001')) = 3,
  'and the ones still to come are listed too, so the plan looks like a path');

select pg_temp.assert(
  (select bool_and(title is null and scripture_ref is null and id is null)
     from public.my_plan_days('aaaa0000-0000-0000-0000-000000000001')
    where not unlocked),
  'but a day that has not arrived leaks neither its title, its verse nor its id');

select pg_temp.assert(
  (select bool_and(unlock_date is not null)
     from public.my_plan_days('aaaa0000-0000-0000-0000-000000000001')
    where not unlocked),
  'only when it opens');

select pg_temp.assert(
  (select day_number from public.get_my_day('aaaa0000-0000-0000-0000-000000000001', 1::smallint)) = 1::smallint,
  'she can open an earlier day by its number');

select pg_temp.assert(
  (select count(*) from public.get_my_day('aaaa0000-0000-0000-0000-000000000001', 3::smallint)) = 0,
  'asking for a day that has not unlocked returns nothing');

select pg_temp.assert(
  (select day_number from public.get_my_day('aaaa0000-0000-0000-0000-000000000001')) = 2::smallint,
  'and asking for no day in particular still means today');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.my_plan_days('aaaa0000-0000-0000-0000-000000000001')) = 0,
  'a plan shared with Beto is still not his history');

commit;

\echo ''
\echo '================================'
\echo ' ALL RLS ASSERTIONS PASSED'
\echo '================================'
