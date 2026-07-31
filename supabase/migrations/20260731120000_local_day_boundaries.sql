-- Ammen — a day boundary that belongs to the person, not to the server.
--
-- Everything that decides "has today's day arrived?" compared against
-- current_date, which is the *server's* date in UTC. The user's timezone was
-- already captured at onboarding and simply never used.
--
--   Tokyo (UTC+9):  at 08:00 local it is still 23:00 UTC the previous day, so
--                   today's day had not appeared when the person sat down to
--                   pray. The reminder fires and there is nothing to read.
--   Mexico (UTC-6): at 18:00 local it is already tomorrow in UTC, so the next
--                   day unlocked six hours early. One-day-per-day, the mechanic
--                   the whole product rests on, could be outrun.

-- ---------------------------------------------------------------------------
-- Whose calendar?
--
-- A shared plan is read on the *owner's* calendar, not the reader's. "Day 3 of
-- Ana's plan" is defined by Ana's days; someone praying for her from Tokyo
-- should see the day she is on, not one ahead of her.
-- ---------------------------------------------------------------------------

create function public.local_today(p_user uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
begin
  select ps.timezone into tz
  from public.profile_settings ps
  where ps.id = p_user;

  if tz is null or btrim(tz) = '' then
    tz := 'UTC';
  end if;

  return (now() at time zone tz)::date;
exception
  when others then
    -- An unparseable stored timezone must not make someone's day unreadable.
    -- Falling back to UTC is the old behaviour: wrong by hours, never broken.
    return (now() at time zone 'UTC')::date;
end;
$$;

create function public.plan_today(p_plan uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select public.local_today(p.owner_id)
  from public.prayer_plans p
  where p.id = p_plan;
$$;

revoke execute on function public.local_today(uuid) from public;
revoke execute on function public.plan_today(uuid) from public;
grant execute on function public.local_today(uuid) to authenticated;
grant execute on function public.plan_today(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The unlock gate, in three places
-- ---------------------------------------------------------------------------

create or replace function public.can_read_plan_day(did uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.prayer_plan_days d
    where d.id = did
      and d.unlock_date <= public.plan_today(d.plan_id)
      and public.can_read_plan(d.plan_id)
  );
$$;

drop policy "unlocked days are readable by anyone who can read the plan"
  on public.prayer_plan_days;

create policy "unlocked days are readable by anyone who can read the plan"
  on public.prayer_plan_days for select to authenticated
  using (
    unlock_date <= public.plan_today(plan_id)
    and public.can_read_plan(plan_id)
  );

create or replace function public.get_shared_plan_preview(p_token text)
returns table (
  plan_id uuid,
  plan_title text,
  plan_theme text,
  owner_name text,
  owner_avatar_url text,
  day_id uuid,
  day_number smallint,
  day_title text,
  scripture_ref text,
  scripture_text text,
  interpretation text,
  intercession_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.title,
    p.theme,
    pr.display_name,
    pr.avatar_url,
    d.id,
    d.day_number,
    d.title,
    d.scripture_ref,
    d.scripture_text,
    d.interpretation,
    d.intercession_count
  from public.share_links sl
  join public.prayer_plans p on p.id = sl.plan_id
  join public.profiles pr on pr.id = p.owner_id
  join public.prayer_plan_days d on d.plan_id = p.id
  where sl.token = p_token
    and sl.scope = 'plan'
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now())
    and p.status = 'active'
    -- The owner's day, not the visitor's: an anonymous reader has no timezone
    -- of their own here anyway.
    and d.unlock_date <= public.local_today(p.owner_id)
  order by d.day_number desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- The streak counts the user's days
-- ---------------------------------------------------------------------------

create or replace function public.bump_personal_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.local_today(new.user_id);
  last_day date;
  current_streak integer;
begin
  select p.streak_last_day, p.streak_count
    into last_day, current_streak
  from public.profiles p
  where p.id = new.user_id;

  if last_day = today then
    return new;
  elsif last_day >= today - 2 then
    -- Yesterday, or the day before: the grace day.
    current_streak := coalesce(current_streak, 0) + 1;
  else
    current_streak := 1;
  end if;

  update public.profiles
     set streak_count = current_streak,
         streak_last_day = today
   where id = new.user_id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- A plan starts on the day its owner is actually living
-- ---------------------------------------------------------------------------

-- auth.uid() bare rather than wrapped in a subselect: a DEFAULT expression
-- cannot contain a subquery, and the usual (select auth.uid()) idiom exists to
-- help the planner inside policies, which does not apply here.
alter table public.prayer_plans
  alter column start_date set default public.local_today(auth.uid());

-- ---------------------------------------------------------------------------
-- Only store timezones we can interpret
--
-- The value comes from the device. Validating once on write is far cheaper than
-- guarding every read, and keeps the exception handler above as a backstop for
-- rows written before this migration rather than a routine code path.
-- ---------------------------------------------------------------------------

create function public.valid_timezone(tz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when tz is null or btrim(tz) = '' then 'UTC'
    when exists (select 1 from pg_catalog.pg_timezone_names n where n.name = btrim(tz))
      then btrim(tz)
    else 'UTC'
  end;
$$;

revoke execute on function public.valid_timezone(text) from public;
grant execute on function public.valid_timezone(text) to authenticated;

-- A trigger rather than a fix inside complete_onboarding: the settings screen
-- in the next phase will write this column too, and normalising at the table is
-- the only place that cannot be forgotten by a future caller.
create function public.normalize_settings_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.timezone := public.valid_timezone(new.timezone);
  return new;
end;
$$;

create trigger profile_settings_normalize_timezone
  before insert or update of timezone on public.profile_settings
  for each row execute function public.normalize_settings_timezone();

update public.profile_settings
   set timezone = public.valid_timezone(timezone)
 where timezone is distinct from public.valid_timezone(timezone);
