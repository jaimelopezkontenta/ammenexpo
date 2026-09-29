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
  raise exception 'FAIL  Beto deleted Ana''s plan';
exception when insufficient_privilege then
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
-- 8. Plan creation goes through reserve_generation, not a direct INSERT
--
-- Regression in reverse: the SELECT policy used to re-query prayer_plans
-- through a STABLE function, which cannot see the row being inserted — and
-- that broke plan creation outright. Plan creation now happens inside
-- `reserve_generation` (SECURITY DEFINER, tested in generation.sql), and the
-- client's INSERT grant is revoked, so a direct insert must be rejected.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.prayer_plans (owner_id, title, duration_days, start_date, visibility)
    values ('11111111-1111-1111-1111-111111111111', 'con returning', 3, current_date, 'private')
    returning id
  $q$),
  'the client cannot create a plan with a direct INSERT ... RETURNING');

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

-- Eva's own plan, created as superuser: the client cannot INSERT directly
-- anymore (that path is reserve_generation's), so the "sharing into a circle
-- you do not belong to" test below only needs the plan to exist.
insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility)
values ('aaaa0000-0000-0000-0000-000000000003',
        '55555555-5555-5555-5555-555555555555',
        'Plan de Eva', 1, current_date, 'private');

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


-- ===========================================================================
-- B0: nadie se nombra staff a sí mismo, y la racha no se edita a mano
--
-- El grant de tabla entera sobre `profiles` convertía `is_staff` —añadido
-- después, en otra migración— en un interruptor que cualquier cuenta podía
-- pulsar sobre su propia fila. Desde `20260819100000` el rol cliente solo
-- toca `display_name` y `avatar_url`, que es lo que la app edita de verdad.
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  ('77777777-7777-7777-7777-777777777777', 'carlos@test.local',
   'authenticated', 'authenticated', '{"display_name":"Carlos"}');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles set is_staff = true
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'a normal account cannot mark itself as staff');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles set streak_count = 999
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'nor inflate its own streak');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles set streak_last_day = current_date - 30
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'nor rewrite when the streak last moved');

select pg_temp.assert(
  pg_temp.raises($q$
    select public.admin_set_staff(
      '11111111-1111-1111-1111-111111111111', true, 'ana', 'self-appointment')
  $q$),
  'and the administrative channel is not callable from a client session');

select pg_temp.assert(
  pg_temp.raises($q$
    select count(*) from public.staff_admin_events
  $q$),
  'the appointment log is not readable over the API either');

-- Lo legítimo sigue abierto: nombre y foto, sobre la fila propia.
update public.profiles set display_name = 'Ana de verdad'
 where id = '11111111-1111-1111-1111-111111111111';

