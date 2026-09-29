-- Oleada 1a de la auditoría (2026-09-29): un índice por cada clave foránea.
--
-- 36 claves foráneas no tenían ningún índice que empezara por su columna.
-- Cada `on delete cascade / set null` y cada lectura «lo de esta persona»
-- (`posts(author_id)`, `messages(sender_id)`, `intercessions(intercessor_id)`…)
-- recorría la tabla entera, y `delete_my_account` las toca casi todas a la vez.
--
-- Las columnas que admiten nulo llevan índice parcial `where … is not null`:
-- sirve igual para `col = $1` (que ya excluye nulos) y no indexa vacíos, que
-- en quién ocultó, quién reclamó o a qué plan responde un testimonio son casi
-- todas las filas. `supabase/tests/rls.sql` comprueba que no vuelva a quedar
-- ninguna clave foránea sin índice.

create index if not exists bible_book_aliases_book_id_fk_idx on public.bible_book_aliases (book_id);
create index if not exists bible_highlights_book_id_fk_idx on public.bible_highlights (book_id);
create index if not exists bible_notes_book_id_fk_idx on public.bible_notes (book_id);
create index if not exists comments_author_id_fk_idx on public.comments (author_id);
create index if not exists comments_hidden_by_fk_idx on public.comments (hidden_by) where hidden_by is not null;
create index if not exists content_holds_author_id_fk_idx on public.content_holds (author_id);
create index if not exists content_holds_claimed_by_fk_idx on public.content_holds (claimed_by) where claimed_by is not null;
create index if not exists content_holds_resolved_by_fk_idx on public.content_holds (resolved_by) where resolved_by is not null;
create index if not exists conversations_created_by_fk_idx on public.conversations (created_by);
create index if not exists crisis_escalations_acknowledged_by_fk_idx on public.crisis_escalations (acknowledged_by) where acknowledged_by is not null;
create index if not exists crisis_escalations_author_id_fk_idx on public.crisis_escalations (author_id);
create index if not exists email_events_outbox_id_fk_idx on public.email_events (outbox_id) where outbox_id is not null;
create index if not exists generation_ledger_group_id_fk_idx on public.generation_ledger (group_id) where group_id is not null;
create index if not exists group_prayer_days_plan_day_id_fk_idx on public.group_prayer_days (plan_day_id);
create index if not exists group_prayer_days_user_id_fk_idx on public.group_prayer_days (user_id);
create index if not exists intercessions_intercessor_id_fk_idx on public.intercessions (intercessor_id);
create index if not exists invites_accepted_by_fk_idx on public.invites (accepted_by) where accepted_by is not null;
create index if not exists messages_hidden_by_fk_idx on public.messages (hidden_by) where hidden_by is not null;
create index if not exists messages_sender_id_fk_idx on public.messages (sender_id);
create index if not exists plan_generation_leases_claimed_by_fk_idx on public.plan_generation_leases (claimed_by);
create index if not exists plan_shares_created_by_fk_idx on public.plan_shares (created_by);
create index if not exists plan_shares_group_id_fk_idx on public.plan_shares (group_id) where group_id is not null;
create index if not exists post_prayers_user_id_fk_idx on public.post_prayers (user_id);
create index if not exists posts_author_id_fk_idx on public.posts (author_id);
create index if not exists posts_hidden_by_fk_idx on public.posts (hidden_by) where hidden_by is not null;
create index if not exists prayer_logs_plan_day_id_fk_idx on public.prayer_logs (plan_day_id);
create index if not exists profile_settings_active_plan_id_fk_idx on public.profile_settings (active_plan_id) where active_plan_id is not null;
create index if not exists profile_settings_last_read_book_id_fk_idx on public.profile_settings (last_read_book_id) where last_read_book_id is not null;
create index if not exists push_outbox_device_id_fk_idx on public.push_outbox (device_id);
create index if not exists reports_reporter_id_fk_idx on public.reports (reporter_id);
create index if not exists share_links_created_by_fk_idx on public.share_links (created_by);
create index if not exists share_links_group_id_fk_idx on public.share_links (group_id) where group_id is not null;
create index if not exists testimonies_list_item_id_fk_idx on public.testimonies (list_item_id) where list_item_id is not null;
create index if not exists testimonies_plan_id_fk_idx on public.testimonies (plan_id) where plan_id is not null;
create index if not exists testimonies_post_id_fk_idx on public.testimonies (post_id) where post_id is not null;
create index if not exists testimonies_user_id_fk_idx on public.testimonies (user_id);
