-- Oleada 1a de la auditoría (2026-09-29): avatares sin fugas.

-- ---------------------------------------------------------------------------
-- Ver una cara no es listar el bucket
--
-- `select to public` sobre `storage.objects` no hacía falta para pintar un
-- avatar —un bucket público sirve sus URLs sin pasar por RLS— y en cambio
-- dejaba a cualquiera listar el bucket: cada carpeta es el UUID de una
-- persona. Ahora cada cual solo ve la fila de su propio fichero, que es lo
-- que necesita el `upload(..., { upsert: true })` de core/profile/avatar.ts.
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can look at an avatar" on storage.objects;
drop policy if exists "you see only your own avatar file" on storage.objects;

create policy "you see only your own avatar file"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Una URL de avatar que es de verdad un avatar de Supabase
--
-- El `like '%/storage/v1/object/public/avatars/<id>/%'` aceptaba cualquier
-- host con esa ruta: un avatar que apuntara a un servidor propio registraba
-- la IP de cada persona que lo viera en el muro o en «quién oró por ti».
-- Ahora el host tiene que ser un proyecto de Supabase o el Supabase local, la
-- ruta la de tu carpeta, el fichero un nombre simple y, como mucho, el
-- `?v=<n>` con el que el cliente rompe la caché.
--
-- La base no sabe cuál es su propio host, así que esto acota a
-- `*.supabase.co`, no a este proyecto: una cuenta con su propio proyecto de
-- Supabase aún podría apuntar allí. Cerrarlo del todo es guardar solo la ruta
-- y montar la URL en el cliente.
-- ---------------------------------------------------------------------------
create or replace function public.validate_avatar_url()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_url is null or new.avatar_url = '' then
    return new;
  end if;

  if new.avatar_url !~ (
    '^https?://([a-z0-9-]+\.supabase\.co|127\.0\.0\.1|localhost|10\.0\.2\.2|kong)(:[0-9]+)?'
    || '/storage/v1/object/public/avatars/'
    || new.id::text
    || '/[A-Za-z0-9._-]+(\?v=[0-9]+)?$'
  ) then
    raise exception 'avatar_url must point at your own folder in the avatars bucket';
  end if;

  return new;
end;
$$;
