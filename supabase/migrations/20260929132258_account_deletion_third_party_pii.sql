-- Revisión adversarial R1 (2026-09-29), S5: borrar la cuenta tiene que borrar
-- también lo que de ella quedaba en filas de otros.
--
-- 20260929074704_account_deletion_email_cleanup borraba el correo que se le
-- mandó a la persona (`user_id`), pero no:
--   - las invitaciones que ENVIÓ: direcciones de terceros que tecleó ella, su
--     nombre, el nombre de su círculo y el token; y si estaban pendientes,
--     ¡salían igual después de borrarse!;
--   - las que RECIBIÓ antes de tener cuenta (`user_id` nulo, su dirección en
--     `to_email` y en la clave);
--   - «tu invitación se usó» que recibieron otros con su nombre;
--   - su nombre en el payload de avisos de terceros («X oró por ti»), en los
--     `names` de sus resúmenes sociales y en la bienvenida de quien entró por
--     su invitación.
--
-- Qué se hace con cada cosa:
--   - Se borra (con sus eventos de Resend) todo correo dirigido a ella, a su
--     dirección, enviado por ella como invitación o que la nombraba como
--     quien canjeó una invitación. Nadie más necesita esas filas.
--   - En filas que sí son de otros —su aviso, su resumen, su bienvenida— la
--     fila se queda y solo sale el dato: el nombre pasa a un marcador neutro
--     («Alguien» / «Someone», en el idioma de quien lo lee) y el aviso pierde
--     el `intercessor_id`, así que deja de enlazar a un perfil que ya no
--     existe (la pantalla ya lo pinta como fila informativa).
--   - Los resúmenes y bienvenidas no guardan ids, solo el nombre escrito: se
--     quita donde coincide el nombre exacto. Si otra persona se llamaba igual,
--     también desaparece de ese registro; es un registro de lo ya enviado, no
--     algo que alguien lea.
--
-- Qué queda, y por qué:
--   - `email_suppressions`: impide volver a escribir a una dirección que
--     rebotó o se quejó; borrarla sería volver a molestarla.
--   - La foto en Storage: SQL no puede borrar objetos (trigger
--     `storage.protect_delete`; borrar la fila dejaría el fichero huérfano en
--     el almacenamiento). La quita el cliente con la sesión de su dueño antes
--     de llamar aquí (core/profile/queries.ts); si eso falla, queda hasta un
--     futuro job que barra `avatars/<id>/` sin perfil. Nada la enlaza ya: el
--     perfil y su `avatar_url` se van con la cuenta.
--   - El recuento de «te invitaron» por destinatario (7 días) olvida su
--     dirección: otra persona podría invitarla antes de una semana. Es el
--     precio de no guardar su dirección.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  v_email text;
  v_name text;
  v_ids uuid[];
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  select lower(btrim(u.email)) into v_email from auth.users u where u.id = caller;
  select nullif(btrim(p.display_name), '') into v_name
    from public.profiles p where p.id = caller;

  -- Todo el correo que era suyo o la nombraba por id.
  select coalesce(array_agg(o.id), '{}') into v_ids
    from public.email_outbox o
   where o.user_id = caller
      or o.invited_by = caller
      or (v_email is not null and o.to_email = v_email)
      or (o.template = 'invite_used'
          and split_part(o.idempotency_key, '/', 3) = caller::text);

  delete from public.email_events e where e.outbox_id = any (v_ids);
  delete from public.email_outbox o where o.id = any (v_ids);

  -- Su nombre escrito en el correo de otros.
  if v_name is not null then
    update public.email_outbox o
       set payload = jsonb_set(
             o.payload,
             '{names}',
             coalesce((
               select jsonb_agg(n.value)
                 from jsonb_array_elements(o.payload -> 'names') n
                where n.value <> to_jsonb(v_name)
             ), '[]'::jsonb)
           )
     where o.template = 'digest_social'
       and jsonb_typeof(o.payload -> 'names') = 'array'
       and (o.payload -> 'names') ? v_name;

    update public.email_outbox o
       set payload = o.payload - 'inviter_name' - 'circle_name' - 'plan_title'
     where o.template = 'welcome'
       and o.payload ->> 'inviter_name' = v_name;
  end if;

  -- Sus avisos en el historial de otros: la fila es de quien la recibió.
  update public.notifications n
     set payload = (n.payload - 'intercessor_id') || jsonb_build_object(
           'intercessor_name',
           case
             when coalesce(
                    (select ps.locale from public.profile_settings ps where ps.id = n.user_id),
                    'es'
                  ) like 'en%' then 'Someone'
             else 'Alguien'
           end
         )
   where n.payload ->> 'intercessor_id' = caller::text;

  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
