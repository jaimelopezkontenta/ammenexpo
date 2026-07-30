-- Ammen — prayer groups.
--
-- Groups are private and invite-only by default; the creator may flip a group
-- to public so anyone can find and join it. Public groups are the reason the
-- moderation tables exist.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  avatar_url text,
  visibility public.group_visibility not null default 'private',
  invite_token text not null unique default public.generate_token(),
  member_count integer not null default 0,
  streak_count integer not null default 0,
  streak_last_day date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index groups_owner_idx on public.groups (owner_id);
create index groups_public_idx on public.groups (visibility) where visibility = 'public';

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members m
    where m.group_id = gid
      and m.user_id = (select auth.uid())
  );
$$;

create function public.is_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members m
    where m.group_id = gid
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

revoke execute on function public.is_group_member(uuid) from public;
revoke execute on function public.is_group_admin(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Membership bookkeeping
-- ---------------------------------------------------------------------------

create function public.sync_group_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.groups
       set member_count = member_count + 1
     where id = new.group_id;
    return new;
  else
    update public.groups
       set member_count = greatest(member_count - 1, 0)
     where id = old.group_id;
    return old;
  end if;
end;
$$;

create trigger group_members_count
  after insert or delete on public.group_members
  for each row execute function public.sync_group_member_count();

-- The creator is always the first member, with the owner role.
create function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.groups enable row level security;

create policy "members read their groups, anyone reads public groups"
  on public.groups for select
  to authenticated
  using (
    visibility = 'public'
    or public.is_group_member(id)
  );

create policy "users create groups they own"
  on public.groups for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "admins update the group"
  on public.groups for update
  to authenticated
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy "owner deletes the group"
  on public.groups for delete
  to authenticated
  using (owner_id = (select auth.uid()));

alter table public.group_members enable row level security;

create policy "members see the roster"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

-- Joining a private group goes through public.join_group_with_token(); direct
-- self-insert is only allowed for groups that are already public.
create policy "users join public groups, admins add members"
  on public.group_members for insert
  to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.groups g
        where g.id = group_id and g.visibility = 'public'
      )
    )
    or public.is_group_admin(group_id)
  );

create policy "admins change roles"
  on public.group_members for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "members leave, admins remove"
  on public.group_members for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_group_admin(group_id)
  );

-- ---------------------------------------------------------------------------
-- Joining a private group by invite token
-- ---------------------------------------------------------------------------

create function public.join_group_with_token(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select g.id into target_group
  from public.groups g
  where g.invite_token = token;

  if target_group is null then
    raise exception 'invalid invite token';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group, current_user_id, 'member')
  on conflict (group_id, user_id) do nothing;

  return target_group;
end;
$$;

revoke execute on function public.join_group_with_token(text) from public;
grant execute on function public.join_group_with_token(text) to authenticated;
