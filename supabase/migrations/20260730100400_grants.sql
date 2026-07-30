-- Ammen — table privileges.
--
-- Two independent layers guard every table:
--   1. GRANT decides whether a role may touch the table at all.
--   2. RLS decides which rows it may touch.
--
-- Granting `all` to `authenticated` everywhere (the common shortcut) leans
-- entirely on layer 2. We grant per verb instead, so a missing or mistaken
-- policy cannot by itself expose a write path. `anon` gets no table access at
-- all — anonymous visitors only ever reach data through
-- public.get_shared_plan_preview().

grant usage on schema public to anon, authenticated, service_role;

-- Identity ------------------------------------------------------------------
grant select, update                 on public.profiles              to authenticated;
grant select, update                 on public.profile_settings      to authenticated;
grant select, insert, update, delete on public.friendships           to authenticated;

-- Groups --------------------------------------------------------------------
grant select, insert, update, delete on public.groups                to authenticated;
grant select, insert, update, delete on public.group_members         to authenticated;
grant select, insert, delete         on public.group_prayer_days     to authenticated;

-- Plans ---------------------------------------------------------------------
grant select, insert, update, delete on public.prayer_plans          to authenticated;
grant select, insert, update         on public.prayer_plan_days      to authenticated;
grant select, insert, delete         on public.plan_shares           to authenticated;
grant select, insert, update, delete on public.share_links           to authenticated;
grant select, insert, delete         on public.prayer_logs           to authenticated;
grant select, insert, delete         on public.intercessions         to authenticated;

-- Chat ----------------------------------------------------------------------
grant select, insert                 on public.conversations         to authenticated;
grant select, insert, update, delete on public.conversation_members  to authenticated;
grant select, insert, delete         on public.messages              to authenticated;

-- Feed and testimonies ------------------------------------------------------
grant select, insert, update, delete on public.posts                 to authenticated;
grant select, insert, delete         on public.post_prayers          to authenticated;
grant select, insert, delete         on public.comments              to authenticated;
grant select, insert, update, delete on public.testimonies           to authenticated;

-- Moderation: file and track your own reports; review is service-role only.
grant select, insert                 on public.reports               to authenticated;

-- Notifications: read and mark as read. Creation is trigger/service-role only.
grant select, update                 on public.notifications         to authenticated;

grant select, insert                 on public.invites               to authenticated;

-- Entitlement state is decided by the store webhook; the app only reads it.
grant select                         on public.subscriptions         to authenticated;
