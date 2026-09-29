-- Rescatada de la base local el 2026-09-29: se aplicó allí como
-- 20260914100000_open_crisis_queue pero nunca llegó al repo (supabase/rescue/2026-09-29/README.md).
-- Idempotente a propósito, para poder aplicarse también sobre una base que ya
-- tenga la versión original: create or replace, if exists / if not exists.
-- The staff screen must show the full open backlog. The original audit RPC
-- defaults to thirty rows and its timestamp-only cursor cannot traverse ties.
-- Keep that RPC compatible; add an open-only, oldest-first composite cursor.

create index if not exists crisis_escalations_open_order_idx
  on public.crisis_escalations (created_at, id)
  where acknowledged_at is null;

create or replace function public.open_crisis_queue(
  p_after timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  author_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  acknowledged_by uuid,
  acknowledged_by_name text,
  acknowledged_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    return;
  end if;
  if (p_after is null) <> (p_after_id is null) then
    raise exception 'both cursor fields are required' using errcode = '22023';
  end if;

  return query
  select e.id, e.target_type, e.target_id, e.author_id, pr.display_name,
         coalesce(po.body, c.body), e.created_at,
         e.acknowledged_by, null::text, e.acknowledged_at
  from public.crisis_escalations e
  join public.profiles pr on pr.id = e.author_id
  left join public.posts po on po.id = e.target_id and e.target_type = 'post'
  left join public.comments c on c.id = e.target_id and e.target_type = 'comment'
  where e.acknowledged_at is null
    and (p_after is null or (e.created_at, e.id) > (p_after, p_after_id))
  order by e.created_at asc, e.id asc
  limit greatest(least(coalesce(p_limit, 30), 50), 1);
end;
$$;

revoke execute on function public.open_crisis_queue(timestamptz, uuid, integer) from public;

grant execute on function public.open_crisis_queue(timestamptz, uuid, integer) to authenticated;

notify pgrst, 'reload schema';
