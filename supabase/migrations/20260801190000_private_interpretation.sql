-- Ammen — the interpretation goes back to being for one person.
--
-- Walking the product fresh caught the inconsistency: the intercessor prayer is
-- deliberately discreet — "lejos de alguien a quien ama" rather than "su padre
-- en el hospital" — while the interpretation sitting right above it, equally
-- public, said "tu padre" in plain words.
--
-- Removing it rather than making it vaguer, because there is something else
-- wrong with showing it at all: it is written in the second person *to the plan
-- owner* ("si hoy sientes el pecho apretado por la distancia"). A third party
-- reads it as someone else's mail. What they need is the verse and a prayer
-- written for them, and they now have both.

-- Dropped rather than replaced: the return type loses a column, and
-- `create or replace` cannot change a function's signature.
drop function if exists public.plans_shared_with_me();

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
  scripture_text text,
  intercessor_prayer text,
  already_prayed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
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
      d.scripture_text as scripture_text,
      d.intercessor_prayer as intercessor_prayer,
      exists (
        select 1 from public.intercessions i
        where i.plan_day_id = d.id
          and i.intercessor_id = (select auth.uid())
      ) as already_prayed
    from public.prayer_plans p
    join public.profiles pr on pr.id = p.owner_id
    join lateral (
      select dd.id, dd.day_number, dd.title, dd.scripture_ref,
             dd.scripture_text, dd.intercessor_prayer
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

drop function if exists public.get_shared_plan_preview(text);

create function public.get_shared_plan_preview(p_token text)
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
  intercessor_prayer text,
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
    d.intercessor_prayer,
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
    and d.unlock_date <= public.local_today(p.owner_id)
  order by d.day_number desc
  limit 1;
$$;

grant execute on function public.plans_shared_with_me() to authenticated;
grant execute on function public.get_shared_plan_preview(text)
  to anon, authenticated;

-- The column grant follows: with nothing reading it for a third party, leaving
-- it selectable would be an open door with no door frame.
revoke select on public.prayer_plan_days from authenticated;

grant select (
  id, plan_id, day_number, title, scripture_ref, scripture_text,
  intercessor_prayer, unlock_date, intercession_count, created_at
) on public.prayer_plan_days to authenticated;
