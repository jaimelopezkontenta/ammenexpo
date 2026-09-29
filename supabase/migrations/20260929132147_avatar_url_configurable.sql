-- Revisión adversarial R1 (2026-09-29), S4: un avatar solo puede venir de
-- ESTE proyecto.
--
-- `validate_avatar_url` (20260929071548_avatar_privacy) aceptaba cualquier
-- `*.supabase.co`, y en producción también http, localhost, 10.0.2.2 y kong:
-- con un proyecto de Supabase propio, una cara seguía pudiendo registrar la
-- IP de cada persona que la viera. Y las filas escritas antes de ese trigger
-- no se habían revalidado nunca (el trigger solo mira `update of avatar_url`).
--
-- La base no sabe cuál es su URL pública, así que se le dice: una fila en
-- `project_settings` con la URL de la API tal como la usa el cliente
-- (`EXPO_PUBLIC_SUPABASE_URL`). La rellena el runbook en cada entorno remoto
-- y `seed.sql` en local, donde son varias (web, emulador Android). La URL
-- válida es exactamente la que escribe core/profile/avatar.ts:
--   <api_url>/storage/v1/object/public/avatars/<tu id>/<fichero>[?v=<n>]
--
-- Sin configurar, no se acepta ninguna foto nueva (falla cerrado, con un
-- mensaje que dice qué falta) y no se limpia nada: sin saber cuál es el host
-- propio no se puede decidir qué es ajeno.

-- ---------------------------------------------------------------------------
-- Los ajustes del proyecto (una sola fila)
-- ---------------------------------------------------------------------------
create table if not exists public.project_settings (
  id boolean primary key default true check (id),
  api_urls text[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on column public.project_settings.api_urls is
  'URL pública de la API de este proyecto, como EXPO_PUBLIC_SUPABASE_URL (sin barra final). Solo se aceptan avatares servidos desde aquí.';

-- Sin policies: solo el dueño de la base (SQL Editor, migraciones, seed).
alter table public.project_settings enable row level security;
revoke all on public.project_settings from public, anon, authenticated, service_role;

insert into public.project_settings (id) values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- La regla, en un sitio: la usan el trigger y la limpieza
-- ---------------------------------------------------------------------------
create or replace function public.avatar_url_is_valid(p_user uuid, p_url text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.project_settings s
     cross join lateral unnest(s.api_urls) as b(url)
     cross join lateral (
       select rtrim(btrim(b.url), '/')
              || '/storage/v1/object/public/avatars/'
              || p_user::text || '/' as prefix
     ) x
     where s.id
       and btrim(b.url) <> ''
       and left(p_url, char_length(x.prefix)) = x.prefix
       -- Un nombre de fichero simple (nada de `..` ni subcarpetas) y, como
       -- mucho, el `?v=<n>` con el que el cliente rompe la caché.
       and substr(p_url, char_length(x.prefix) + 1)
           ~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*(\?v=[0-9]+)?$'
  );
$$;

revoke execute on function public.avatar_url_is_valid(uuid, text) from public, anon, authenticated;

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

  if not exists (
    select 1 from public.project_settings s, unnest(s.api_urls) as b(url)
     where s.id and btrim(b.url) <> ''
  ) then
    raise exception 'avatar_url cannot be checked: project_settings.api_urls is not configured';
  end if;

  if not public.avatar_url_is_valid(new.id, new.avatar_url) then
    raise exception 'avatar_url must point at your own folder in this project''s avatars bucket';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Las caras que ya apuntaban fuera
-- ---------------------------------------------------------------------------
create or replace function public.clear_foreign_avatar_urls()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not exists (
    select 1 from public.project_settings s, unnest(s.api_urls) as b(url)
     where s.id and btrim(b.url) <> ''
  ) then
    return 0;
  end if;

  update public.profiles p
     set avatar_url = null
   where p.avatar_url is not null
     and p.avatar_url <> ''
     and not public.avatar_url_is_valid(p.id, p.avatar_url);
  get diagnostics n = row_count;

  return n;
end;
$$;

revoke execute on function public.clear_foreign_avatar_urls() from public, anon, authenticated;
grant execute on function public.clear_foreign_avatar_urls() to service_role;

-- En una base recién creada no hay nada que limpiar y en un entorno remoto
-- aún no está configurado: aquí es un no-op. El runbook la vuelve a llamar
-- después de rellenar `api_urls`.
select public.clear_foreign_avatar_urls();
