-- Ammen — los términos, aceptados dentro de la app.
--
-- La Guideline 1.2 de Apple pide, para cualquier app con contenido de personas,
-- **un acuerdo aceptado** —no publicado en una web— que prohíba explícitamente
-- el contenido objetable. Hoy no hay ni términos ni política de privacidad en
-- todo el repositorio, y desde que existen el muro abierto, la búsqueda de
-- personas y los perfiles públicos, esto es lo único de la lista que puede
-- tumbar el lanzamiento entero.
--
-- Se guarda **la versión aceptada, no un booleano**: el día que el texto cambie
-- de forma importante hay que volver a preguntar, y un `true` no sabe de qué
-- texto venía. La fecha se guarda aparte porque es lo que se enseña si alguien
-- reclama qué aceptó y cuándo.

alter table public.profile_settings
  add column terms_version text,
  add column terms_accepted_at timestamptz;

-- Escribir la aceptación pasa por aquí y no por un `update` suelto: así la
-- fecha la pone el servidor. Con un update desde el cliente, la hora la pondría
-- el reloj del teléfono, que es justo el dato que no puede venir de la parte
-- interesada.
create function public.accept_terms(p_version text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_version is null or btrim(p_version) = '' then
    raise exception 'a version is required';
  end if;

  update public.profile_settings
     set terms_version = p_version,
         terms_accepted_at = now()
   where id = (select auth.uid());

  -- Cero filas es como RLS rechaza un update: sin error y sin filas. Aquí eso
  -- significaría que alguien se queda dando al botón sin que pase nada.
  if not found then
    raise exception 'profile settings missing';
  end if;
end;
$$;

revoke execute on function public.accept_terms(text) from public;
grant execute on function public.accept_terms(text) to authenticated;
