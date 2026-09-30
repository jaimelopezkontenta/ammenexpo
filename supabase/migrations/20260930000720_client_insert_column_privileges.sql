-- Barrido de privilegios, ronda 2 (2026-09-30): lo que queda de GRANT de tabla
-- entera pasa a ser por columna, con exactamente lo que manda la app.
--
-- Con esto ninguna tabla de `public` concede INSERT ni UPDATE de tabla entera
-- a `authenticated`, y `rls.sql` falla si vuelve a aparecer uno sin estar en
-- su lista de permitidos. Lo que cierra cada línea:
--
--   - `group_prayer_days`: la policy de INSERT pedía ser del círculo y poder
--     leer el día, pero no que el día fuera del plan del círculo. Un miembro
--     insertaba a mano los diez días de un plan público ajeno y
--     `bump_group_streak` le subía la racha al círculo diez días de golpe. La
--     app marca por `mark_circle_day` (SECURITY DEFINER), que sí lo comprueba:
--     el INSERT directo se quita entero, y con él la policy que lo dejaba
--     pasar, para que un GRANT puesto por descuido no la resucite.
--   - `intercessions`: con `created_at` en 2999, «Quién oró por ti hoy»
--     (`who_prayed_for_me`) enseñaba esa oración arriba del todo todos los
--     días. `message_hidden_at` lo decide quien la recibe (su UPDATE ya era
--     por columna). `plan_owner_id` se sigue aceptando porque las suites lo
--     mandan, pero no decide nada: `set_intercession_owner` lo reescribe.
--   - `prayer_logs`: `completed_at` y `note` los pone el servidor o nadie.
--   - `post_prayers`, `follows`, `blocks`, `plan_shares`, `bible_highlights`:
--     solo `created_at`, que ordena listas de otros (quién te sigue, quién
--     oró por tu petición) o las tuyas.
--   - `bible_notes`: el upsert de `useSaveNote` reescribe las mismas columnas
--     que inserta; `created_at` y `updated_at` (este lo pone un trigger) no.
--   - `prayer_list_items`: se añade con texto y etiqueta y se marca respondida
--     (`answered_at`); la app no edita el texto.
--   - `email_preferences`: la app elige cadencia, `social` y `nudge`.
--     `sunset_at` y `previous_cadence` los escribe el job de reenganche
--     (`enqueue_winback_emails`) para apagar la cadencia a quien no vuelve, y
--     la fila la crean `handle_new_user` y `complete_onboarding`: el INSERT
--     directo se quita.
--
-- Todo lo demás lo escriben triggers y RPC SECURITY DEFINER, a los que este
-- GRANT no afecta.
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas, y
-- la policy se borra con `if exists`.

revoke insert on public.group_prayer_days from authenticated;
drop policy if exists "members record their own group day" on public.group_prayer_days;

revoke insert on public.intercessions from authenticated;
grant insert (plan_day_id, plan_owner_id, intercessor_id, message) on public.intercessions to authenticated;

revoke insert on public.prayer_logs from authenticated;
grant insert (plan_day_id, user_id) on public.prayer_logs to authenticated;

revoke insert on public.post_prayers from authenticated;
grant insert (post_id, user_id) on public.post_prayers to authenticated;

revoke insert on public.follows from authenticated;
grant insert (follower_id, followee_id) on public.follows to authenticated;

revoke insert on public.blocks from authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;

revoke insert on public.plan_shares from authenticated;
grant insert (plan_id, shared_with_user_id, group_id, created_by) on public.plan_shares to authenticated;

revoke insert on public.bible_highlights from authenticated;
grant insert (user_id, book_id, chapter, verse) on public.bible_highlights to authenticated;

revoke insert, update on public.bible_notes from authenticated;
grant insert (user_id, book_id, chapter, verse, body) on public.bible_notes to authenticated;
grant update (user_id, book_id, chapter, verse, body) on public.bible_notes to authenticated;

revoke insert, update on public.prayer_list_items from authenticated;
grant insert (user_id, body, tag) on public.prayer_list_items to authenticated;
grant update (answered_at) on public.prayer_list_items to authenticated;

revoke insert, update on public.email_preferences from authenticated;
grant update (cadence, social, nudge) on public.email_preferences to authenticated;
