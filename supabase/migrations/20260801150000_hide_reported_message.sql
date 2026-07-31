-- Ammen — make reporting a message actually do something.
--
-- Reporting filed a row in `reports` and marked "Reportado" in component state.
-- Nothing else happened: the message stayed on screen and came back on the next
-- refetch. A moderation control that lies about having worked is worse than no
-- control, because the person stops looking for another way out.
--
-- Reviewing reports still happens out of band. What this adds is the part the
-- reporter can see: the message goes away for them, and stays away.

alter table public.intercessions
  add column message_hidden_at timestamptz;

-- The plan owner is the person the message was sent to, so they are the one who
-- gets to stop seeing it. The intercessor cannot un-hide it.
create policy "plan owners hide a message sent to them"
  on public.intercessions for update to authenticated
  using (plan_owner_id = (select auth.uid()))
  with check (plan_owner_id = (select auth.uid()));

-- RLS cannot restrict *which* columns a policy allows, but a column-level grant
-- can — so this is the only field an owner is able to write.
grant update (message_hidden_at) on public.intercessions to authenticated;

-- ---------------------------------------------------------------------------
-- A hidden message is simply not returned
--
-- Filtering server-side rather than in the client means it cannot come back on
-- a refetch, and no cache anywhere is holding the text.
-- ---------------------------------------------------------------------------

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
    -- The prayer still counts; only the words go away.
    case when i.message_hidden_at is null then i.message end,
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
