-- Ammen — core identity, friendships and shared access helpers.
--
-- Design note: RLS is row-level, not column-level. A social app needs every
-- signed-in user to read other people's display name and avatar, but nobody
-- should read someone else's onboarding answers or push token. So the profile
-- is split in two tables: `profiles` (public-ish) and `profile_settings`
-- (owner only).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.plan_visibility as enum ('private', 'friends', 'group', 'link');
create type public.plan_status as enum ('active', 'completed', 'archived');
create type public.plan_source as enum ('ai', 'manual');
create type public.group_visibility as enum ('private', 'public');
create type public.group_role as enum ('owner', 'admin', 'member');
create type public.share_scope as enum ('plan', 'group');
create type public.report_status as enum ('open', 'reviewed', 'dismissed');

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- URL-safe random token used for share links, group invites and invite codes.
create function public.generate_token()
returns text
language sql
volatile
as $$
  select encode(extensions.gen_random_bytes(16), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- profiles — readable by any signed-in user (display name, avatar, streak)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  streak_count integer not null default 0,
  streak_last_day date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles are readable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- profile_settings — strictly private to the owner
-- ---------------------------------------------------------------------------

create table public.profile_settings (
  id uuid primary key references public.profiles (id) on delete cascade,
  locale text not null default 'es',
  timezone text not null default 'UTC',
  reminder_hour smallint not null default 8
    check (reminder_hour between 0 and 23),
  onboarding_answers jsonb,
  expo_push_token text,
  -- Set when the user arrives through a share link or invite, so the
  -- onboarding flow can wire up the relationship once the account exists.
  pending_share_token text,
  pending_invite_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profile_settings_set_updated_at
  before update on public.profile_settings
  for each row execute function public.set_updated_at();

alter table public.profile_settings enable row level security;

create policy "users read their own settings"
  on public.profile_settings for select
  to authenticated
  using (id = (select auth.uid()));

create policy "users update their own settings"
  on public.profile_settings for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- New auth user -> profile rows
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  );

  insert into public.profile_settings (id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

create index friendships_addressee_idx on public.friendships (addressee_id);

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

alter table public.friendships enable row level security;

create policy "users see their own friendships"
  on public.friendships for select
  to authenticated
  using (
    requester_id = (select auth.uid())
    or addressee_id = (select auth.uid())
  );

create policy "users send their own friend requests"
  on public.friendships for insert
  to authenticated
  with check (requester_id = (select auth.uid()));

create policy "either side updates the friendship"
  on public.friendships for update
  to authenticated
  using (
    requester_id = (select auth.uid())
    or addressee_id = (select auth.uid())
  )
  with check (
    requester_id = (select auth.uid())
    or addressee_id = (select auth.uid())
  );

create policy "either side removes the friendship"
  on public.friendships for delete
  to authenticated
  using (
    requester_id = (select auth.uid())
    or addressee_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Access helpers
--
-- These are SECURITY DEFINER on purpose. Policies that query the same table
-- they protect (group_members reading group_members) recurse infinitely under
-- RLS; routing the lookup through a definer function breaks the cycle.
-- ---------------------------------------------------------------------------

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
