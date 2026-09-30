-- Barrido de privilegios, ronda 2 (2026-09-30): el chat por dentro lo escribe
-- el servidor.
--
-- `20260730100400_grants` concedía `insert` sobre `conversations` e
-- `insert, update, delete` sobre `conversation_members`, de cuando el chat iba
-- a tener mensajes directos. La app no escribe ninguna de las dos: la
-- conversación de un círculo la crea `handle_new_group_conversation` al crear
-- el círculo, quién es de ella lo decide `group_members`
-- (`is_conversation_member`), y la marca de leído la pone
-- `mark_conversation_read`, SECURITY DEFINER. Con los permisos abiertos:
--
--   - Cualquiera del círculo insertaba la fila de OTRA persona en
--     `conversation_members` («members are added by participants»), con el
--     `last_read_at` que quisiera: en 2999, `my_unread_counts` no le volvía a
--     marcar nada sin leer.
--   - Cualquiera creaba conversaciones sin círculo a su nombre: filas
--     huérfanas, que además se borran en cascada con su creador.
--
-- Se quitan los permisos y también las policies que solo existían para ellos:
-- sin policy, un GRANT que alguien vuelva a poner por descuido sigue sin dejar
-- escribir nada (RLS niega por defecto), y la regla que había —«añade quien ya
-- está dentro»— no es la que se quiere si algún día vuelven los directos. La
-- lectura (SELECT) no cambia.
--
-- Idempotente: los REVOKE no fallan si no hay nada que quitar, y las policies
-- se borran con `if exists`.

revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.conversation_members from authenticated;

drop policy if exists "users start conversations" on public.conversations;
drop policy if exists "members are added by participants or the creator" on public.conversation_members;
drop policy if exists "members update their own read marker" on public.conversation_members;
drop policy if exists "members leave a conversation" on public.conversation_members;
