-- Rescatada de la base local el 2026-09-29: se aplicó allí como
-- 20260913100000_reported_content_moderation pero nunca llegó al repo (supabase/rescue/2026-09-29/README.md).
-- Idempotente a propósito, para poder aplicarse también sobre una base que ya
-- tenga la versión original: create or replace, if exists / if not exists.
-- Staff review reported content across circles; circle-admin RPCs remain scoped
-- to their own circles. This endpoint accepts a report ID, not an arbitrary
-- content ID, and records the actual staff actor on the hidden content.

create or replace function public.hide_reported_content(p_report_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_target uuid;
begin
  if not public.is_staff() then
    return false;
  end if;

  select r.target_type, r.target_id into v_type, v_target
    from public.reports r
   where r.id = p_report_id and r.status = 'open';
  if not found then
    return false;
  end if;

  case v_type
    when 'post' then
      update public.posts
         set hidden_at = coalesce(hidden_at, now()),
             hidden_by = case when hidden_at is null then (select auth.uid()) else hidden_by end
       where id = v_target;
    when 'comment' then
      update public.comments
         set hidden_at = coalesce(hidden_at, now()),
             hidden_by = case when hidden_at is null then (select auth.uid()) else hidden_by end
       where id = v_target;
    when 'message' then
      update public.messages
         set hidden_at = coalesce(hidden_at, now()),
             hidden_by = case when hidden_at is null then (select auth.uid()) else hidden_by end
       where id = v_target;
    else
      return false;
  end case;

  return found;
end;
$$;

revoke execute on function public.hide_reported_content(uuid) from public;

grant execute on function public.hide_reported_content(uuid) to authenticated;

notify pgrst, 'reload schema';
