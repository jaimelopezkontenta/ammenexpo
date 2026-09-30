-- Barrido de privilegios, ronda 2 (2026-09-30): la lista de espera de Plus
-- escribe al correo de tu cuenta, no al que se teclee.
--
-- Apuntarse encola un correo transaccional (`enqueue_waitlist_email`, AFTER
-- INSERT) a `plus_waitlist.email`, y esa columna era libre: cada cuenta podía
-- mandar un correo de Ammen a cualquier dirección, con el nombre —y lo que se
-- escriba en él— dentro. Sin captcha en el alta, eso es un relé de correo a
-- terceros, y la lista entera lo sería el día que se avise del lanzamiento.
--
-- La pantalla (`app/plus.tsx`) ya rellena el campo con el correo de la sesión;
-- teclear otro era posible, pero no hay un caso de uso que lo necesite: el
-- aviso es para la persona de la cuenta. Así que el servidor fija `email` al
-- de la cuenta (`email_address_for`, el mismo que usa el correo de
-- bienvenida) en cada INSERT y UPDATE, sin romper el upsert que manda la app
-- (`useJoinWaitlist`: `user_id`, `name`, `email`). Lo tecleado se ignora; el
-- campo, en la app, debería pasar a ser de solo lectura.
--
-- El GRANT pasa a ser por columnas con lo que manda ese upsert (su ON CONFLICT
-- DO UPDATE reescribe las mismas columnas); `created_at` queda para el valor
-- por defecto. Las filas que ya existían se alinean con su cuenta.
--
-- Idempotente: `create or replace`, el trigger se borra antes de crearse, y
-- revocar el privilegio de tabla quita también el de columnas.

create or replace function public.pin_waitlist_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := public.email_address_for(new.user_id);

  if new.email is null then
    raise exception 'the account has no email address';
  end if;

  return new;
end;
$$;

revoke execute on function public.pin_waitlist_email() from public, anon, authenticated;

drop trigger if exists plus_waitlist_pin_email on public.plus_waitlist;
create trigger plus_waitlist_pin_email
  before insert or update on public.plus_waitlist
  for each row execute function public.pin_waitlist_email();

update public.plus_waitlist w
   set email = lower(u.email)
  from auth.users u
 where u.id = w.user_id
   and u.email is not null
   and w.email is distinct from lower(u.email);

revoke insert, update on public.plus_waitlist from authenticated;
grant insert (user_id, name, email) on public.plus_waitlist to authenticated;
grant update (user_id, name, email) on public.plus_waitlist to authenticated;
