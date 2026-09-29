-- Revisión adversarial R1 (2026-09-29), S8: un `not valid` que rompía cualquier
-- escritura del perfil.
--
-- 20260929071133_invite_email_caps añadió `profiles_display_name_length`
-- como `not valid` para no revalidar filas antiguas de un entorno remoto. Pero
-- Postgres comprueba el CHECK en cada UPDATE de la fila, toque la columna que
-- toque: a quien ya tuviera un nombre de más de 80 le fallaban el latido
-- (`heartbeat_last_seen`), la racha, el avatar… todo lo que escribe en
-- `profiles`.
--
-- Se recortan esos nombres a 80 (lo mismo que ya limita la pantalla de
-- perfil) y la restricción pasa a validada. Las dos cosas son idempotentes:
-- la segunda vez no hay nada que recortar y validar ya validada no hace nada.

update public.profiles
   set display_name = left(display_name, 80)
 where char_length(display_name) > 80;

alter table public.profiles validate constraint profiles_display_name_length;