select pg_temp.assert(
  (select display_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') = 'Ana de verdad',
  'editing your own name still works');

update public.profiles
   set avatar_url = 'http://127.0.0.1:54421/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.png'
 where id = '11111111-1111-1111-1111-111111111111';

select pg_temp.assert(
  (select avatar_url from public.profiles
    where id = '11111111-1111-1111-1111-111111111111')
      like '%/avatars/11111111-1111-1111-1111-111111111111/%',
  'and so does changing your own avatar');

-- La policy sigue decidiendo filas: el nombre de otra persona, cero filas.
update public.profiles set display_name = 'Suplantada'
 where id = '77777777-7777-7777-7777-777777777777';

select pg_temp.assert(
  (select display_name from public.profiles
    where id = '77777777-7777-7777-7777-777777777777') = 'Carlos',
  'and somebody else''s row stays exactly as it was');

commit;

-- La racha solo se mueve orando: el trigger es SECURITY DEFINER y no pasa por
-- el grant, así que revocarlo no apaga el canal legítimo.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.prayer_logs (user_id, plan_day_id)
values ('11111111-1111-1111-1111-111111111111',
        'dddd0000-0000-0000-0000-000000000002');

-- La lectura ya no pasa por la tabla —el grant la esconde—, sino por la RPC
-- que devuelve solo la racha del usuario autenticado.
select pg_temp.assert(
  (select streak_count from public.my_profile_data()) = 1
  and (select streak_last_day from public.my_profile_data()) = current_date,
  'the streak still moves through prayer, not through the API');

commit;

-- El canal administrativo: solo service_role, y deja actor, motivo y hora.
-- Las lecturas de comprobación van como superuser: service_role no tiene
-- grant de lectura sobre `profiles` (ni lo necesita para llamar la RPC, que
-- corre como definer).
begin;
set local role service_role;

select pg_temp.assert(
  public.admin_set_staff(
    '77777777-7777-7777-7777-777777777777', true,
    'ops-runner', 'moderation rota, week 1'),
  'the administrative channel appoints staff');

commit;

begin;

select pg_temp.assert(
  (select is_staff from public.profiles
    where id = '77777777-7777-7777-7777-777777777777'),
  'and the bit is actually set');

select pg_temp.assert(
  (select count(*) from public.staff_admin_events
    where target_user_id = '77777777-7777-7777-7777-777777777777'
      and action = 'grant'
      and actor = 'ops-runner'
      and reason = 'moderation rota, week 1') = 1,
  'with who, why and when written down');

commit;

begin;
set local role service_role;

select pg_temp.assert(
  public.admin_set_staff(
    '77777777-7777-7777-7777-777777777777', false,
    'ops-runner', 'rotation ended'),
  'and revoking goes through the same channel');

select pg_temp.assert(
  not public.admin_set_staff(
    '00000000-0000-0000-0000-000000000000', true, 'ops-runner', 'ghost'),
  'appointing a user that does not exist says so');

select pg_temp.assert(
  pg_temp.raises($q$
    select public.admin_set_staff(
      '77777777-7777-7777-7777-777777777777', true, '', 'no operator named')
  $q$),
  'an appointment without an operator is refused');

select pg_temp.assert(
  pg_temp.raises($q$
    select public.admin_set_staff(
      '77777777-7777-7777-7777-777777777777', true, 'ops-runner', '  ')
  $q$),
  'and one without a reason is refused too');

-- Append-only de verdad: ni el service_role corrige el pasado.
select pg_temp.assert(
  pg_temp.raises($q$
    update public.staff_admin_events set reason = 'rewritten'
  $q$),
  'the log cannot be rewritten');

select pg_temp.assert(
  pg_temp.raises($q$
    delete from public.staff_admin_events
  $q$),
  'nor emptied');

commit;

begin;

select pg_temp.assert(
  (select count(*) from public.staff_admin_events
    where target_user_id = '77777777-7777-7777-7777-777777777777') = 2,
  'and the log keeps both appointments, it does not overwrite');

select pg_temp.assert(
  not (select is_staff from public.profiles
    where id = '77777777-7777-7777-7777-777777777777'),
  'and the bit is back off after the revocation');

commit;

-- ===========================================================================
-- B1: la racha y el staff no se leen por la API REST
--
-- `public_profile()` los esconde desde 20260809100000, pero el grant de SELECT
-- sobre toda la tabla los dejaba a un `select` de distancia. Desde
-- `20260906100000_restrict_profile_select.sql` el rol cliente solo lee
-- `id`, `display_name`, `avatar_url`, `follower_count`, `following_count` y
-- `search_vector`; la racha y el bit de staff salen por `my_profile_data()`,
-- que solo devuelve los del usuario autenticado.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- La racha de otro, fuera de alcance: el grant de columna la rechaza.
select pg_temp.assert(
  pg_temp.raises($q$
    select streak_count from public.profiles
     where id = '77777777-7777-7777-7777-777777777777'
  $q$),
  'a user cannot read somebody else''s streak');

select pg_temp.assert(
  pg_temp.raises($q$
    select streak_last_day from public.profiles
     where id = '77777777-7777-7777-7777-777777777777'
  $q$),
  'nor the day their streak last moved');

-- Y el bit de staff, que es la llave de la moderación.
select pg_temp.assert(
  pg_temp.raises($q$
    select is_staff from public.profiles
     where id = '77777777-7777-7777-7777-777777777777'
  $q$),
  'nor somebody else''s staff bit');

-- Ni los timestamps crudos, que el perfil público ya resume en member_since.
select pg_temp.assert(
  pg_temp.raises($q$
    select created_at, updated_at from public.profiles
     where id = '77777777-7777-7777-7777-777777777777'
  $q$),
  'nor the raw timestamps');

-- Lo público sigue abierto: nombre y cara de cualquiera.
select pg_temp.assert(
  not pg_temp.raises($q$
    select display_name, avatar_url from public.profiles
     where id = '77777777-7777-7777-7777-777777777777'
  $q$),
  'display name and avatar stay readable on anyone''s profile');

-- La RPC devuelve lo del usuario autenticado: su racha y su bit, no otro.
select pg_temp.assert(
  (select streak_count from public.my_profile_data()) = 1
  and (select streak_last_day from public.my_profile_data()) = current_date
  and (select is_staff from public.my_profile_data()) = false,
  'my_profile_data returns the caller''s own streak and staff bit');

commit;

-- Para un usuario que no existe, la RPC devuelve vacío — jamás los datos de otro.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.my_profile_data()) = 0,
  'my_profile_data returns nothing for a user that does not exist');

