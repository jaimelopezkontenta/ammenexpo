-- Ammen — something to actually pray when you pray for someone else.
--
-- The button says "Oré por ti" and everything above it is a name, a title and a
-- bare reference. We ask people to pray and hand them nothing. This adds a
-- second prayer per day, written for whoever is praying *for* the plan owner —
-- naming them, in the third person — alongside the owner's own first-person one.
--
-- It also closes a gap the old comment already promised. 20260730100200 says
-- "never prayer_body — the personal prayer text stays private even when the
-- link is public", but that was only ever true of the RPCs' column lists: the
-- grant is table-wide and RLS is row-level, so anyone a plan was shared with
-- could read the owner's first-person prayer with a direct select.

alter table public.prayer_plan_days
  add column intercessor_prayer text;

-- ---------------------------------------------------------------------------
-- Column-level grants: the only thing that separates columns inside a row
-- someone is allowed to read
--
-- prayer_body and daily_action come out of the table grant entirely. The owner
-- gets them back through get_my_day() below, which checks ownership itself.
-- ---------------------------------------------------------------------------

revoke select on public.prayer_plan_days from authenticated;

grant select (
  id, plan_id, day_number, title, scripture_ref, scripture_text,
  interpretation, intercessor_prayer, unlock_date, intercession_count,
  created_at
) on public.prayer_plan_days to authenticated;

-- ---------------------------------------------------------------------------
-- The owner's own day, including the parts nobody else may read
--
-- Same shape as plan_written_days: SECURITY DEFINER with an explicit ownership
-- check, so the column grant above cannot lock the owner out of their own text.
-- ---------------------------------------------------------------------------

create function public.get_my_day(p_plan_id uuid)
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
  order by d.day_number desc
  limit 1;
$$;

revoke execute on function public.get_my_day(uuid) from public;
grant execute on function public.get_my_day(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- What an intercessor gets
--
-- Adds scripture_text and intercessor_prayer. Until now the Orar tab returned
-- only the reference, so someone you had deliberately shared your plan with
-- could read *less* than a stranger holding the public link.
--
-- Still no daily_action and no prayer_body: the action belongs to the person
-- walking the plan, and the first-person prayer is theirs.
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced: the return type gains two columns, and
-- CREATE OR REPLACE cannot change a function's signature.
drop function public.plans_shared_with_me();

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
  interpretation text,
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
      d.interpretation as interpretation,
      d.intercessor_prayer as intercessor_prayer,
      exists (
        select 1 from public.intercessions i
        where i.plan_day_id = d.id
          and i.intercessor_id = (select auth.uid())
      ) as already_prayed
    from public.prayer_plans p
    join public.profiles pr on pr.id = p.owner_id
    -- Explicit columns, not dd.*: this function runs as the caller, and the
    -- caller is no longer granted prayer_body or daily_action.
    join lateral (
      select dd.id, dd.day_number, dd.title, dd.scripture_ref,
             dd.scripture_text, dd.interpretation, dd.intercessor_prayer
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

-- ---------------------------------------------------------------------------
-- The public link gets the prayer too
--
-- Someone without an account can then actually pray there, rather than only
-- read — which is the moment they decide whether to sign up.
-- ---------------------------------------------------------------------------

drop function public.get_shared_plan_preview(text);

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
  interpretation text,
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
    d.interpretation,
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

revoke execute on function public.plans_shared_with_me() from public;
grant execute on function public.plans_shared_with_me() to authenticated;

revoke execute on function public.get_shared_plan_preview(text) from public;
grant execute on function public.get_shared_plan_preview(text) to anon, authenticated;
