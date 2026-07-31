\set ON_ERROR_STOP on

-- The day boundary belongs to the person, not to the server.
--
-- These assertions only mean anything at certain hours of the UTC day, so they
-- pin the clock instead of trusting whenever the suite happens to run: each
-- block states the UTC instant it is reasoning about.

\set HIRO '''aaaa1111-1111-1111-1111-111111111111'''
\set MARA '''bbbb2222-2222-2222-2222-222222222222'''

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

begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:HIRO, 'hiro@test.local', 'authenticated', 'authenticated', '{"display_name":"Hiro"}'),
  (:MARA, 'mara@test.local', 'authenticated', 'authenticated', '{"display_name":"Mara"}');

update public.profile_settings set timezone = 'Asia/Tokyo'         where id = :HIRO;
update public.profile_settings set timezone = 'America/Mexico_City' where id = :MARA;

commit;

-- ===========================================================================
-- The timezone is normalised on the way in
-- ===========================================================================
begin;

select pg_temp.assert(
  (select timezone from public.profile_settings where id = :HIRO) = 'Asia/Tokyo',
  'a real timezone is stored as given');

update public.profile_settings set timezone = 'Mars/Olympus_Mons' where id = :HIRO;

select pg_temp.assert(
  (select timezone from public.profile_settings where id = :HIRO) = 'UTC',
  'a timezone Postgres cannot interpret falls back to UTC instead of being stored');

update public.profile_settings set timezone = 'Asia/Tokyo' where id = :HIRO;

commit;

-- ===========================================================================
-- local_today reads each person's own calendar
-- ===========================================================================
begin;

-- 2026-07-31 22:30 UTC. In Tokyo it is already the 1st; in Mexico City it is
-- still the afternoon of the 31st. One instant, two dates.
set local timezone = 'UTC';

select pg_temp.assert(
  (select (timestamptz '2026-07-31 22:30:00+00' at time zone 'Asia/Tokyo')::date)
    = date '2026-08-01',
  'at 22:30 UTC Tokyo is already on the next day');

select pg_temp.assert(
  (select (timestamptz '2026-07-31 22:30:00+00' at time zone 'America/Mexico_City')::date)
    = date '2026-07-31',
  'and Mexico City is still on the previous one');

select pg_temp.assert(
  public.local_today(:HIRO) = (now() at time zone 'Asia/Tokyo')::date,
  'local_today follows the stored timezone');

select pg_temp.assert(
  public.local_today(:MARA) = (now() at time zone 'America/Mexico_City')::date,
  'and it differs per user');

commit;

-- ===========================================================================
-- The unlock gate uses the plan owner's day
-- ===========================================================================
begin;

-- Hiro's plan starts on his own today. Under the old UTC rule, a plan created
-- in Tokyo in the morning started "yesterday".
insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status)
values ('ffff0000-0000-0000-0000-000000000001', :HIRO, 'Plan de Hiro', 3,
        public.local_today(:HIRO), 'link', 'active');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body, unlock_date)
values
  ('ffff0000-0000-0000-0000-000000000001', 1, 'Día uno', 'Oración',
   public.local_today(:HIRO)),
  ('ffff0000-0000-0000-0000-000000000001', 2, 'Día dos', 'Oración',
   public.local_today(:HIRO) + 1);

select pg_temp.assert(
  public.plan_today('ffff0000-0000-0000-0000-000000000001') = public.local_today(:HIRO),
  'a plan is measured on its owner''s calendar');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaa1111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days
    where plan_id = 'ffff0000-0000-0000-0000-000000000001') = 1,
  'Hiro sees today''s day in Tokyo, and only that one');

select pg_temp.assert(
  (select day_number from public.prayer_plan_days
    where plan_id = 'ffff0000-0000-0000-0000-000000000001') = 1,
  'and it is day one, not a day borrowed from the server clock');

commit;

-- ===========================================================================
-- A reader in another timezone sees the owner's day, not their own
-- ===========================================================================
begin;

insert into public.share_links (token, scope, plan_id, created_by)
values ('hiro-plan-token', 'plan', 'ffff0000-0000-0000-0000-000000000001', :HIRO);

insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
values ('ffff0000-0000-0000-0000-000000000001', :MARA, :HIRO);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbb2222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days
    where plan_id = 'ffff0000-0000-0000-0000-000000000001') = 1,
  'Mara in Mexico sees exactly one day of Hiro''s plan');

-- The point of the whole design: praying for someone means praying for the day
-- they are on, not the day you are on.
select pg_temp.assert(
  (select day_number from public.prayer_plan_days
    where plan_id = 'ffff0000-0000-0000-0000-000000000001') = 1,
  'and it is Hiro''s day, decided by his calendar rather than hers');

commit;

begin;

select pg_temp.assert(
  (select count(*) from public.get_shared_plan_preview('hiro-plan-token')) = 1,
  'the anonymous preview also uses the owner''s day');

commit;

-- ===========================================================================
-- The assertion that actually proves the bug is gone
--
-- Everything above can pass under the old UTC rule depending on the hour the
-- suite happens to run. This block picks a timezone that is guaranteed to be on
-- a different calendar day from the server *right now* — Kiritimati (UTC+14)
-- once UTC has passed 10:00, Midway (UTC-11) before that — so the old and new
-- rules cannot agree, whenever it runs.
-- ===========================================================================
begin;

update public.profile_settings
   set timezone = case
     when extract(hour from now() at time zone 'UTC') >= 10
       then 'Pacific/Kiritimati'
       else 'Pacific/Midway'
   end
 where id = :MARA;