commit;

-- ===========================================================================
-- El catálogo, entero (Oleada 1a, 2026-09-29)
--
-- Estas no miran una tabla sino el esquema completo, para que lo que se
-- arregló no vuelva a entrar por una migración nueva.
-- ===========================================================================

-- Toda clave foránea con un índice que empiece por su columna: sin él, cada
-- borrado en cascada y cada «lo de esta persona» recorre la tabla entera.
select pg_temp.assert(
  (select count(*)
     from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
         where i.indrelid = c.conrelid
           and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
      )) = 0,
  'every foreign key in public has an index that starts with its columns');

-- Lo que se puede llamar SIN sesión, cerrado a una lista. Una función nueva
-- que olvide el `revoke ... from public` hace fallar esto en vez de quedar
-- abierta a cualquiera por PostgREST. Los triggers entran también: no
-- necesitan EXECUTE para dispararse, así que nadie tiene por qué tenerlo
-- (revisión R1, S7).
select pg_temp.assert(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'EXECUTE'))
  = array[
      'email_prefs_by_token',
      'get_circle_invite_preview',
      'get_invite_preview',
      'get_shared_plan_preview',
      'plan_today',
      'reactivate_email_cadence_by_token',
      'unsubscribe_email_one_click',
      'update_email_prefs_by_token'
    ],
  'anon can execute exactly the public previews and the email-token RPCs');

-- R1 S7: y fuera de esa lista nada llega por PUBLIC. Un entorno creado con
-- los privilegios por defecto antiguos da EXECUTE directo a anon, y ahí
-- `revoke ... from public` no bastaba; la migración
-- 20260929132703_function_privileges_anon lo normaliza y esto vigila que en
-- local siga igual.
select pg_temp.assert(
  (select count(*)
     from pg_proc p
     cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.pronamespace = 'public'::regnamespace
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
      and p.proname not in (
        'email_prefs_by_token', 'get_circle_invite_preview', 'get_invite_preview',
        'get_shared_plan_preview', 'plan_today', 'reactivate_email_cadence_by_token',
        'unsubscribe_email_one_click', 'update_email_prefs_by_token'
      )) = 0,
  'no function in public is executable through PUBLIC outside the anon list');

select pg_temp.assert(
  not exists (
    select 1
      from pg_default_acl d
      cross join lateral aclexplode(d.defaclacl) a
     where d.defaclrole = 'postgres'::regrole
       and d.defaclnamespace = 'public'::regnamespace
       and d.defaclobjtype = 'f'
       and a.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
  ),
  'new functions in public get no direct EXECUTE for the API roles by default');

begin;

create function public.zz_default_privileges_probe()
returns integer language sql as 'select 1';

revoke execute on function public.zz_default_privileges_probe() from public;

select pg_temp.assert(
  not has_function_privilege('anon', 'public.zz_default_privileges_probe()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.zz_default_privileges_probe()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.zz_default_privileges_probe()', 'EXECUTE'),
  'so a new function with the usual revoke from public is closed to every API role');

rollback;

-- El filtro de moderación y el de crisis no se pueden sondear sin cuenta.
select pg_temp.assert(
  not has_function_privilege('anon', 'public.is_objectionable(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.is_crisis_text(text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.is_objectionable(text)', 'EXECUTE'),
  'the moderation and crisis classifiers are not callable without a session');

