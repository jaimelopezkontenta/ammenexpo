-- Oleada 5 (2026-09-29): qué columnas de un círculo escribe el cliente.
--
-- `20260730100400_grants` concedía `insert, update` de tabla entera sobre
-- `groups` y `group_members`. Las policies dicen QUIÉN escribe una fila (el
-- dueño crea, un admin edita, cualquiera entra en un círculo público), pero no
-- QUÉ columnas, y el GRANT de tabla entera las abría todas:
--
--   - Un admin que no era el dueño podía ponerse `owner_id`. Con eso echaba a
--     la dueña (`protect_group_owner` se fía de esa columna) y borraba el
--     círculo (la policy de DELETE también). Podía además escribir
--     `member_count`, la racha y el `invite_token`, que solo debe cambiar
--     `rotate_circle_invite_token`.
--   - Al crear un círculo se podía nacer con 5000 miembros (el directorio de
--     públicos lo enseña), una racha de un año o un token elegido.
--   - La policy de INSERT de `group_members` deja a cualquiera unirse a un
--     círculo público, pero no miraba `role`: se entraba como admin. Y como
--     `is_group_admin` solo mira el rol, un admin podía degradar la fila de la
--     dueña a `member` o coronar a otro `owner`.
--
-- Ahora el GRANT es por columna, con exactamente lo que escribe la app
-- (`core/circles/queries.ts`): crear con dueño, nombre, descripción y
-- visibilidad; unirse con círculo y persona. Editar el nombre, la descripción
-- y la visibilidad sigue abierto a los admins —la policy existe para eso,
-- aunque la app todavía no tenga pantalla— y cambiar el rol de un miembro
-- también, salvo el de la dueña y salvo el de `owner`, que solo pone
-- `handle_new_group`. Lo demás (censo, racha, token, fechas) lo mantienen
-- triggers y RPC SECURITY DEFINER, a los que este GRANT no afecta.
--
-- `avatar_url` queda fuera: nada lo escribe y, a diferencia del de
-- `profiles`, no tiene validación; abrirlo sería un píxel de seguimiento en
-- la pantalla de todo el círculo.
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas,
-- así que volver a aplicarla deja exactamente estas listas.

revoke insert, update on public.groups from authenticated;
grant insert (owner_id, name, description, visibility) on public.groups to authenticated;
grant update (name, description, visibility) on public.groups to authenticated;

revoke insert, update on public.group_members from authenticated;
grant insert (group_id, user_id) on public.group_members to authenticated;
grant update (role) on public.group_members to authenticated;

drop policy if exists "admins change roles" on public.group_members;
create policy "admins change roles"
  on public.group_members for update
  to authenticated
  using (public.is_group_admin(group_id) and role <> 'owner')
  with check (public.is_group_admin(group_id) and role <> 'owner');
