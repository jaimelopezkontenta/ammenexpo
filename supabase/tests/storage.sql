\set ON_ERROR_STOP on

-- Storage: una superficie de RLS que este proyecto no había tocado nunca.
--
-- Las policies no van sobre una tabla nuestra sino sobre `storage.objects`, y
-- la carpeta se saca del propio nombre del fichero con `storage.foldername()`.
-- Equivocarse aquí no da un error: da que cualquiera con sesión pueda
-- cambiarle la cara a otra persona.

\set ANA  '''11111111-1111-1111-1111-111111111111'''
\set BETO '''22222222-2222-2222-2222-222222222222'''

create or replace function pg_temp.assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice 'PASS  %', label;
  else
    raise exception 'FAIL  %', label;
  end if;
end;
$$;

create or replace function pg_temp.raises(stmt text)
returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end;
$$;

-- Cuántas filas tocó una sentencia: RLS no da error, da cero filas.
create or replace function pg_temp.rows(stmt text)
returns integer language plpgsql as $$
declare
  n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end;
$$;

begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:ANA,  'ana@test.local',  'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:BETO, 'beto@test.local', 'authenticated', 'authenticated', '{"display_name":"Beto"}');

commit;


-- ===========================================================================
-- El bucket existe y es lo que dice ser
-- ===========================================================================
begin;

select pg_temp.assert(
  (select public from storage.buckets where id = 'avatars'),
  'the avatars bucket is public, so a face does not need a signed URL per screen');

-- 2 MiB y no los 50 del límite global: un avatar más pesado que eso es un
-- avatar que nadie redimensionó.
select pg_temp.assert(
  (select file_size_limit from storage.buckets where id = 'avatars') = 2097152,
  'and capped at 2 MiB');

select pg_temp.assert(
  (select allowed_mime_types from storage.buckets where id = 'avatars')
    @> array['image/png', 'image/jpeg'],
  'and only accepts images');

commit;


-- ===========================================================================
-- Cada uno escribe en su carpeta
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not pg_temp.raises($q$
    insert into storage.objects (bucket_id, name, owner)
    values ('avatars',
            '11111111-1111-1111-1111-111111111111/avatar.png',
            '11111111-1111-1111-1111-111111111111')
  $q$),
  'Ana can upload into her own folder');

-- La que de verdad importa: sin esto, cualquiera con sesión le cambia la cara
-- a cualquiera.
select pg_temp.assert(
  pg_temp.raises($q$
    insert into storage.objects (bucket_id, name, owner)
    values ('avatars',
            '22222222-2222-2222-2222-222222222222/avatar.png',
            '11111111-1111-1111-1111-111111111111')
  $q$),
  'but not into somebody else''s');

commit;

-- R1 S10: el `upload(..., { upsert: true })` de core/profile/avatar.ts
-- necesita VER su propia fila y poder sobrescribirla.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from storage.objects
    where bucket_id = 'avatars'
      and name = '11111111-1111-1111-1111-111111111111/avatar.png') = 1,
  'Ana sees her own avatar file (what the upsert needs to find it)');

select pg_temp.assert(
  pg_temp.rows($q$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values ('avatars',
            '11111111-1111-1111-1111-111111111111/avatar.png',
            '11111111-1111-1111-1111-111111111111',
            '{"v": 2}')
    on conflict (bucket_id, name) do update set metadata = excluded.metadata
  $q$) = 1,
  'and can replace it in place (upsert), without leaving orphans');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values ('avatars',
            '11111111-1111-1111-1111-111111111111/avatar.png',
            '22222222-2222-2222-2222-222222222222',
            '{"v": 666}')
    on conflict (bucket_id, name) do update set metadata = excluded.metadata
  $q$),
  'Beto cannot upsert over Ana''s file');

select pg_temp.assert(
  pg_temp.rows($q$
    update storage.objects set metadata = '{"v": 666}'
     where name = '11111111-1111-1111-1111-111111111111/avatar.png'
  $q$) = 0,
  'nor update it: the row is simply not his to touch');

