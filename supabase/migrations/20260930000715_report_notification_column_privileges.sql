-- Barrido de privilegios, ronda 2 (2026-09-30): una denuncia la pone quien
-- denuncia, y su estado el staff; un aviso lo escribe el servidor y tú solo lo
-- marcas leído.
--
-- `20260730100400_grants` concedía `insert` de tabla entera sobre `reports` y
-- `update` de tabla entera sobre `notifications`. Con eso:
--
--   - Una denuncia nacía ya `dismissed` —y no llegaba nunca a la cola, que
--     solo mira las abiertas— o con la fecha que uno quisiera, para colocarse
--     donde quisiera en esa cola (que ordena por `created_at`).
--   - Un aviso propio se reescribía entero: `type` y `payload` (lo que se
--     pinta y lo que viaja en el push), `dedupe_key` (la clave con la que el
--     servidor evita repetirlo), `push_sent_at` o `created_at`.
--
-- La app denuncia con `reporter_id`, `target_type`, `target_id` y, a veces,
-- `reason` (core/posts, core/circles/chat, core/intercessions,
-- core/testimonies, core/moderation). Los avisos los lee por RPC y los marca
-- con `mark_notifications_read`, que es SECURITY INVOKER y solo toca
-- `read_at`. Eso es lo que queda; `resolve_report` y las RPC de moderación son
-- SECURITY DEFINER y no dependen de este GRANT.
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas.

revoke insert on public.reports from authenticated;
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