select pg_temp.assert(
  public.local_today(:MARA) <> current_date,
  'the chosen timezone really is on a different day from the server');

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status)
values ('ffff0000-0000-0000-0000-000000000002', :MARA, 'Plan de Mara', 3,
        public.local_today(:MARA), 'private', 'active');

-- Day 1 is her today; day 2 is her tomorrow. Under the old rule one of these
-- two comparisons lands on the wrong side, because both are measured against
-- the server's date instead of hers.
insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body, unlock_date)
values
  ('ffff0000-0000-0000-0000-000000000002', 1, 'Su hoy', 'Oración',
   public.local_today(:MARA)),
  ('ffff0000-0000-0000-0000-000000000002', 2, 'Su mañana', 'Oración',
   public.local_today(:MARA) + 1);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbb2222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.prayer_plan_days
    where plan_id = 'ffff0000-0000-0000-0000-000000000002') = 1,
  'exactly one day is readable even though her date differs from the server''s');

select pg_temp.assert(
  (select day_number from public.prayer_plan_days
    where plan_id = 'ffff0000-0000-0000-0000-000000000002') = 1,
  'and it is her today: not tomorrow arriving early, not today withheld');

commit;

-- ===========================================================================
-- Links stop on their own
-- ===========================================================================
begin;

select pg_temp.assert(
  (select expires_at from public.share_links where token = 'hiro-plan-token') is not null,
  'a share link gets an expiry even when nobody asked for one');

select pg_temp.assert(
  (select expires_at from public.share_links where token = 'hiro-plan-token')
    > now() + interval '20 days',
  'and it outlives the plan by a comfortable margin');

insert into public.share_links (token, scope, plan_id, created_by, expires_at)
values ('explicit-expiry', 'plan', 'ffff0000-0000-0000-0000-000000000001', :HIRO,
        now() + interval '1 day');

select pg_temp.assert(
  (select expires_at from public.share_links where token = 'explicit-expiry')
    < now() + interval '2 days',
  'an expiry chosen on purpose is left alone');

commit;

-- ===========================================================================
-- "Who prayed for you" runs on the reader's calendar too
--
-- This was missed when the rest of the timezone work landed. With the old
-- `current_date` default, a viewer whose local date is behind the server's
-- stopped seeing today's intercessions partway through their own evening.
-- ===========================================================================
begin;

-- Mara is on Kiritimati or Midway (whichever is on a different day from the
-- server right now — see the block above), and Hiro prays for her.
-- The cut has to be the viewer's own midnight. Placing one intercession an hour
-- either side of it is what tells the two rules apart: under the old
-- `current_date` both land on the same side of the server's midnight instead,
-- for any viewer who is not on UTC.
insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status)
values ('ffff0000-0000-0000-0000-000000000003', :MARA, 'Plan de Mara', 3,
        public.local_today(:MARA) - 1, 'link', 'active');

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values ('dddd1111-0000-0000-0000-000000000001',
        'ffff0000-0000-0000-0000-000000000003', 1, 'Ayer', 'Oración',
        public.local_today(:MARA) - 1),
       ('dddd1111-0000-0000-0000-000000000002',
        'ffff0000-0000-0000-0000-000000000003', 2, 'Su hoy', 'Oración',
        public.local_today(:MARA));

insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
values ('ffff0000-0000-0000-0000-000000000003', :HIRO, :MARA);

insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id, created_at)
select 'dddd1111-0000-0000-0000-000000000001', :MARA, :HIRO,
       (public.local_today(:MARA)::timestamp - interval '1 hour')
         at time zone public.valid_timezone(ps.timezone)
from public.profile_settings ps where ps.id = :MARA;

insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id, created_at)
select 'dddd1111-0000-0000-0000-000000000002', :MARA, :HIRO,
       (public.local_today(:MARA)::timestamp + interval '1 hour')
         at time zone public.valid_timezone(ps.timezone)
from public.profile_settings ps where ps.id = :MARA;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbb2222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  public.local_today(:MARA) <> current_date,
  'Mara really is on a different calendar day from the server');

select pg_temp.assert(
  (select count(*) from public.who_prayed_for_me()) = 1,
  'exactly one of the two intercessions counts as today');

select pg_temp.assert(
  (select day_number from public.who_prayed_for_me()) = 2::smallint,
  'and it is the one after her own midnight, not the server''s');

select pg_temp.assert(
  (select intercessor_name from public.who_prayed_for_me()) = 'Hiro',
  'reported by name');

select pg_temp.assert(
  (select count(*) from public.who_prayed_for_me(public.local_today(:MARA) - 1)) = 2,
  'asking from yesterday brings back both');

commit;

-- ===========================================================================
-- The streak counts the user's own days
-- ===========================================================================
begin;

update public.profiles
   set streak_count = 4, streak_last_day = public.local_today(:HIRO) - 1
 where id = :HIRO;

insert into public.prayer_logs (user_id, plan_day_id)
select :HIRO, id from public.prayer_plan_days
where plan_id = 'ffff0000-0000-0000-0000-000000000001' and day_number = 1;

select pg_temp.assert(
  (select streak_count from public.profiles where id = :HIRO) = 5,
  'praying on Hiro''s consecutive days continues his streak');

select pg_temp.assert(
  (select streak_last_day from public.profiles where id = :HIRO)
    = public.local_today(:HIRO),
  'and the streak is stamped with his date, not the server''s');

rollback;

\echo ''
\echo '===================================='
\echo ' TIMEZONE ASSERTIONS PASSED'
\echo '===================================='
