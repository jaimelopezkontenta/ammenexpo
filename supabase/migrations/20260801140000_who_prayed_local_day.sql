-- Ammen — the one place the timezone fix missed.
--
-- 20260731120000 moved the unlock gate, the streak and the public preview onto
-- each person's own calendar, but who_prayed_for_me kept
-- `p_since date default current_date` — the server's UTC date.
--
-- For someone at UTC-6 that means the "who prayed for you" list on the home
-- screen empties at six in the evening, local time, while people who prayed for
-- them that day are still there. It is the half of the loop that brings people
-- back, so it going quiet for a whole evening is not a small thing.
--
-- Note the comparison is done by converting created_at into the viewer's
-- calendar, not by comparing a timestamptz against a date. The latter is the
-- trap: Postgres would read the date as midnight in the *session* timezone —
-- UTC — which for a viewer at UTC-6 starts their day six hours early.

create or replace function public.who_prayed_for_me(p_since date default null)
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
  with viewer as (
    select public.valid_timezone(ps.timezone) as tz
    from public.profile_settings ps
    where ps.id = (select auth.uid())
  )
  select
    i.id,
    i.intercessor_id,
    pr.display_name,
    pr.avatar_url,
    i.message,
    d.day_number,
    i.created_at
  from public.intercessions i
  cross join viewer v
  join public.profiles pr on pr.id = i.intercessor_id
  join public.prayer_plan_days d on d.id = i.plan_day_id
  where i.plan_owner_id = (select auth.uid())
    and (i.created_at at time zone v.tz)::date
        >= coalesce(p_since, (now() at time zone v.tz)::date)
  order by i.created_at desc;
$$;
