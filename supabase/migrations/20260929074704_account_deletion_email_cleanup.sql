-- Oleada 1b de la auditoría (2026-09-29): borrar la cuenta borra su correo.
--
-- `delete_my_account` borraba `auth.users` y dejaba que las claves foráneas
-- hicieran el resto. En el correo no lo hacían: `email_outbox.user_id` es
-- `on delete set null`, así que cada correo que se le mandó seguía ahí con
-- su dirección en `to_email`, y los eventos de Resend con su payload.
--
-- La lista de supresiones (`email_suppressions`) se queda a propósito: es lo
-- que impide volver a escribir a una dirección que rebotó o se quejó.
--
-- Los ficheros de Storage (la foto) no se pueden borrar desde SQL (trigger
-- `storage.protect_delete`); los quita el cliente con la sesión de su dueño
-- antes de llamar a esta función (core/profile/queries.ts).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  delete from public.email_events e
   using public.email_outbox o
   where e.outbox_id = o.id
     and o.user_id = caller;

  delete from public.email_outbox where user_id = caller;

  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
