-- Ammen — B1: cerrar la lectura de la racha y el staff ajenos.
--
-- **El agujero.** `20260730100400_grants.sql` concedió `select` sobre TODA la
-- tabla `profiles` al rol `authenticated`, y la policy de SELECT es
-- `using (true)`: cualquier cuenta puede leer la fila entera de cualquier otra.
-- Cuando `profiles` solo llevaba nombre y avatar, leerlo todo era justamente la
-- idea. Pero la tabla acumuló después `streak_count` y `streak_last_day` (la
-- racha), `is_staff` (añadido en `20260814100000`) y los timestamps crudos
-- `created_at`/`updated_at` — y `public_profile()` lleva desde `20260809100000`
-- devolviéndolos **deliberadamente ocultos**. O sea: la app esconde la racha y
-- el bit de staff de los perfiles ajenos, y la API REST los entrega a
-- cualquiera con un `select` directo.
--
-- **La corrección es por columna, no por policy**, y es la misma que ya cerró el
-- UPDATE en `20260819100000_restrict_profile_updates.sql` y la lectura de
-- `prayer_body`/`daily_action` desde `20260801160000`: RLS decide filas, no
-- columnas, así que la única forma de que una columna privilegiada no se lea es
-- que el rol cliente no tenga grant sobre ella.
--
-- **Lo que sigue siendo público de verdad.** `follower_count` y
-- `following_count` se quedan: son números que `public_profile()` ya entrega a
-- cualquiera con sesión ("los números son públicos, la lista no"), y
-- `search_people()` —SECURITY INVOKER— los lee para ordenar el directorio de
-- personas. `search_vector` también se queda: no es más que el índice de texto
-- derivado del `display_name` que ya es público, y `search_people()` lo necesita
-- en su `where`. Revocarlos reventaría el buscador con «permission denied for
-- table profiles» sin cerrar ninguna fuga real.
--
-- **Lo que se esconde: la racha, el staff y los timestamps crudos.** La racha la
-- mueve el trigger `bump_personal_streak()` (SECURITY DEFINER, no pasa por el
-- grant) y el dueño la lee por la RPC `my_profile_data()` de abajo. `is_staff`
-- lo lee `is_staff()` (SECURITY DEFINER). `created_at`/`updated_at` solo los
-- usan `public_profile()` —que ya lo expone como `member_since`— y
-- `export_my_data()`, ambas SECURITY DEFINER. Nada de lo que el cliente ejecuta
-- en su propio nombre los necesita.

revoke select on public.profiles from authenticated;

grant select (
  id, display_name, avatar_url, follower_count, following_count, search_vector
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- La racha del dueño, por la puerta que sí cierra
-- ---------------------------------------------------------------------------
--
-- Sin esta RPC, cerrar el grant dejaría al dueño sin forma de leer su propia
-- racha: la columna se esconde de todos, incluido él, y `public_profile()` no
-- la devuelve. Igual que `get_my_day()` para el texto personal del plan, la
-- función corre como DEFINER y devuelve **solo los datos de `auth.uid()`** — no
-- acepta un id, de modo que ningún parámetro puede apuntar a otra persona.
--
-- `is_staff` viaja aquí (y no por la tabla) por la misma razón: el dueño lo
-- necesita para saber si es moderador, y ya no lo puede leer de su propia fila.

create function public.my_profile_data()
returns table (
  is_staff boolean,
  streak_count integer,
  streak_last_day date
)
language sql
stable
security definer
set search_path = ''
as $$
  select is_staff, streak_count, streak_last_day
  from public.profiles
  where id = (select auth.uid());
$$;

revoke execute on function public.my_profile_data() from public, anon;
grant execute on function public.my_profile_data() to authenticated;
