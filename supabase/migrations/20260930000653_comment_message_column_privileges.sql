-- Barrido de privilegios, ronda 2 (2026-09-30): un comentario o un mensaje
-- nace con su texto; las marcas de moderación y la fecha las pone el servidor.
--
-- `20260730100400_grants` concedía `insert` de tabla entera sobre `comments` y
-- `messages`, y las policies solo miran quién escribe y dónde. Con eso:
--
--   - Un comentario nacía con `crisis_flagged_at`, y el trigger
--     `enqueue_crisis_escalation` abría una escalada de crisis falsa: la cola
--     que el staff tiene que mirar primero, llena de ruido.
--   - O con `held_at`, que llenaba la cola de retenidos
--     (`enqueue_content_hold`), o «oculto por» un admin (`hidden_by`) que
--     nunca lo ocultó.
--   - Un mensaje fechado en 2999 se quedaba el primero del chat y, como
--     `my_unread_counts` cuenta lo posterior a tu `last_read_at`, sin leer
--     para todo el círculo para siempre. Uno antedatado se colaba en la
--     historia.
--
-- Lo que queda es lo que manda la app: `post_id`, `author_id` y `body` al
-- comentar (`useWriteComment`) —más `id`, que las suites eligen y es inocuo: la
-- PK impide pisar otra fila—, y `conversation_id`, `sender_id` y `body` al
-- escribir en el chat (`useSendMessage`). Ninguna de las dos tablas tenía
-- UPDATE. Los triggers `flag_crisis` y `hold_objectionable` siguen mirando el
-- texto, y las RPC de moderación (`hide_comment`, `hide_message`,
-- `hide_reported_content`) son SECURITY DEFINER: este GRANT no les afecta.
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas.

revoke insert on public.comments from authenticated;
grant insert (id, post_id, author_id, body) on public.comments to authenticated;

revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
