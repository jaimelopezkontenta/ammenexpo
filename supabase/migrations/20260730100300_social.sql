-- Ammen — chat, feed, testimonies, moderation, notifications and billing state.

-- ---------------------------------------------------------------------------
-- Group plan completion (feeds the group streak)
-- ---------------------------------------------------------------------------

create table public.group_prayer_days (
  group_id uuid not null references public.groups (id) on delete cascade,
  plan_day_id uuid not null references public.prayer_plan_days (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (group_id, plan_day_id, user_id)
);

alter table public.group_prayer_days enable row level security;

create policy "members see who prayed in the group"
  on public.group_prayer_days for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "members record their own group day"
  on public.group_prayer_days for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_group_member(group_id)
    and public.can_read_plan_day(plan_day_id)
  );

create policy "members remove their own group day"
  on public.group_prayer_days for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid unique references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx
  on public.messages (conversation_id, created_at desc);

create function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = cid
      and cm.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

alter table public.conversations enable row level security;

create policy "members read their conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id));

create policy "users start conversations"
  on public.conversations for insert
  to authenticated
  with check (created_by = (select auth.uid()));

alter table public.conversation_members enable row level security;

create policy "members read the participant list"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "members are added by participants or the creator"
  on public.conversation_members for insert
  to authenticated
  with check (
    public.is_conversation_member(conversation_id)
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = (select auth.uid())
    )
  );

create policy "members update their own read marker"
  on public.conversation_members for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "members leave a conversation"
  on public.conversation_members for delete
  to authenticated
  using (user_id = (select auth.uid()));

alter table public.messages enable row level security;

create policy "members read the messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "members send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

create policy "senders delete their own messages"
  on public.messages for delete
  to authenticated
  using (sender_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Feed: standalone prayer requests
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  is_anonymous boolean not null default false,
  prayer_count integer not null default 0,
  comment_count integer not null default 0,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_feed_idx on public.posts (created_at desc);
create index posts_group_idx on public.posts (group_id, created_at desc)
  where group_id is not null;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_prayers (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

create function public.can_read_post(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = pid
      and (p.group_id is null or public.is_group_member(p.group_id))
  );
$$;

revoke execute on function public.can_read_post(uuid) from public;
grant execute on function public.can_read_post(uuid) to authenticated;

create function public.sync_post_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target uuid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  if tg_table_name = 'post_prayers' then
    update public.posts
       set prayer_count = greatest(prayer_count + delta, 0)
     where id = target;
  else
    update public.posts
       set comment_count = greatest(comment_count + delta, 0)
     where id = target;
  end if;

  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

create trigger post_prayers_counter
  after insert or delete on public.post_prayers
  for each row execute function public.sync_post_counters();

create trigger comments_counter
  after insert or delete on public.comments
  for each row execute function public.sync_post_counters();

alter table public.posts enable row level security;

create policy "posts readable in the global feed or by group members"
  on public.posts for select
  to authenticated
  using (group_id is null or public.is_group_member(group_id));

create policy "users write their own posts"
  on public.posts for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (group_id is null or public.is_group_member(group_id))
  );

create policy "authors update their posts"
  on public.posts for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors delete their posts"
  on public.posts for delete
  to authenticated
  using (author_id = (select auth.uid()));

alter table public.post_prayers enable row level security;

create policy "prayers visible with the post"
  on public.post_prayers for select
  to authenticated
  using (public.can_read_post(post_id));

create policy "users pray for a readable post once"
  on public.post_prayers for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_read_post(post_id)
  );

create policy "users undo their own prayer"
  on public.post_prayers for delete
  to authenticated
  using (user_id = (select auth.uid()));

alter table public.comments enable row level security;

create policy "comments visible with the post"
  on public.comments for select
  to authenticated
  using (public.can_read_post(post_id));

create policy "users comment on readable posts"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_read_post(post_id)
  );

create policy "authors delete their comments"
  on public.comments for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Testimonies — answered prayer, the most shareable moment in the product
-- ---------------------------------------------------------------------------

create table public.testimonies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.prayer_plans (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  image_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index testimonies_public_idx on public.testimonies (created_at desc)
  where is_public;

alter table public.testimonies enable row level security;

create policy "public testimonies are readable, private ones only by author"
  on public.testimonies for select
  to authenticated
  using (is_public or user_id = (select auth.uid()));

create policy "users write their own testimony"
  on public.testimonies for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "authors update their testimony"
  on public.testimonies for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "authors delete their testimony"
  on public.testimonies for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Moderation — required before shipping public groups and a public feed
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null
    check (target_type in ('post', 'comment', 'message', 'group', 'profile')),
  target_id uuid not null,
  reason text check (char_length(reason) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create index reports_open_idx on public.reports (created_at desc)
  where status = 'open';

alter table public.reports enable row level security;

create policy "users file reports as themselves"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "users see the reports they filed"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

-- Review happens through the service role / admin tooling; there is
-- deliberately no update policy for `authenticated`.

-- ---------------------------------------------------------------------------
-- Notifications
--
-- `dedupe_key` is the anti-spam mechanism: one notification per owner per
-- intercessor per day, enforced by a unique index rather than by app code.
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

create unique index notifications_dedupe_uniq
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index notifications_pending_push_idx
  on public.notifications (created_at)
  where push_sent_at is null;

alter table public.notifications enable row level security;

create policy "users read their notifications"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users mark their notifications read"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Only the service role writes notifications; no insert policy for
-- `authenticated` means a client cannot fabricate one.

create function public.notify_on_intercession()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  intercessor_name text;
  plan_title text;
begin
  select p.display_name into intercessor_name
  from public.profiles p
  where p.id = new.intercessor_id;

  select pl.title into plan_title
  from public.prayer_plan_days d
  join public.prayer_plans pl on pl.id = d.plan_id
  where d.id = new.plan_day_id;

  insert into public.notifications (user_id, type, payload, dedupe_key)
  values (
    new.plan_owner_id,
    'intercession',
    jsonb_build_object(
      'intercession_id', new.id,
      'plan_day_id', new.plan_day_id,
      'intercessor_id', new.intercessor_id,
      'intercessor_name', intercessor_name,
      'plan_title', plan_title
    ),
    'intercession:' || new.intercessor_id::text || ':' || current_date::text
  )
  on conflict do nothing;

  return new;
end;
$$;

create trigger intercessions_notify
  after insert on public.intercessions
  for each row execute function public.notify_on_intercession();

-- ---------------------------------------------------------------------------
-- Invites — the external growth loop
-- ---------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.generate_token(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  channel text,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_inviter_idx on public.invites (inviter_id);

alter table public.invites enable row level security;

create policy "users read the invites they sent or accepted"
  on public.invites for select
  to authenticated
  using (
    inviter_id = (select auth.uid())
    or accepted_by = (select auth.uid())
  );

create policy "users create their own invites"
  on public.invites for insert
  to authenticated
  with check (inviter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Subscriptions — written only by the RevenueCat webhook (service role)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  revenuecat_customer_id text,
  entitlement text,
  status text not null default 'inactive',
  store text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "users read their own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update policy for `authenticated`: entitlement state is decided by
-- the store webhook, never by the app.

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.intercessions;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.post_prayers;
