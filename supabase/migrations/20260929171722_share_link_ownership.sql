-- Oleada 5 (2026-09-29): un enlace para compartir apunta a un plan tuyo, y
-- solo a eso.
--
-- La policy de `share_links` es una sola `for all` que pide
-- `created_by = auth.uid()` y nada más: ni que el plan sea tuyo ni que seas
-- del círculo. Y `redeem_share_token` se fía del enlace. Así que quien supiera
-- un id podía acuñarse la llave:
--
--   - `scope = 'plan'` sobre un plan ajeno (uno que le compartieron y le
--     quitaron, uno de un círculo del que salió): al canjearlo, la RPC crea el
--     `plan_shares` en nombre del dueño y el plan pasa a ser legible.
--   - `scope = 'group'` sobre un círculo privado, por ejemplo aquel del que lo
--     acaban de echar: al canjearlo vuelve a entrar.
--
-- Además, con `insert, update` de tabla entera se elegía el token y la
-- caducidad, y un enlace ya creado se podía reapuntar a otro plan o círculo.
--
-- La app crea enlaces de plan desde la pantalla del dueño
-- (`useCreateShareLink`: `scope`, `plan_id`, `created_by`) y los revoca
-- (`useRevokeShareLink`: `revoked_at`). Eso es lo que queda. Los enlaces de
-- círculo no los crea la app —la puerta de un círculo es `groups.invite_token`,
-- que un admin rota con `rotate_circle_invite_token`—, y un enlace de grupo
-- acuñado por un miembro sobreviviría a que lo echen sin que nadie más pudiera
-- verlo ni revocarlo, así que desde el cliente ya no se crean. El canje de los
-- que ya existan sigue igual.
--
-- La comprobación va en una policy RESTRICTIVE de INSERT, que se suma (AND) a
-- la `for all` existente sin tocarla. `revoked_at` es la única columna que se
-- actualiza, así que un enlace no puede cambiar de destino después.
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas, y
-- la policy se borra antes de crearse.

revoke insert, update on public.share_links from authenticated;
grant insert (scope, plan_id, created_by) on public.share_links to authenticated;
grant update (revoked_at) on public.share_links to authenticated;

drop policy if exists "links only point at plans their creator owns" on public.share_links;
create policy "links only point at plans their creator owns"
  on public.share_links
  as restrictive
  for insert
  to authenticated
  with check (
    scope = 'plan'
    and exists (
      select 1
        from public.prayer_plans p
       where p.id = share_links.plan_id
         and p.owner_id = (select auth.uid())
    )
  );