-- Pintar la cara no pasa por aquí: el bucket es público y su URL se sirve sin
-- RLS. Lo que esta policy decide es quién puede LISTAR el bucket, y listarlo
-- era leer el UUID de cada persona con foto (Oleada 1a, 2026-09-29).
select pg_temp.assert(
  (select count(*) from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/avatar.png') = 0,
  'and nobody else can list it — the public URL serves it without RLS');

-- Un DELETE directo lo para antes que nada el trigger `protect_objects_delete`
-- de Storage (borrar es cosa de la API), para todos por igual.
select pg_temp.assert(
  pg_temp.raises($q$
    delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/avatar.png'
  $q$),
  'a direct DELETE is stopped by Storage''s own trigger (deleting goes through the API)');

-- R1 S10: y por debajo del trigger, la policy. Con el permiso de borrado de
-- la API encendido, Beto sigue sin poder borrar la cara de Ana.
set local storage.allow_delete_query = 'true';

select pg_temp.assert(
  pg_temp.rows($q$
    delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/avatar.png'
  $q$) = 0,
  'and even past that trigger, the delete policy gives Beto nothing to delete');

commit;

select pg_temp.assert(
  (select metadata ->> 'v' from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/avatar.png') = '2',
  'Ana''s file is still there, as she left it');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local storage.allow_delete_query = 'true';

select pg_temp.assert(
  pg_temp.rows($q$
    delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/avatar.png'
  $q$) = 1,
  'while Ana can delete her own (what «remove photo» does through the API)');

rollback;


-- ===========================================================================
-- Y `avatar_url` tiene que apuntar de verdad ahí
--
-- Sin esta comprobación es un campo de texto libre que se pinta en un <Image>
-- de todas las pantallas sociales: es decir, una URL arbitraria elegida por
-- otra persona cargándose en tu dispositivo.
--
-- R1 S4: «ahí» es ESTE proyecto, el que dice `project_settings.api_urls`, no
-- cualquier `*.supabase.co` ni cualquier localhost. La suite fija los suyos:
-- el Kong local y un proyecto alojado de mentira.
-- ===========================================================================
begin;

update public.project_settings
   set api_urls = array['http://127.0.0.1:54421', 'https://ammenprueba.supabase.co/']
 where id;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54421/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.png'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'her own avatar URL is accepted');

select pg_temp.assert(
  not pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'https://ammenprueba.supabase.co/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.jpg?v=1727600000000'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'this project''s hosted URL with the client cache-busting ?v= is accepted (a trailing slash in the setting does not matter)');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'https://un-sitio-cualquiera.example/rastreador.png'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'an arbitrary URL from the internet is not');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54421/storage/v1/object/public/avatars/22222222-2222-2222-2222-222222222222/avatar.png'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'nor somebody else''s folder');

-- El host también cuenta: un servidor propio con la misma ruta registraba la
-- IP de cada persona que viera la cara (Oleada 1a, 2026-09-29).
select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'https://rastreo.example/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.png'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'a foreign host that only copies the path is not');

-- R1 S4: tampoco otro proyecto de Supabase (uno propio sirve igual para
-- rastrear) ni los hosts locales que este entorno no usa.
select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'https://otroproyecto.supabase.co/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.jpg'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'another Supabase project is not');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://ammenprueba.supabase.co/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.jpg'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'nor this project over plain http');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://kong:8000/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.jpg'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$)
    and pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54321/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.jpg'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'nor a local host or port that is not configured');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54421/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.png?track=1'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'any other query string is not');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54421/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/..'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$)
    and pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54421/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/sub/avatar.png'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'nor a dot-dot or a subfolder instead of a file name');

-- Quitarse la foto tiene que poder hacerse.
select pg_temp.assert(
  not pg_temp.raises($q$
    update public.profiles set avatar_url = null
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'and taking your face down always works');

commit;

-- Sin configurar, nada entra: no hay forma de saber cuál es el host propio.
begin;

update public.project_settings set api_urls = '{}' where id;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54421/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.png'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'with no project URL configured, no avatar URL is accepted (fails closed)');

rollback;

-- Las filas escritas antes de la regla: clear_foreign_avatar_urls las limpia.
begin;

alter table public.profiles disable trigger profiles_validate_avatar_url;

update public.profiles
   set avatar_url = 'https://otroproyecto.supabase.co/storage/v1/object/public/avatars/22222222-2222-2222-2222-222222222222/avatar.png'
 where id = '22222222-2222-2222-2222-222222222222';

update public.profiles
   set avatar_url = 'http://127.0.0.1:54421/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.png?v=7'
 where id = '11111111-1111-1111-1111-111111111111';

alter table public.profiles enable trigger profiles_validate_avatar_url;

select pg_temp.assert(
  public.clear_foreign_avatar_urls() = 1,
  'clearing old rows touches exactly the one that points elsewhere');

select pg_temp.assert(
  (select avatar_url from public.profiles where id = '22222222-2222-2222-2222-222222222222') is null
    and (select avatar_url from public.profiles where id = '11111111-1111-1111-1111-111111111111')
          like 'http://127.0.0.1:54421/%',
  'the foreign one is gone and the valid one stays');

update public.project_settings set api_urls = '{}' where id;

select pg_temp.assert(
  public.clear_foreign_avatar_urls() = 0,
  'and with no project URL configured it clears nothing (it cannot tell what is foreign)');

rollback;

select pg_temp.assert(
  not has_function_privilege('authenticated', 'public.clear_foreign_avatar_urls()', 'EXECUTE')
    and not has_table_privilege('authenticated', 'public.project_settings', 'UPDATE')
    and not has_table_privilege('anon', 'public.project_settings', 'SELECT'),
  'nobody with a session can change what counts as this project, or run the cleanup');

\echo '===================================='
\echo ' STORAGE ASSERTIONS PASSED'
\echo '===================================='
