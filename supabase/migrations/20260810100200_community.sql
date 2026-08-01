-- Ammen — la comunidad: encontrar personas, y ver lo que dicen.
--
-- Media red social ya estaba construida y escondida: el muro abierto de
-- peticiones es un enlace dentro de la pestaña Orar, y los testimonios están
-- detrás de un botón en el Perfil. Nadie los iba a encontrar. Esto los junta en
-- un sitio, les añade los planes públicos, y —lo que no existía de ninguna
-- forma— **una manera de encontrar a una persona**.

-- ---------------------------------------------------------------------------
-- Buscar personas
-- ---------------------------------------------------------------------------
--
-- Misma forma que `search_public_circles`, hasta el saneado a mano: `to_tsquery`
-- revienta con un `&`, con dos puntos o con una comilla sin cerrar, y hace falta
-- el prefijo `:*` para que filtre mientras se escribe — sin él, teclear "mar"
-- no encontraría "María", que es justo lo que hace una caja de búsqueda.
--
-- Y con `immutable_unaccent`, que es lo que hace que `maria` encuentre *María*
-- y `nunez` encuentre *Núñez*. Esa lección ya se pagó dos veces: la eñe no es
-- una ene acentuada, y la configuración `spanish` la conserva.

alter table public.profiles
  add column search_vector tsvector
  generated always as (
    to_tsvector('spanish'::regconfig, public.immutable_unaccent(display_name))
  ) stored;

create index profiles_search_idx on public.profiles using gin (search_vector);

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
    -- Quien bloqueaste no se busca. Al revés **sí**: bloquear es silencioso, y
    -- desaparecer de los resultados de quien te bloqueó le diría que funcionó.
    and not public.has_blocked(p.id)
    and (v_query is null or p.search_vector @@ v_query)
    -- Sin nombre no hay a quién buscar: una cuenta recién creada tiene el
    -- display_name a cadena vacía hasta que termina el onboarding.
    and btrim(p.display_name) <> ''
  order by p.follower_count desc, p.display_name
  limit greatest(least(p_limit, 50), 1)
  offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.search_people(text, integer, integer) from public;
grant execute on function public.search_people(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- El feed
-- ---------------------------------------------------------------------------
--
-- Tres fuentes con una columna `kind` que dice cuál es cada fila. SECURITY
-- **INVOKER**: cada una la filtra su propia policy —lo anónimo sigue anónimo,
-- lo bloqueado sigue sin llegar, un testimonio privado sigue siendo privado— y
-- esta función solo decide *de quién*.
--
-- **Sin nadie a quien seguir, el feed no puede estar vacío.** Si sigues a cero
-- personas se sirve lo público reciente de cualquiera. Un feed en blanco el
-- primer día es la forma más rápida de no volver, y es exactamente el día en
-- que no sigues a nadie.

create function public.home_feed(
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  kind text,
  id uuid,
  body text,
  title text,
  author_id uuid,
  author_name text,
  author_avatar_url text,
  prayer_count integer,
  comment_count integer,
  created_at timestamptz,
  i_prayed boolean,
  is_mine boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with following as (
    select f.followee_id as id
    from public.follows f
    where f.follower_id = (select auth.uid())
  ),
  -- Con cero seguidos se abre a todo el mundo; con uno o más, a esas personas
  -- y a ti.
  everyone as (
    select not exists (select 1 from following) as yes
  ),
  requests as (
    select
      'request'::text as kind,
      p.id,
      p.body,
      null::text as title,
      case when p.is_anonymous then null else p.author_id end as author_id,
      case when p.is_anonymous then null else pr.display_name end as author_name,
      case when p.is_anonymous then null else pr.avatar_url end as author_avatar_url,
      p.prayer_count,
      p.comment_count,
      p.created_at,
      exists (
        select 1 from public.post_prayers pp
        where pp.post_id = p.id and pp.user_id = (select auth.uid())
      ) as i_prayed,
      p.author_id = (select auth.uid()) as is_mine
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    -- Solo el muro abierto: lo de un círculo se lee dentro de su círculo, y
    -- sacarlo aquí rompería la promesa de que un círculo privado es privado.
    where p.group_id is null
      and (
        (select yes from everyone)
        or p.author_id in (select id from following)
        or p.author_id = (select auth.uid())
      )
  ),
  stories as (
    select
      'testimony'::text,
      t.id,
      t.body,
      pl.title,
      t.user_id,
      pr.display_name,
      pr.avatar_url,
      0,
      0,
      t.created_at,
      false,
      t.user_id = (select auth.uid())
    from public.testimonies t
    join public.profiles pr on pr.id = t.user_id
    left join public.prayer_plans pl on pl.id = t.plan_id
    where (
      (select yes from everyone)
      or t.user_id in (select id from following)
      or t.user_id = (select auth.uid())
    )
  ),
  plans as (
    select
      'plan'::text,
      pl.id,
      null::text,
      pl.title,
      pl.owner_id,
      pr.display_name,
      pr.avatar_url,
      0,
      0,
      pl.created_at,
      false,
      pl.owner_id = (select auth.uid())
    from public.prayer_plans pl
    join public.profiles pr on pr.id = pl.owner_id
    where pl.visibility = 'public'
      and pl.status = 'active'
      and (
        (select yes from everyone)
        or pl.owner_id in (select id from following)
        or pl.owner_id = (select auth.uid())
      )
  ),
  everything as (
    select * from requests
    union all select * from stories
    union all select * from plans
  )
  select *
  from everything e
  where p_before is null or e.created_at < p_before
  order by e.created_at desc
  limit greatest(least(p_limit, 50), 1);
$$;

revoke execute on function public.home_feed(timestamptz, integer) from public;
grant execute on function public.home_feed(timestamptz, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Lo de una persona, en su perfil
-- ---------------------------------------------------------------------------

-- **Lo anónimo no sale nunca.** `prayer_feed` ya retiene el `author_id` cuando
-- una petición es anónima; una lista por persona es justo la forma de deshacer
-- ese anonimato, así que aquí se excluye en el `where`, no solo en las columnas.
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
language sql
stable
security invoker
set search_path = ''
as $$
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
$$;

revoke execute on function public.person_posts(uuid, integer) from public;
grant execute on function public.person_posts(uuid, integer) to authenticated;

create function public.person_plans(p_user_id uuid, p_limit integer default 20)
returns table (
  id uuid,
  title text,
  duration_days smallint,
  created_at timestamptz,
  is_mine boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.title,
    p.duration_days,
    p.created_at,
    p.owner_id = (select auth.uid())
  from public.prayer_plans p
  where p.owner_id = p_user_id
    -- Solo los públicos, incluso en tu propio perfil: esta lista es lo que ve
    -- otra persona, y enseñarte a ti una versión más larga haría imposible
    -- saber qué estás publicando.
    and p.visibility = 'public'
    and p.status = 'active'
  order by p.created_at desc
  limit greatest(least(p_limit, 50), 1);
$$;

revoke execute on function public.person_plans(uuid, integer) from public;
grant execute on function public.person_plans(uuid, integer) to authenticated;
