-- Ammen — prayer plans, their days, sharing and intercession.
--
-- This is the heart of the product: a plan is walked one day at a time, it can
-- be shared, and other people praying for a given day is what drives the
-- notification loop.

-- ---------------------------------------------------------------------------
-- prayer_plans
-- ---------------------------------------------------------------------------

create table public.prayer_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  theme text check (char_length(theme) <= 140),
  duration_days smallint not null check (duration_days between 1 and 90),
  start_date date not null default current_date,
  visibility public.plan_visibility not null default 'private',
  group_id uuid references public.groups (id) on delete set null,
  status public.plan_status not null default 'active',
  generated_by public.plan_source not null default 'ai',
  source_prompt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prayer_plans_group_required
    check (visibility <> 'group' or group_id is not null)
);

create index prayer_plans_owner_idx on public.prayer_plans (owner_id);
create index prayer_plans_group_idx on public.prayer_plans (group_id)
  where group_id is not null;

create trigger prayer_plans_set_updated_at
  before update on public.prayer_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- prayer_plan_days
--
-- `unlock_date` is what makes the app a daily habit instead of a one-session
-- read. It is enforced in the RLS policy, not in the client.
-- ---------------------------------------------------------------------------

create table public.prayer_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.prayer_plans (id) on delete cascade,
  day_number smallint not null check (day_number >= 1),
  title text not null,
  scripture_ref text,
  scripture_text text,
  prayer_body text not null,
  reflection_question text,
  unlock_date date not null,
  intercession_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, day_number)
);

create index prayer_plan_days_plan_idx on public.prayer_plan_days (plan_id);

-- ---------------------------------------------------------------------------
-- plan_shares — explicit grants to a person or a group
-- ---------------------------------------------------------------------------

create table public.plan_shares (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.prayer_plans (id) on delete cascade,
  shared_with_user_id uuid references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint plan_shares_one_target
    check (num_nonnulls(shared_with_user_id, group_id) = 1)
);

create unique index plan_shares_user_uniq
  on public.plan_shares (plan_id, shared_with_user_id)
  where shared_with_user_id is not null;

create unique index plan_shares_group_uniq
  on public.plan_shares (plan_id, group_id)
  where group_id is not null;

create index plan_shares_user_idx
  on public.plan_shares (shared_with_user_id)
  where shared_with_user_id is not null;

-- ---------------------------------------------------------------------------
-- share_links — revocable, expirable public tokens
-- ---------------------------------------------------------------------------

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default public.generate_token(),
  scope public.share_scope not null,
  plan_id uuid references public.prayer_plans (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint share_links_target_matches_scope check (
    (scope = 'plan' and plan_id is not null and group_id is null)
    or (scope = 'group' and group_id is not null and plan_id is null)
  )
);

create index share_links_plan_idx on public.share_links (plan_id)
  where plan_id is not null;

-- ---------------------------------------------------------------------------
-- Read-access helpers (SECURITY DEFINER: policies on these tables would
-- otherwise recurse through plan_shares back into prayer_plans)
-- ---------------------------------------------------------------------------

create function public.can_read_plan(pid uuid)
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
        or exists (
          select 1 from public.plan_shares s
          where s.plan_id = p.id
            and s.shared_with_user_id = (select auth.uid())
        )
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

create function public.can_read_plan_day(did uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.prayer_plan_days d
    where d.id = did
      and d.unlock_date <= current_date
      and public.can_read_plan(d.plan_id)
  );
$$;

revoke execute on function public.can_read_plan(uuid) from public;
revoke execute on function public.can_read_plan_day(uuid) from public;
grant execute on function public.can_read_plan(uuid) to authenticated;
grant execute on function public.can_read_plan_day(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- prayer_logs — "I prayed my own day", feeds the personal streak
-- ---------------------------------------------------------------------------

create table public.prayer_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_day_id uuid not null references public.prayer_plan_days (id) on delete cascade,
  note text check (char_length(note) <= 2000),
  completed_at timestamptz not null default now(),
  unique (user_id, plan_day_id)
);

create index prayer_logs_user_idx on public.prayer_logs (user_id);

create function public.bump_personal_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := current_date;
  last_day date;
  current_streak integer;
begin
  select p.streak_last_day, p.streak_count
    into last_day, current_streak
  from public.profiles p
  where p.id = new.user_id;

  if last_day = today then
    return new;
  elsif last_day = today - 1 then
    current_streak := current_streak + 1;
  else
    current_streak := 1;
  end if;

  update public.profiles
     set streak_count = current_streak,
         streak_last_day = today
   where id = new.user_id;

  return new;
end;
$$;

create trigger prayer_logs_bump_streak
  after insert on public.prayer_logs
  for each row execute function public.bump_personal_streak();

