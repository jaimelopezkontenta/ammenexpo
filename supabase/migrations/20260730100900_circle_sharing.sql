-- Ammen — sharing a plan with several circles at once.
--
-- `plan_shares` has always had a `group_id` column, but nothing ever read it:
-- access checks only looked at `prayer_plans.group_id`, which holds a single
-- circle. Sharing a plan with "Familia" and "Célula" would happily write both
-- rows and grant access to nobody — a silent failure, because the UI would show
-- the plan as shared and the recipients would simply never see it.
--
-- The membership test now lives in `has_plan_share`, which is the single
-- source of truth for "this plan was shared with me", directly or through a
-- circle I belong to.

create or replace function public.has_plan_share(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plan_shares s
    where s.plan_id = pid
      and (
        s.shared_with_user_id = (select auth.uid())
        or (
          s.group_id is not null
          and exists (
            select 1
            from public.group_members m
            where m.group_id = s.group_id
              and m.user_id = (select auth.uid())
          )
        )
      )
  );
$$;

-- Reuse the same helper here instead of repeating the join, so the two can
-- never drift apart. `prayer_plans.group_id` stays for a circle's own shared
-- plan (Fase 5); `plan_shares.group_id` is a personal plan shared outward.
create or replace function public.can_read_plan(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.prayer_plans p
    where p.id = pid
      and (
        p.owner_id = (select auth.uid())
        or public.has_plan_share(p.id)
        or (
          p.group_id is not null
          and exists (
            select 1 from public.group_members m
            where m.group_id = p.group_id
              and m.user_id = (select auth.uid())
          )
        )
        or (
          p.visibility = 'friends'
          and public.are_friends(p.owner_id, (select auth.uid()))
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Public preview of a circle invitation
--
-- Same shape as get_shared_plan_preview: someone following an invite link has
-- no account yet, so they need to see what they are being invited to before
-- signing up. Returns only the name, description and size — never the members
-- or anything they have shared.
-- ---------------------------------------------------------------------------

create function public.get_circle_invite_preview(p_token text)
returns table (
  circle_id uuid,
  name text,
  description text,
  member_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, g.description, g.member_count
  from public.groups g
  where g.invite_token = p_token;
$$;

revoke execute on function public.get_circle_invite_preview(text) from public;
grant execute on function public.get_circle_invite_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Redeeming a circle invitation after signup
--
-- A circle invite token lives in `groups.invite_token`, not in `share_links`,
-- so the original redeem_share_token() would not recognise it: someone who
-- signed up from a circle invitation would land on an empty home screen with
-- no circle, and nothing would report an error. The client keeps a single
-- "pending token" slot, so the fallback belongs here rather than in the app.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_share_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.share_links;
  plan_owner uuid;
  circle_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into link
  from public.share_links sl
  where sl.token = p_token
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now());

  if link is null then
    -- Not a share link. It may be a circle invitation.
    select g.id into circle_id
    from public.groups g
    where g.invite_token = p_token;

    if circle_id is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
    end if;

    insert into public.group_members (group_id, user_id, role)
    values (circle_id, current_user_id, 'member')
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('ok', true, 'scope', 'circle',
                              'circle_id', circle_id);
  end if;

  if link.scope = 'plan' then
    select p.owner_id into plan_owner
    from public.prayer_plans p
    where p.id = link.plan_id;

    if plan_owner is null then
      return jsonb_build_object('ok', false, 'reason', 'plan_missing');
    end if;

    if plan_owner = current_user_id then
      return jsonb_build_object('ok', true, 'scope', 'plan',
                                'plan_id', link.plan_id, 'self', true);
    end if;

    insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
    values (link.plan_id, current_user_id, plan_owner)
    on conflict do nothing;

    perform public.ensure_friendship(plan_owner, current_user_id);

    return jsonb_build_object('ok', true, 'scope', 'plan',
                              'plan_id', link.plan_id);
  else
    insert into public.group_members (group_id, user_id, role)
    values (link.group_id, current_user_id, 'member')
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('ok', true, 'scope', 'group',
                              'group_id', link.group_id);
  end if;
end;
$$;

-- Hardening: you may only share into a circle you actually belong to.
-- Group ids are uuids so guessing is impractical, but the policy should not
-- rely on that.
drop policy "plan owners share their own plans" on public.plan_shares;

create policy "plan owners share their own plans"
  on public.plan_shares for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.prayer_plans p
      where p.id = plan_id and p.owner_id = (select auth.uid())
    )
    and (group_id is null or public.is_group_member(group_id))
  );
