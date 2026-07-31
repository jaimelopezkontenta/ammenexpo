-- Ammen — links that stop, and people who can be reported.

-- ---------------------------------------------------------------------------
-- Share links expire by default
--
-- `expires_at` was nullable with no default, so every link ever created lived
-- forever. A plan link carries someone's name and what they are praying about,
-- in a URL that gets forwarded through WhatsApp — it should not outlive the
-- reason it was shared by years.
--
-- Anyone who actually redeemed the link keeps access: redeem_share_token writes
-- a plan_shares row, which this does not touch. Only the raw URL goes quiet.
-- ---------------------------------------------------------------------------

create function public.set_share_link_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_end date;
begin
  if new.expires_at is not null then
    return new;
  end if;

  if new.scope = 'plan' then
    select p.start_date + p.duration_days
      into plan_end
    from public.prayer_plans p
    where p.id = new.plan_id;

    -- A month past the last day: long enough for someone to come back to a
    -- finished plan, short enough that it does not linger indefinitely.
    new.expires_at := coalesce(plan_end, current_date + 30) + interval '30 days';
  else
    -- A circle invite is not a personal request and gets a longer life, but
    -- still not an unlimited one.
    new.expires_at := now() + interval '90 days';
  end if;

  return new;
end;
$$;

create trigger share_links_set_expiry
  before insert on public.share_links
  for each row execute function public.set_share_link_expiry();

-- ---------------------------------------------------------------------------
-- A person can be reported, not just a message
--
-- An intercession without a message was entirely unreportable: the only report
-- affordance hung off the message text. Someone praying on your plan with a
-- name or profile you need to flag had no route at all.
-- ---------------------------------------------------------------------------

alter table public.reports drop constraint reports_target_type_check;

alter table public.reports add constraint reports_target_type_check
  check (target_type = any (array[
    'post', 'comment', 'message', 'group', 'profile', 'intercession', 'user'
  ]));
