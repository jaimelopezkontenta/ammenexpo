-- Ammen — a forgiving streak, and the list of people you can pray for.

-- ---------------------------------------------------------------------------
-- One day of grace
--
-- People arrive at this app in grief, anxiety or illness. A streak that resets
-- the first day someone is too flattened to open their phone punishes exactly
-- the person the product exists for, and "you lost your streak" reads as a
-- spiritual failure rather than a missed notification. Missing one day keeps
-- the streak; missing two consecutive days resets it.
-- ---------------------------------------------------------------------------

create or replace function public.bump_personal_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := current_date;
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
-- plans_shared_with_me
--
-- SECURITY INVOKER on purpose: the caller's own RLS decides which plans are
-- visible and hides days that have not unlocked, so this function cannot widen
-- access by accident. It exists to avoid N+1 round trips, not to bypass policy.
-- ---------------------------------------------------------------------------

create function public.plans_shared_with_me()
returns table (
  plan_id uuid,
  plan_title text,
  owner_id uuid,
  owner_name text,
  owner_avatar_url text,
  day_id uuid,
  day_number smallint,
  day_title text,
  scripture_ref text,
  interpretation text,
  already_prayed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Wrapped in a subquery because a SQL function body cannot ORDER BY the name
  -- of one of its own OUT parameters, and the ordering is the point: people you
  -- have not prayed for yet come first.
  select *
  from (
    select
      p.id as plan_id,
      p.title as plan_title,
      p.owner_id as owner_id,
      pr.display_name as owner_name,
      pr.avatar_url as owner_avatar_url,
      d.id as day_id,
      d.day_number as day_number,
      d.title as day_title,
      d.scripture_ref as scripture_ref,
      d.interpretation as interpretation,
      exists (
        select 1 from public.intercessions i
        where i.plan_day_id = d.id
          and i.intercessor_id = (select auth.uid())
      ) as already_prayed
    from public.prayer_plans p
    join public.profiles pr on pr.id = p.owner_id
    join lateral (
      select dd.*
      from public.prayer_plan_days dd
      where dd.plan_id = p.id
      order by dd.day_number desc
      limit 1
    ) d on true
    where p.owner_id <> (select auth.uid())
      and p.status = 'active'
  ) rows
  order by rows.already_prayed, rows.owner_name;
$$;

revoke execute on function public.plans_shared_with_me() from public;
grant execute on function public.plans_shared_with_me() to authenticated;

-- ---------------------------------------------------------------------------
-- who_prayed_for_me
--
-- The other half of the loop: the plan owner seeing who showed up today.
-- ---------------------------------------------------------------------------

create function public.who_prayed_for_me(p_since date default current_date)
returns table (
  intercession_id uuid,
  intercessor_id uuid,
  intercessor_name text,
  intercessor_avatar_url text,
  message text,
  day_number smallint,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    i.id,
    i.intercessor_id,
    pr.display_name,
    pr.avatar_url,
    i.message,
    d.day_number,
    i.created_at
  from public.intercessions i
  join public.profiles pr on pr.id = i.intercessor_id
  join public.prayer_plan_days d on d.id = i.plan_day_id
  where i.plan_owner_id = (select auth.uid())
    and i.created_at >= p_since
  order by i.created_at desc;
$$;

revoke execute on function public.who_prayed_for_me(date) from public;
grant execute on function public.who_prayed_for_me(date) to authenticated;

-- ---------------------------------------------------------------------------
-- An intercession now carries a free-text message from one user to another, so
-- it becomes a moderation surface and has to be reportable like any other.
-- ---------------------------------------------------------------------------

alter table public.reports drop constraint reports_target_type_check;

alter table public.reports add constraint reports_target_type_check
  check (target_type = any (array[
    'post', 'comment', 'message', 'group', 'profile', 'intercession'
  ]));
