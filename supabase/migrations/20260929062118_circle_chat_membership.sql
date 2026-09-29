-- Rescatada de la base local el 2026-09-29: se aplicó allí como
-- 20260909100000_circle_chat_membership pero nunca llegó al repo (supabase/rescue/2026-09-29/README.md).
-- Idempotente a propósito, para poder aplicarse también sobre una base que ya
-- tenga la versión original: create or replace, if exists / if not exists.
-- Circle read markers are not membership. After leaving/removal, an old
-- conversation_members row must not allow reading or sending circle messages.
-- Explicit membership remains valid for conversations without a circle.
create or replace function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = cid
      and (
        (c.group_id is not null and exists (
          select 1 from public.group_members gm
          where gm.group_id = c.group_id
            and gm.user_id = (select auth.uid())
        ))
        or (c.group_id is null and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = (select auth.uid())
        ))
      )
  );
$$;

revoke execute on function public.is_conversation_member(uuid) from public;

grant execute on function public.is_conversation_member(uuid) to authenticated;
