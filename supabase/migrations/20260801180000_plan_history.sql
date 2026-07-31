-- Ammen — being able to go back to yesterday.
--
-- A plan of thirty days only ever showed the latest unlocked one. Someone who
-- skipped a day, or wanted to reread the prayer that helped, had no way to.
-- The days are all there and RLS already allows reading every unlocked one;
-- what was missing was any way to ask for a day other than the last.

-- ---------------------------------------------------------------------------
-- The list
--
-- Enough to render an index and no more: no prayer text, so the list stays
-- cheap even on a thirty-day plan.
-- ---------------------------------------------------------------------------

create function public.my_plan_days(p_plan_id uuid)
returns table (
  id uuid,
  day_number smallint,
  title text,
  scripture_ref text,
  prayed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id,
    d.day_number,
    d.title,
    d.scripture_ref,
    exists (
      select 1 from public.prayer_logs l
      where l.plan_day_id = d.id and l.user_id = (select auth.uid())
    )
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.plan_id = p_plan_id
    and p.owner_id = (select auth.uid())
    -- Future days stay hidden even from the owner: unlocking one a day is the
    -- mechanic, and a history screen must not be the way around it.
    and d.unlock_date <= public.local_today(p.owner_id)
  order by d.day_number desc;
$$;

revoke execute on function public.my_plan_days(uuid) from public;
grant execute on function public.my_plan_days(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Any single unlocked day, not just the last
--
-- Replaces the one-day version: passing null keeps the old behaviour, so the
-- Hoy screen asks for exactly what it asked before.
-- ---------------------------------------------------------------------------

drop function public.get_my_day(uuid);

create function public.get_my_day(
  p_plan_id uuid,
  p_day_number smallint default null
)
returns table (
  id uuid,
  day_number smallint,
  title text,
  scripture_ref text,
  scripture_text text,
  interpretation text,
  daily_action text,
  prayer_body text,
  unlock_date date,
  intercession_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id, d.day_number, d.title, d.scripture_ref, d.scripture_text,
    d.interpretation, d.daily_action, d.prayer_body, d.unlock_date,
    d.intercession_count
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.plan_id = p_plan_id
    and p.owner_id = (select auth.uid())
    and d.unlock_date <= public.local_today(p.owner_id)
    and (p_day_number is null or d.day_number = p_day_number)
  order by d.day_number desc
  limit 1;
$$;

revoke execute on function public.get_my_day(uuid, smallint) from public;
grant execute on function public.get_my_day(uuid, smallint) to authenticated;
