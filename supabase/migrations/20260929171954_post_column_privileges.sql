-- Oleada 5 (2026-09-29): de un post, el autor escribe el texto; contadores y
-- moderación los pone el servidor.
--
-- `20260730100400_grants` concedía `insert, update` de tabla entera sobre
-- `posts`, y la policy de UPDATE solo pide ser el autor. Con eso el autor
-- podía:
--
--   - Quitarle a su post el `hidden_at` / `hidden_by` que le puso moderación
--     (`hide_reported_content`, `hide_post`): volvía a verse en el muro. Los
--     triggers de retención y crisis solo vuelven a marcar si el TEXTO sigue
--     siendo malo; una ocultación por denuncia no la repone nadie.
--   - Publicar con `prayer_count` / `comment_count` inflados, o inflarlos
--     después; los mantiene `sync_post_counters`.
--   - Mover el post a un círculo del que no es (la policy de INSERT exige ser
--     miembro, la de UPDATE no mira `group_id`).
--
-- Lo que queda es lo que escribe la app (`core/posts/queries.ts`): al
-- publicar, `author_id`, `group_id`, `body` e `is_anonymous` (y `id`, que las
-- suites eligen y es inocuo: la PK impide pisar otra fila); al editar, `body`
-- (los triggers `hold_objectionable` y `flag_crisis` lo vuelven a mirar) y
-- `answered_at` (`useMarkAnswered`). Las RPC de moderación y los contadores
-- son SECURITY DEFINER: este GRANT no les afecta.
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas.

revoke insert, update on public.posts from authenticated;
grant insert (id, author_id, group_id, body, is_anonymous) on public.posts to authenticated;
grant update (body, answered_at) on public.posts to authenticated;