-- ---------------------------------------------------------------------------
-- intercessions — "someone prayed for YOUR day". The viral core.
-- ---------------------------------------------------------------------------

create table public.intercessions (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.prayer_plan_days (id) on delete cascade,
  plan_owner_id uuid not null references public.profiles (id) on delete cascade,
  intercessor_id uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 280),
  created_at timestamptz not null default now(),
  -- One prayer per person per day: tapping five times must not send five pushes.
  unique (plan_day_id, intercessor_id),
  constraint intercessions_not_self check (plan_owner_id <> intercessor_id)
);

create index intercessions_owner_idx
  on public.intercessions (plan_owner_id, created_at desc);

-- plan_owner_id is denormalised for the "who prayed for me" query and the push
-- trigger. Deriving it server-side keeps a client from spoofing it.
create function public.set_intercession_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.owner_id into new.plan_owner_id
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.id = new.plan_day_id;

  if new.plan_owner_id is null then
    raise exception 'unknown plan day %', new.plan_day_id;
  end if;

  return new;
end;
$$;

create trigger intercessions_set_owner
  before insert on public.intercessions
  for each row execute function public.set_intercession_owner();

create function public.sync_intercession_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.prayer_plan_days
       set intercession_count = intercession_count + 1
     where id = new.plan_day_id;
    return new;
  else
    update public.prayer_plan_days
       set intercession_count = greatest(intercession_count - 1, 0)
     where id = old.plan_day_id;
    return old;
  end if;
end;
$$;

create trigger intercessions_count
  after insert or delete on public.intercessions
  for each row execute function public.sync_intercession_count();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.prayer_plans enable row level security;

create policy "plans are readable by owner and people they are shared with"
  on public.prayer_plans for select
  to authenticated
  using (public.can_read_plan(id));

create policy "users create their own plans"
  on public.prayer_plans for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "owners update their plans"
  on public.prayer_plans for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "owners delete their plans"
  on public.prayer_plans for delete
  to authenticated
  using (owner_id = (select auth.uid()));

alter table public.prayer_plan_days enable row level security;

-- Future days are invisible to everyone, the owner included. That is the
-- daily-return mechanic, enforced where a client cannot bypass it.
create policy "unlocked days are readable by anyone who can read the plan"
  on public.prayer_plan_days for select
  to authenticated
  using (
    unlock_date <= current_date
    and public.can_read_plan(plan_id)
  );

create policy "owners write their plan days"
  on public.prayer_plan_days for insert
  to authenticated
  with check (
    exists (
      select 1 from public.prayer_plans p
      where p.id = plan_id and p.owner_id = (select auth.uid())
    )
  );

create policy "owners update their plan days"
  on public.prayer_plan_days for update
  to authenticated
  using (
    exists (
      select 1 from public.prayer_plans p
      where p.id = plan_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.prayer_plans p
      where p.id = plan_id and p.owner_id = (select auth.uid())
    )
  );

alter table public.plan_shares enable row level security;

create policy "shares visible to plan owner and recipient"
  on public.plan_shares for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or shared_with_user_id = (select auth.uid())
    or (group_id is not null and public.is_group_member(group_id))
  );

create policy "plan owners share their own plans"
  on public.plan_shares for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.prayer_plans p
      where p.id = plan_id and p.owner_id = (select auth.uid())
    )
  );

create policy "plan owners revoke shares"
  on public.plan_shares for delete
  to authenticated
  using (created_by = (select auth.uid()));

alter table public.share_links enable row level security;

-- Anonymous visitors never read this table directly; they go through
-- public.get_shared_plan_preview(), which returns a deliberately narrow view.
create policy "creators manage their share links"
  on public.share_links for all
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

alter table public.prayer_logs enable row level security;

create policy "users read their own prayer logs"
  on public.prayer_logs for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users log their own prayers"
  on public.prayer_logs for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_read_plan_day(plan_day_id)
  );

create policy "users delete their own prayer logs"
  on public.prayer_logs for delete
  to authenticated
  using (user_id = (select auth.uid()));

alter table public.intercessions enable row level security;

create policy "plan owner and intercessor see the intercession"
  on public.intercessions for select
  to authenticated
  using (
    plan_owner_id = (select auth.uid())
    or intercessor_id = (select auth.uid())
  );

create policy "users pray for days they can actually read"
  on public.intercessions for insert
  to authenticated
  with check (
    intercessor_id = (select auth.uid())
    and public.can_read_plan_day(plan_day_id)
  );

create policy "intercessors can take it back"
  on public.intercessions for delete
  to authenticated
  using (intercessor_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Public preview for a shared link
--
-- Returns the CURRENT day only, and never `prayer_body` — the personal prayer
-- text stays private even when the link is public. Callable by anon so the web
-- page renders before signup.
-- ---------------------------------------------------------------------------

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
  reflection_question text,
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
    d.reflection_question,
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
