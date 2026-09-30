-- Barrido de privilegios, ronda 2 (2026-09-30): un testimonio cuenta lo tuyo.
--
-- `20260730100400_grants` concedía `insert, update` de tabla entera sobre
-- `testimonies`, y las policies solo piden ser el autor. Con eso:
--
--   - `image_url` se escribía sin validar. Hoy no se pinta en ninguna
--     pantalla, pero el día que se pinte sería una URL cualquiera —un píxel de
--     seguimiento— en el muro de todo el que lo lea. La app no la escribe:
--     queda cerrada, y quien la abra tendrá que validarla como
--     `profiles.avatar_url` (`avatar_url_is_valid`).
--   - El testimonio se colgaba de un plan, una petición del muro o un ítem de
--     la lista de OTRA persona: `visible_testimonies_page` le pone al
--     testimonio el título de ese plan a quien pueda leerlo, y la historia
--     pasaba por respuesta a la oración de otro.
--   - Se antedataba (`created_at`) para quedar arriba o abajo del muro.
--
-- La app escribe al contar (`useWriteTestimony`, desde el plan terminado o la
-- lista): `user_id`, `body`, `visibility`, `plan_id` y `list_item_id`; al
-- editar (`useSetTestimonyVisibility`), solo `visibility`. Eso es lo que queda.
-- `post_id` no lo escribe nadie.
--
-- Lo que se referencia tiene que ser tuyo: una policy RESTRICTIVE de INSERT,
-- que se suma (AND) a la de siempre sin tocarla. Incluye `post_id` aunque hoy
-- no se conceda, para que abrirlo mañana no reabra el hueco. En UPDATE no hace
-- falta: ninguna de esas columnas se puede cambiar después.
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas, y
-- la policy se borra antes de crearse.

revoke insert, update on public.testimonies from authenticated;
grant insert (user_id, body, visibility, plan_id, list_item_id) on public.testimonies to authenticated;
grant update (visibility) on public.testimonies to authenticated;

drop policy if exists "testimonies only point at what their author owns" on public.testimonies;
create policy "testimonies only point at what their author owns"
  on public.testimonies
  as restrictive
  for insert
  to authenticated
  with check (
    (
      plan_id is null
      or exists (
        select 1
          from public.prayer_plans p
         where p.id = testimonies.plan_id
           and p.owner_id = (select auth.uid())
      )
    )
    and (
      list_item_id is null
      or exists (
        select 1
          from public.prayer_list_items li
         where li.id = testimonies.list_item_id
           and li.user_id = (select auth.uid())
      )
    )
    and (
      post_id is null
      or exists (
        select 1
          from public.posts po
         where po.id = testimonies.post_id
           and po.author_id = (select auth.uid())
      )
    )
  );
