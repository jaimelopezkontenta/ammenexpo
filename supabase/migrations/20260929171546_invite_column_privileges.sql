-- Oleada 5 (2026-09-29): una invitación la pide quien invita; el código lo pone
-- el servidor y quién la aceptó, el canje.
--
-- `20260730100400_grants` concedía `insert` de tabla entera sobre `invites`, y
-- la policy solo pide `inviter_id = auth.uid()`. Con eso se podía:
--
--   - Fabricar una invitación ya «aceptada» (`accepted_by`, `accepted_at`) por
--     otra persona: la policy de SELECT se la enseña a esa persona como suya, y
--     cuando alguien la canjea de verdad `redeem_invite_code` ya no la trata
--     como primera aceptación, así que quien invitó no recibe el aviso.
--   - Elegir el código. Uno previsible se adivina; y el código viaja sin
--     escapar en el enlace del correo de invitación (`/i/<code>`).
--
-- La app (`useCreateInviteCode`) solo manda `inviter_id`. Todo lo demás lo
-- ponen los valores por defecto (`generate_token()`, `now()`) y las RPC
-- SECURITY DEFINER (`redeem_invite_code`, `rotate_my_invite_code`), a las que
-- este GRANT no afecta. `channel` tampoco lo escribe nadie.
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas.

revoke insert on public.invites from authenticated;
grant insert (inviter_id) on public.invites to authenticated;
