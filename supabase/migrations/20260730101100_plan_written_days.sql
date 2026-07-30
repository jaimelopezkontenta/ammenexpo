-- Ammen — how many days of a plan have actually been written.
--
-- `prayer_plan_days` is filtered by `unlock_date <= current_date`, so the day
-- after a plan is created its owner can only see day 1 even though seven exist.
-- That is right for reading and wrong for bookkeeping: the chunked generator
-- counted the visible days, concluded it had written one, and would have tried
-- to write days 2-7 a second time — colliding with the (plan_id, day_number)
-- unique constraint and stalling the plan halfway.
--
-- This function answers "what has been written so far" for the owner only,
-- ignoring the unlock date. It returns the titles and references too, because
-- the generator needs them to continue the arc without repeating passages.

create function public.plan_written_days(p_plan_id uuid)
returns table (
  day_number smallint,
  title text,
  scripture_ref text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.day_number, d.title, d.scripture_ref
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.plan_id = p_plan_id
    and p.owner_id = (select auth.uid())
  order by d.day_number;
$$;

revoke execute on function public.plan_written_days(uuid) from public;
grant execute on function public.plan_written_days(uuid) to authenticated;
