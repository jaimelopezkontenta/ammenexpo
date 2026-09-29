-- Calendar completion is shared with circle members without exposing the
-- creator's private prayer text or personal progress. Like plan_progress,
-- completion requires every planned day and a last unlock before today.
-- Keep the current plan and final reading available until its creator uses
-- the existing archive flow; creation permissions and quota are unchanged.
begin;

-- PostgreSQL requires recreation to append a table-return field. No CASCADE:
-- an unexpected dependency must stop this migration rather than be removed.
drop function public.circle_plan(uuid);

create function public.circle_plan(p_group_id uuid)
returns table (
  plan_id uuid,
  title text,
  theme text,
  duration_days smallint,
  status text,
  day_id uuid,
  day_number smallint,
  day_title text,
  prayed_today boolean,
  prayed_count integer,
  finished boolean
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
    p.duration_days,
    p.status::text,
    d.id,
    d.day_number,
    d.title,
    exists (
      select 1 from public.group_prayer_days g
      where g.plan_day_id = d.id and g.user_id = (select auth.uid())
    ),
    (
      select count(*)::integer from public.group_prayer_days g
      where g.plan_day_id = d.id
    ),
    (
      select count(*) >= p.duration_days
        and max(written.unlock_date) < public.plan_today(p.id)
      from public.prayer_plan_days written
      where written.plan_id = p.id
    )
  from public.prayer_plans p
  left join lateral (
    select dd.id, dd.day_number, dd.title
    from public.prayer_plan_days dd
    where dd.plan_id = p.id
      and dd.unlock_date <= public.plan_today(p.id)
    order by dd.day_number desc
    limit 1
  ) d on true
  where p.group_id = p_group_id
    and p.status in ('generating', 'active')
    and public.is_group_member(p_group_id);
$$;

revoke execute on function public.circle_plan(uuid) from public;

grant execute on function public.circle_plan(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

