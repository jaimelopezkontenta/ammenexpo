-- Ammen — what a day is actually made of.
--
-- A day used to be: scripture, a prayer, and a reflection question. It now has
-- four parts, in the order a person moves through them:
--
--   1. Palabra        — the verse (already verified against the real text)
--   2. Qué significa  — what it means, in plain language
--   3. Hoy haz esto   — one small, concrete action
--   4. Oración        — a prayer to read
--
-- The action replaces the reflection question. A question and an action compete
-- for the same moment, and only one of them leaves the phone.

alter table public.prayer_plan_days
  add column interpretation text,
  add column daily_action text;

alter table public.prayer_plan_days
  drop column reflection_question;

-- The preview's return type changes, so it has to be dropped rather than
-- replaced. It now shows the interpretation instead of the question: someone
-- praying for a friend benefits from knowing what the passage is about, while
-- the prayer and the action stay private to whoever the plan belongs to.
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
    and d.unlock_date <= current_date
  order by d.day_number desc
  limit 1;
$$;

revoke execute on function public.get_shared_plan_preview(text) from public;
grant execute on function public.get_shared_plan_preview(text) to anon, authenticated;
