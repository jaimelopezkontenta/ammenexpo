-- Ammen — redeeming a share link or invite code after signup.
--
-- This is the last step of the acquisition loop: someone opened a shared plan
-- on the web, created an account, and now has to end up actually connected to
-- the person who invited them. If this step is missing the loop looks like it
-- works and silently leaks every new user.
--
-- These run as SECURITY DEFINER because the new user legitimately cannot write
-- the rows involved: plan_shares may only be inserted by the plan owner, and a
-- friendship is being created on someone else's behalf.

-- Accepted friendship between two users, in whichever direction is free.
create function public.ensure_friendship(a uuid, b uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if a = b then
    return;
  end if;

  if public.are_friends(a, b) then
    return;
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (a, b, 'accepted')
  on conflict (requester_id, addressee_id)
  do update set status = 'accepted';
exception when unique_violation then
  -- The mirrored row already exists; promote that one instead.
  update public.friendships
     set status = 'accepted'
   where requester_id = b and addressee_id = a;
end;
$$;

revoke execute on function public.ensure_friendship(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- redeem_share_token
-- ---------------------------------------------------------------------------

create function public.redeem_share_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.share_links;
  plan_owner uuid;
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
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
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

revoke execute on function public.redeem_share_token(text) from public;
grant execute on function public.redeem_share_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- redeem_invite_code
-- ---------------------------------------------------------------------------

create function public.redeem_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into inv
  from public.invites i
  where i.code = p_code;

  if inv is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if inv.inviter_id = current_user_id then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- First acceptance wins; later ones still create the friendship so a code
  -- forwarded around a family chat keeps working.
  if inv.accepted_by is null then
    update public.invites
       set accepted_by = current_user_id,
           accepted_at = now()
     where id = inv.id;
  end if;

  perform public.ensure_friendship(inv.inviter_id, current_user_id);

  return jsonb_build_object('ok', true, 'inviter_id', inv.inviter_id);
end;
$$;

revoke execute on function public.redeem_invite_code(text) from public;
grant execute on function public.redeem_invite_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_onboarding
--
-- Saves the questionnaire and redeems whatever token the user arrived with, in
-- one round trip, so a dropped request cannot leave the two out of sync.
-- ---------------------------------------------------------------------------

create function public.complete_onboarding(
  p_display_name text,
  p_answers jsonb,
  p_timezone text default 'UTC',
  p_reminder_hour smallint default 8,
  p_locale text default 'es'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  settings public.profile_settings;
  redeemed jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_reminder_hour < 0 or p_reminder_hour > 23 then
    raise exception 'reminder_hour must be between 0 and 23';
  end if;

  update public.profiles
     set display_name = coalesce(nullif(btrim(p_display_name), ''), display_name)
   where id = current_user_id;

  update public.profile_settings
     set onboarding_answers = p_answers,
         timezone = coalesce(nullif(btrim(p_timezone), ''), timezone),
         reminder_hour = p_reminder_hour,
         locale = coalesce(nullif(btrim(p_locale), ''), locale)
   where id = current_user_id
  returning * into settings;

  if settings.pending_share_token is not null then
    redeemed := redeemed || jsonb_build_object(
      'share', public.redeem_share_token(settings.pending_share_token));
  end if;

  if settings.pending_invite_code is not null then
    redeemed := redeemed || jsonb_build_object(
      'invite', public.redeem_invite_code(settings.pending_invite_code));
  end if;

  update public.profile_settings
     set pending_share_token = null,
         pending_invite_code = null
   where id = current_user_id;

  return jsonb_build_object('ok', true, 'redeemed', redeemed);
end;
$$;

revoke execute on function public.complete_onboarding(text, jsonb, text, smallint, text) from public;
grant execute on function public.complete_onboarding(text, jsonb, text, smallint, text) to authenticated;