-- Lo que solo drena colas, prepara correo o administra no se puede llamar
-- con sesión de usuario: devuelven tokens push o direcciones de correo,
-- firman tokens de baja, nombran staff o mueven las colas. Es la misma lista
-- que cierra 20260929132703_function_privileges_anon.
select pg_temp.assert(
  (select count(*)
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'admin_set_flag', 'admin_set_staff', 'avatar_url_is_valid',
        'claim_email_outbox_batch', 'claim_push_outbox_batch',
        'clear_foreign_avatar_urls', 'email_address_for', 'email_apply_sunset',
        'email_cadence_hits_today', 'email_channel_allowed', 'email_habit_payload',
        'email_hmac_secret', 'email_local_hour', 'email_non_t_taken_today',
        'email_opened_app_today', 'email_outbox_claimable', 'email_prayed_today',
        'email_refresh_pause_growth', 'enqueue_all_email_jobs',
        'enqueue_digest_emails', 'enqueue_drip_emails', 'enqueue_email',
        'enqueue_habit_emails', 'enqueue_invite_used', 'enqueue_winback_emails',
        'ensure_follow', 'issue_email_prefs_token', 'mark_email_delivery',
        'mark_push_delivery', 'pending_push_outbox', 'purge_expired_rows',
        'push_outbox_claimable', 'record_email_event', 'run_email_jobs',
        'run_queue_drains', 'skip_stale_queue_rows', 'verify_email_prefs_token',
        'verse_of_the_day_for'
      )
      and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('anon', p.oid, 'EXECUTE'))) = 0,
  'queue drains, email internals and admin functions stay out of reach of user sessions');

-- Y la lista no se queda vieja en silencio: si una se renombra, esto avisa.
select pg_temp.assert(
  (select count(distinct p.proname)
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'admin_set_flag', 'admin_set_staff', 'avatar_url_is_valid',
        'claim_email_outbox_batch', 'claim_push_outbox_batch',
        'clear_foreign_avatar_urls', 'email_address_for', 'email_apply_sunset',
        'email_cadence_hits_today', 'email_channel_allowed', 'email_habit_payload',
        'email_hmac_secret', 'email_local_hour', 'email_non_t_taken_today',
        'email_opened_app_today', 'email_outbox_claimable', 'email_prayed_today',
        'email_refresh_pause_growth', 'enqueue_all_email_jobs',
        'enqueue_digest_emails', 'enqueue_drip_emails', 'enqueue_email',
        'enqueue_habit_emails', 'enqueue_invite_used', 'enqueue_winback_emails',
        'ensure_follow', 'issue_email_prefs_token', 'mark_email_delivery',
        'mark_push_delivery', 'pending_push_outbox', 'purge_expired_rows',
        'push_outbox_claimable', 'record_email_event', 'run_email_jobs',
        'run_queue_drains', 'skip_stale_queue_rows', 'verify_email_prefs_token',
        'verse_of_the_day_for'
      )) = 38,
  'every function in that list still exists under that name');

