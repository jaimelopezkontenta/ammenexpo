-- Ammen — dónde viven las caras.
--
-- `avatar_url` se consulta en **trece RPC y siete archivos de cliente** desde la
-- Fase 1, y no hay un solo `<Image>` en toda la app: la columna viaja por la red
-- en cada consulta y se tira. Esto es la mitad de servidor que faltaba.
--
-- Storage es una superficie de RLS que este proyecto no había tocado nunca. Las
-- policies no van sobre una tabla nuestra sino sobre `storage.objects`, y la
-- carpeta se saca del propio nombre del fichero.

-- El bucket lo declara `config.toml` en local, pero una migración tiene que
-- poder levantar esto en un proyecto vacío sin depender del CLI.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Quién puede escribir
-- ---------------------------------------------------------------------------

-- La ruta es `{user_id}/avatar.jpg`, y `storage.foldername(name)` devuelve los
-- segmentos: el primero tiene que ser tu propio id. Sin esto, cualquiera con
-- sesión podría escribir sobre la carpeta de otra persona y cambiarle la cara.
create policy "anyone can look at an avatar"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "you upload only into your own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Cambiar de foto es sobrescribir, así que hace falta UPDATE además de INSERT:
-- el cliente sube con `upsert: true` para no ir dejando ficheros huérfanos.
create policy "you replace only your own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "you delete only your own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Y quién puede decir que la tiene
-- ---------------------------------------------------------------------------

-- `profiles` solo dejaba escribir `display_name` desde el cliente; el GRANT es
-- de tabla entera y la policy de UPDATE mira de quién es la fila, así que
-- `avatar_url` ya era escribible. Lo que faltaba era que alguien lo hiciera.
--
-- Se valida que apunte de verdad al bucket y a tu carpeta: sin esto,
-- `avatar_url` es un campo de texto libre que se pinta en un `<Image>` de todas
-- las pantallas sociales — es decir, una URL arbitraria elegida por otra
-- persona cargándose en tu dispositivo.
create function public.validate_avatar_url()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_url is null or new.avatar_url = '' then
    return new;
  end if;

  if new.avatar_url not like '%/storage/v1/object/public/avatars/' || new.id::text || '/%' then
    raise exception 'avatar_url must point at your own folder in the avatars bucket';
  end if;

  return new;
end;
$$;

create trigger profiles_validate_avatar_url
  before insert or update of avatar_url on public.profiles
  for each row execute function public.validate_avatar_url();
