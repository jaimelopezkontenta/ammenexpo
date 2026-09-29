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

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/avatar.png'
  $q$),
  'and nobody can delete a face that is not theirs');

-- Pintar la cara no pasa por aquí: el bucket es público y su URL se sirve sin
-- RLS. Lo que esta policy decide es quién puede LISTAR el bucket, y listarlo
-- era leer el UUID de cada persona con foto (Oleada 1a, 2026-09-29).
select pg_temp.assert(
  (select count(*) from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/avatar.png') = 0,
  'and nobody else can list it — the public URL serves it without RLS');

commit;


-- ===========================================================================
-- Y `avatar_url` tiene que apuntar de verdad ahí
--
-- Sin esta comprobación es un campo de texto libre que se pinta en un <Image>
-- de todas las pantallas sociales: es decir, una URL arbitraria elegida por
-- otra persona cargándose en tu dispositivo.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54321/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.png'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'her own avatar URL is accepted');

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
       set avatar_url = 'http://127.0.0.1:54321/storage/v1/object/public/avatars/22222222-2222-2222-2222-222222222222/avatar.png'
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

select pg_temp.assert(
  not pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.jpg?v=1727600000000'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'a hosted Supabase URL with the client cache-busting ?v= is accepted');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profiles
       set avatar_url = 'http://127.0.0.1:54321/storage/v1/object/public/avatars/11111111-1111-1111-1111-111111111111/avatar.png?track=1'
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'any other query string is not');

-- Quitarse la foto tiene que poder hacerse.
select pg_temp.assert(
  not pg_temp.raises($q$
    update public.profiles set avatar_url = null
     where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'and taking your face down always works');

commit;

\echo '===================================='
\echo ' STORAGE ASSERTIONS PASSED'
\echo '===================================='