-- ===========================================================================
-- Qué columnas escribe el cliente
--
-- Las policies dicen QUIÉN puede escribir una fila; el GRANT dice QUÉ columnas.
-- Con `grant insert, update on <tabla>` de tabla entera, quien pasaba la policy
-- escribía también lo que solo debe poner el servidor: dueños, contadores,
-- rachas, tokens, marcas de moderación, quién aceptó una invitación. Cada
-- bloque comprueba primero que lo que la app hace de verdad (core/**) sigue
-- funcionando, y después que lo demás ya no.
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('c1c10000-0000-0000-0000-000000000001', 'olga@test.local',   'authenticated', 'authenticated', '{"display_name":"Olga"}'),
  ('c1c10000-0000-0000-0000-000000000002', 'adan@test.local',   'authenticated', 'authenticated', '{"display_name":"Adan"}'),
  ('c1c10000-0000-0000-0000-000000000003', 'moises@test.local', 'authenticated', 'authenticated', '{"display_name":"Moises"}'),
  ('c1c10000-0000-0000-0000-000000000004', 'ester@test.local',  'authenticated', 'authenticated', '{"display_name":"Ester"}');

-- Olga tiene un círculo público y uno privado. Adán administra el público: ese
-- rol lo pone el servidor (la app no tiene pantalla para darlo). Moisés es
-- miembro de los dos; Ester, de ninguno.
insert into public.groups (id, owner_id, name, visibility) values
  ('c1c1c000-0000-0000-0000-000000000001', 'c1c10000-0000-0000-0000-000000000001', 'El abierto de Olga', 'public'),
  ('c1c1c000-0000-0000-0000-000000000002', 'c1c10000-0000-0000-0000-000000000001', 'El cerrado de Olga', 'private');

insert into public.group_members (group_id, user_id, role) values
  ('c1c1c000-0000-0000-0000-000000000001', 'c1c10000-0000-0000-0000-000000000002', 'admin'),
  ('c1c1c000-0000-0000-0000-000000000001', 'c1c10000-0000-0000-0000-000000000003', 'member'),
  ('c1c1c000-0000-0000-0000-000000000002', 'c1c10000-0000-0000-0000-000000000003', 'member');

insert into public.prayer_plans (id, owner_id, title, theme, duration_days, start_date, visibility)
values ('c1c1f000-0000-0000-0000-000000000001', 'c1c10000-0000-0000-0000-000000000001',
        'El plan de Olga', 'paz', 3, current_date, 'private');

commit;

-- ---------------------------------------------------------------------------
-- groups: crear y editar, sí; dueño, censo, racha y token, no
--
-- Un admin que no era el dueño podía ponerse `owner_id`, y con eso echar a la
-- dueña (`protect_group_owner` se fía de esa columna) y borrar el círculo.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c10000-0000-0000-0000-000000000001","role":"authenticated"}';

-- useCreateCircle, con sus columnas exactas.
select pg_temp.assert(
  not pg_temp.raises($q$
    insert into public.groups (owner_id, name, description, visibility)
    values ('c1c10000-0000-0000-0000-000000000001', 'El nuevo de Olga',
            'Para orar juntos', 'private')
  $q$),
  'creating a circle with the columns the app sends still works');

do $$
declare
  forced record;
begin
  for forced in
    select * from (values
      ('id',              $v$'c1c1c000-0000-0000-0000-0000000000ff'$v$),
      ('member_count',    '5000'),
      ('streak_count',    '365'),
      ('streak_last_day', 'current_date'),
      ('invite_token',    $v$'hola'$v$),
      ('avatar_url',      $v$'https://example.com/pixel.png'$v$),
      ('created_at',      $v$'2000-01-01'$v$),
      ('updated_at',      $v$'2000-01-01'$v$)
    ) as v (col, val)
  loop
    if not pg_temp.raises(format(
      'insert into public.groups (owner_id, name, %I) values (%L, %L, %s)',
      forced.col, 'c1c10000-0000-0000-0000-000000000001', 'Con trampa', forced.val))
    then
      raise exception 'FAIL  a new circle cannot choose its own %', forced.col;
    end if;
    raise notice 'PASS  a new circle cannot choose its own %', forced.col;
  end loop;
end;
$$;

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.groups (owner_id, name)
    values ('c1c10000-0000-0000-0000-000000000004', 'A nombre de Ester')
  $q$),
  'nor be created in somebody else''s name');

commit;

select pg_temp.assert(
  (select member_count = 1 and streak_count = 0 and invite_token ~ '^[0-9a-f]{32}$'
     from public.groups where name = 'El nuevo de Olga'),
  'the server fills in the new circle''s count, streak and invite token');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c10000-0000-0000-0000-000000000002","role":"authenticated"}';

with changed as (
  update public.groups
     set name = 'El abierto (renombrado)',
         description = 'Ahora con descripción',
         visibility = 'private'
   where id = 'c1c1c000-0000-0000-0000-000000000001'
  returning 1)
select pg_temp.assert(count(*) = 1,
  'an admin still edits the circle''s name, description and visibility')
  from changed;

with changed as (
  update public.groups set visibility = 'public'
   where id = 'c1c1c000-0000-0000-0000-000000000001'
  returning 1)
select pg_temp.assert(count(*) = 1,
  'and back')
  from changed;

do $$
declare
  forced record;
begin
  for forced in
    select * from (values
      ('owner_id',        $v$'c1c10000-0000-0000-0000-000000000002'$v$),
      ('member_count',    '9999'),
      ('streak_count',    '1000'),
      ('streak_last_day', 'current_date'),
      ('invite_token',    $v$'elegido-a-mano'$v$),
      ('avatar_url',      $v$'https://example.com/pixel.png'$v$),
      ('created_at',      $v$'1999-01-01'$v$),
      ('updated_at',      $v$'1999-01-01'$v$)
    ) as v (col, val)
  loop
    if not pg_temp.raises(format(
      'update public.groups set %I = %s where id = %L',
      forced.col, forced.val, 'c1c1c000-0000-0000-0000-000000000001'))
    then
      raise exception 'FAIL  an admin cannot rewrite the circle''s %', forced.col;
    end if;
    raise notice 'PASS  an admin cannot rewrite the circle''s %', forced.col;
  end loop;
end;
$$;

select pg_temp.assert(
  public.rotate_circle_invite_token('c1c1c000-0000-0000-0000-000000000001') ~ '^[0-9a-f]{32}$',
  'the invite link still changes, through the one RPC meant for it');

commit;

select pg_temp.assert(
  (select owner_id = 'c1c10000-0000-0000-0000-000000000001' and member_count = 3
     from public.groups where id = 'c1c1c000-0000-0000-0000-000000000001'),
  'Olga still owns the circle, and its count is the real one');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c10000-0000-0000-0000-000000000003","role":"authenticated"}';

with changed as (
  update public.groups set name = 'Ahora es mío'
   where id = 'c1c1c000-0000-0000-0000-000000000001'
  returning 1)
select pg_temp.assert(count(*) = 0,
  'a plain member still cannot edit the circle')
  from changed;

commit;

-- ---------------------------------------------------------------------------
-- group_members: el rol no se elige al entrar, y la fila de la dueña no se toca
--
-- La policy de INSERT deja a cualquiera unirse a un círculo público, pero no
-- miraba `role`: se entraba como admin. Y un admin podía degradar a la dueña
-- (`is_group_admin` solo mira el rol) o coronar a otro.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c10000-0000-0000-0000-000000000002","role":"authenticated"}';

with changed as (
  update public.group_members set role = 'member'
   where group_id = 'c1c1c000-0000-0000-0000-000000000001'
     and user_id = 'c1c10000-0000-0000-0000-000000000001'
  returning 1)
select pg_temp.assert(count(*) = 0,
  'an admin cannot demote the circle''s owner')
  from changed;

select pg_temp.assert(
  pg_temp.raises($q$
    update public.group_members set role = 'owner'
     where group_id = 'c1c1c000-0000-0000-0000-000000000001'
       and user_id = 'c1c10000-0000-0000-0000-000000000003'
  $q$),
  'nor crown somebody else owner');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.group_members set user_id = 'c1c10000-0000-0000-0000-000000000004'
     where group_id = 'c1c1c000-0000-0000-0000-000000000001'
       and user_id = 'c1c10000-0000-0000-0000-000000000003'
  $q$),
  'nor hand a membership over to somebody who never joined');

with changed as (
  update public.group_members set role = 'admin'
   where group_id = 'c1c1c000-0000-0000-0000-000000000001'
     and user_id = 'c1c10000-0000-0000-0000-000000000003'
  returning 1)
select pg_temp.assert(count(*) = 1,
  'but still makes a member admin')
  from changed;

with changed as (
  update public.group_members set role = 'member'
   where group_id = 'c1c1c000-0000-0000-0000-000000000001'
     and user_id = 'c1c10000-0000-0000-0000-000000000003'
  returning 1)
select pg_temp.assert(count(*) = 1,
  'and a plain member again')
  from changed;

commit;

select pg_temp.assert(
  (select role = 'owner' from public.group_members
    where group_id = 'c1c1c000-0000-0000-0000-000000000001'
      and user_id = 'c1c10000-0000-0000-0000-000000000001'),
  'Olga is still the owner on the roster too');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c10000-0000-0000-0000-000000000004","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.group_members (group_id, user_id, role)
    values ('c1c1c000-0000-0000-0000-000000000001',
            'c1c10000-0000-0000-0000-000000000004', 'admin')
  $q$),
  'nobody walks into a public circle as its admin');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.group_members (group_id, user_id, role)
    values ('c1c1c000-0000-0000-0000-000000000001',
            'c1c10000-0000-0000-0000-000000000004', 'owner')
  $q$),
  'or as its owner');

-- useJoinPublicCircle
select pg_temp.assert(
  not pg_temp.raises($q$
    insert into public.group_members (group_id, user_id)
    values ('c1c1c000-0000-0000-0000-000000000001',
            'c1c10000-0000-0000-0000-000000000004')
  $q$),
  'joining a public circle the way the app does still works');

select pg_temp.assert(
  (select role = 'member' from public.group_members
    where group_id = 'c1c1c000-0000-0000-0000-000000000001'
      and user_id = 'c1c10000-0000-0000-0000-000000000004'),
  'and lands as a plain member');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.group_members (group_id, user_id)
    values ('c1c1c000-0000-0000-0000-000000000002',
            'c1c10000-0000-0000-0000-000000000004')
  $q$),
  'a private circle still needs an invitation');

commit;

select invite_token as cerrado_token from public.groups
 where id = 'c1c1c000-0000-0000-0000-000000000002' \gset

-- useJoinCircle
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1c10000-0000-0000-0000-000000000004","role":"authenticated"}';

select pg_temp.assert(
  public.join_group_with_token(:'cerrado_token') = 'c1c1c000-0000-0000-0000-000000000002',
  'and the invitation still lets her in');

commit;

\echo ''
\echo '================================'
\echo ' ALL RLS ASSERTIONS PASSED'
\echo '================================'
