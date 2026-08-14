-- Ammen — flags: cerrar el canal de escritura y cubrir toda la superficie.
--
-- Dos correcciones sobre `20260826100000_feature_flags.sql`, que queda intacta
-- (ya está aplicada; esto es forward-only):
--
-- **1. `admin_set_flag` solo por el canal administrativo.** La migración
-- anterior concedía EXECUTE a `authenticated` y, dentro, comprobaba
-- `is_staff()`. Eso abre dos puertas —el dashboard/runner y la app— cuando el
-- plan §9 promete una sola: "desde el canal administrativo (dashboard SQL o
-- runner protegido, nunca la app)". Se adopta el patrón ya probado de
-- `admin_set_staff`: revoke a los roles de API, grant solo a `service_role`,
-- sin comprobación interna — quien no puede ejecutar la función no llega al
-- cuerpo. El producto NO necesita que una cuenta staff mueva flags desde la
-- app; si mañana lo necesita, se abre un canal nuevo con su RPC y su grant, no
-- se reabre este.
--
-- **2. `community_feed` cierra toda la superficie comunitaria.** El plan dice
-- "apagar la superficie comunitaria", pero el flag solo se aplicaba en
-- `home_feed`: seguía habiendo gente a quien buscar (`search_people`), perfiles
-- públicos que leer (`person_posts`, `person_plans`) y el muro abierto
-- (`prayer_feed` sin círculo). A partir de aquí OFF devuelve conjunto vacío en
-- las cinco entradas. El feed de un círculo concreto (`prayer_feed(grupo)`) NO
-- se cierra: un círculo privado es una superficie distinta de la comunidad
-- pública, y apagar la comunidad no debe romper los círculos.

-- ---------------------------------------------------------------------------
-- 1. admin_set_flag: solo service_role, igual que admin_set_staff
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_flag(
  p_key text,
  p_enabled boolean,
  p_actor text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or char_length(btrim(p_actor)) = 0 then
    raise exception 'admin_set_flag requires who is operating';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'admin_set_flag requires a reason';
  end if;

  update public.feature_flags
     set enabled = p_enabled,
         updated_at = now()
   where key = p_key;

  if not found then
    raise exception 'unknown flag: %', p_key;
  end if;

  insert into public.feature_flag_events (flag_key, action, actor, reason)
  values (
    p_key,
    case when p_enabled then 'enable' else 'disable' end,
    btrim(p_actor),
    btrim(p_reason)
  );

  return true;
end;
$$;

-- El cliente no la llama ni conoce: solo el canal administrativo. Es el mismo
-- revoke/grant de `admin_set_staff`, no un grant al `authenticated` con un
-- `is_staff()` dentro.
revoke execute on function public.admin_set_flag(text, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_set_flag(text, boolean, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2a. search_people: OFF ⇒ directorio vacío
-- ---------------------------------------------------------------------------

drop function public.search_people(text, integer, integer);

create function public.search_people(
  p_query text default '',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  follower_count integer,
  i_follow boolean,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_terms text;
  v_query tsquery;
begin
  -- Fail-closed igual que home_feed: OFF es directorio vacío, antes de leer
  -- nada. El saneado de la consulta y el orden no cambian respecto de
  -- `20260810100200_community.sql`.
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  v_terms := btrim(
    regexp_replace(coalesce(p_query, ''), '[^[:alnum:][:space:]]', ' ', 'g')
  );

  if v_terms <> '' then
    v_query := to_tsquery(
      'spanish'::regconfig,
      array_to_string(
        array(
          select public.immutable_unaccent(w) || ':*'
          from unnest(regexp_split_to_array(v_terms, '\s+')) as w
          where w <> ''
        ),
        ' & '
      )
    );

    if numnode(v_query) = 0 then
      v_query := null;
    end if;
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.follower_count,
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = p.id
    ),
    count(*) over ()
  from public.profiles p
  where p.id <> (select auth.uid())
    and not public.has_blocked(p.id)
    and (v_query is null or p.search_vector @@ v_query)
    and btrim(p.display_name) <> ''
  order by p.follower_count desc, p.display_name
  limit greatest(least(p_limit, 50), 1)
  offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.search_people(text, integer, integer) from public;
grant execute on function public.search_people(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2b. person_posts / person_plans: OFF ⇒ perfil público vacío
-- ---------------------------------------------------------------------------

drop function public.person_posts(uuid, integer);

create function public.person_posts(p_user_id uuid, p_limit integer default 20)
returns table (
  id uuid,
  body text,
  prayer_count integer,
  comment_count integer,
  answered_at timestamptz,
  created_at timestamptz,
  i_prayed boolean,
  is_mine boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  select
    p.id,
    p.body,
    p.prayer_count,
    p.comment_count,
    p.answered_at,
    p.created_at,
    exists (
      select 1 from public.post_prayers pp
      where pp.post_id = p.id and pp.user_id = (select auth.uid())
    ),
    p.author_id = (select auth.uid())
  from public.posts p
  where p.author_id = p_user_id
    and p.group_id is null
    and not p.is_anonymous
  order by p.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;

revoke execute on function public.person_posts(uuid, integer) from public;
grant execute on function public.person_posts(uuid, integer) to authenticated;

drop function public.person_plans(uuid, integer);

create function public.person_plans(p_user_id uuid, p_limit integer default 20)
returns table (
  id uuid,
  title text,
  duration_days smallint,
  created_at timestamptz,
  is_mine boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  select
    p.id,
    p.title,
    p.duration_days,
    p.created_at,
    p.owner_id = (select auth.uid())
  from public.prayer_plans p
  where p.owner_id = p_user_id
    and p.visibility = 'public'
    and p.status = 'active'
  order by p.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;

revoke execute on function public.person_plans(uuid, integer) from public;
grant execute on function public.person_plans(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2c. prayer_feed: OFF cierra el muro abierto, no los círculos
-- ---------------------------------------------------------------------------

drop function public.prayer_feed(uuid, timestamptz, integer);

create function public.prayer_feed(
  p_group_id uuid default null,
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  body text,
  is_anonymous boolean,
  author_id uuid,
  author_name text,
  author_avatar_url text,
  prayer_count integer,
  comment_count integer,
  answered_at timestamptz,
  held_at timestamptz,
  crisis_flagged_at timestamptz,
  created_at timestamptz,
  i_prayed boolean,
  is_mine boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  -- El muro abierto (sin círculo) es comunidad y responde al flag; el feed de
  -- un círculo concreto no lo es. OFF cierra la pared pública y deja intactos
  -- los círculos, que son otra superficie.
  if p_group_id is null and not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  select
    p.id,
    p.body,
    p.is_anonymous,
    case when p.is_anonymous then null else p.author_id end,
    case when p.is_anonymous then null else pr.display_name end,
    case when p.is_anonymous then null else pr.avatar_url end,
    p.prayer_count,
    p.comment_count,
    p.answered_at,
    p.held_at,
    p.crisis_flagged_at,
    p.created_at,
    exists (
      select 1 from public.post_prayers pp
      where pp.post_id = p.id and pp.user_id = (select auth.uid())
    ),
    p.author_id = (select auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where (
      (p_group_id is null and p.group_id is null)
      or p.group_id = p_group_id
    )
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;

revoke execute on function public.prayer_feed(uuid, timestamptz, integer) from public;
grant execute on function public.prayer_feed(uuid, timestamptz, integer) to authenticated;
