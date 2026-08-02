-- Ammen — el filtro que retiene para revisión.
--
-- La Guideline 1.2 pide cuatro cosas para contenido de personas: bloquear,
-- reportar, términos aceptados y **un método para filtrar el contenido
-- objetable**. Las tres primeras existen; de la cuarta no había nada proactivo.
--
-- **Se retiene, no se borra.** Un filtro que traga un mensaje sin decir nada es
-- peor que no tenerlo: quien escribió cree que publicó, nadie se lo dice, y
-- vuelve a intentarlo. Lo retenido lo sigue viendo su autor —con una nota— y
-- deja de verlo el resto hasta que alguien lo revise.
--
-- **Y por eso retiene en vez de rechazar.** Una lista de palabras se equivoca:
-- «matar» aparece en una petición por alguien que quiere hacerse daño y también
-- en un versículo citado de memoria. Un falso positivo que retrasa es un
-- problema; uno que borra, otro muy distinto.

alter table public.posts add column held_at timestamptz;
alter table public.comments add column held_at timestamptz;

-- ---------------------------------------------------------------------------
-- La lista
-- ---------------------------------------------------------------------------
--
-- Corta y a propósito. Esto no es moderación de verdad —eso es gente leyendo
-- reportes— sino la red que evita que lo peor se publique sin que nadie lo mire.
-- El día que haya equipo de moderación, esta lista quiere ser una tabla que
-- puedan editar sin desplegar; mientras no lo hay, una tabla vacía que nadie
-- mantiene sería peor que una lista corta que sí hace algo.
--
-- Compara sobre el texto **sin acentos y en minúsculas**, y con frontera de
-- palabra: sin `\m...\M`, «puta» encontraría «disputa» y «reputación», que es el
-- fallo clásico de estos filtros y la forma más rápida de que la gente aprenda
-- a desconfiar del aviso.

create function public.is_objectionable(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_clean text;
  v_term text;
  v_terms text[] := array[
    -- Insulto y acoso
    'puta', 'putas', 'puto', 'putos', 'zorra', 'maricon', 'maricones',
    'retrasado', 'retrasada', 'subnormal', 'imbecil', 'idiota',
    'bitch', 'whore', 'faggot', 'retard', 'retarded',
    -- Odio
    'sudaca', 'sudacas', 'negrata', 'moro de mierda',
    'nigger', 'kike', 'tranny',
    -- Amenaza y autolesión
    'te voy a matar', 'os voy a matar', 'ojala te mueras',
    'quiero matarme', 'me voy a matar', 'voy a suicidarme',
    'kill yourself', 'kys', 'i want to die',
    -- Sexual explícito
    'porno', 'pornografia', 'xxx', 'onlyfans',
    'porn', 'nudes',
    -- Estafa y spam
    'bitcoin gratis', 'dinero facil', 'gana dinero desde casa',
    'free bitcoin', 'crypto giveaway'
  ];
begin
  if p_text is null then
    return false;
  end if;

  v_clean := lower(public.immutable_unaccent(p_text));

  foreach v_term in array v_terms loop
    -- `\m` y `\M` son las fronteras de palabra de Postgres. Un término de
    -- varias palabras las lleva en los extremos y funciona igual.
    if v_clean ~ ('\m' || v_term || '\M') then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create function public.hold_objectionable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_objectionable(new.body) then
    new.held_at := now();
  end if;

  return new;
end;
$$;

-- También al editar: sin `update of body`, publicar algo inofensivo y cambiarlo
-- después sería la forma obvia de saltarse esto.
create trigger posts_hold_objectionable
  before insert or update of body on public.posts
  for each row execute function public.hold_objectionable();

create trigger comments_hold_objectionable
  before insert or update of body on public.comments
  for each row execute function public.hold_objectionable();

-- ---------------------------------------------------------------------------
-- Quién ve lo retenido
-- ---------------------------------------------------------------------------
--
-- Su autor, y nadie más. La condición va donde ya estaba la de `hidden_at`, así
-- que sigue decidiéndose **con las columnas de la propia fila** — la regla 1 de
-- este proyecto, la que rompe los `insert ... returning` cuando se olvida.

drop policy "your own always, everyone else's if visible to you" on public.posts;

create policy "your own always, everyone else's if visible to you"
  on public.posts for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (
      hidden_at is null
      and held_at is null
      and not public.has_blocked(author_id)
      and (group_id is null or public.is_group_member(group_id))
    )
  );

drop policy "comments visible with the post" on public.comments;

create policy "comments visible with the post"
  on public.comments for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (
      hidden_at is null
      and held_at is null
      and not public.has_blocked(author_id)
      and public.can_read_post(post_id)
    )
  );

-- Nada cuelga de una petición retenida: ni comentarios de otros, ni oraciones.
create or replace function public.can_read_post(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = pid
      and p.hidden_at is null
      and p.held_at is null
      and (p.group_id is null or public.is_group_member(p.group_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Y que la pantalla pueda decirlo
-- ---------------------------------------------------------------------------
--
-- Las tres RPC devuelven `held_at` para que la tarjeta de quien escribió pueda
-- poner «en revisión» en vez de fingir que se publicó. Cambian de tipo de
-- retorno: drop, recreate y volver a emitir el grant, las tres.

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
    p.is_anonymous,
    case when p.is_anonymous then null else p.author_id end,
    case when p.is_anonymous then null else pr.display_name end,
    case when p.is_anonymous then null else pr.avatar_url end,
    p.prayer_count,
    p.comment_count,
    p.answered_at,
    p.held_at,
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
$$;

revoke execute on function public.prayer_feed(uuid, timestamptz, integer) from public;
grant execute on function public.prayer_feed(uuid, timestamptz, integer) to authenticated;

drop function public.post_comments(uuid);

create function public.post_comments(p_post_id uuid)
returns table (
  id uuid,
  body text,
  author_id uuid,
  author_name text,
  author_avatar_url text,
  held_at timestamptz,
  created_at timestamptz,
  is_mine boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.body,
    c.author_id,
    pr.display_name,
    pr.avatar_url,
    c.held_at,
    c.created_at,
    c.author_id = (select auth.uid())
  from public.comments c
  join public.profiles pr on pr.id = c.author_id
  where c.post_id = p_post_id
  order by c.created_at;
$$;

revoke execute on function public.post_comments(uuid) from public;
grant execute on function public.post_comments(uuid) to authenticated;

drop function public.home_feed(timestamptz, integer);

create function public.home_feed(
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  kind text,
  id uuid,
  body text,
  title text,
  is_anonymous boolean,
  author_id uuid,
  author_name text,
  author_avatar_url text,
  prayer_count integer,
  comment_count integer,
  answered_at timestamptz,
  held_at timestamptz,
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
  everyone as (
    select not exists (select 1 from following) as yes
  ),
  requests as (
    select
      'request'::text as kind,
      p.id,
      p.body,
      null::text as title,
      p.is_anonymous,
      case when p.is_anonymous then null else p.author_id end as author_id,
      case when p.is_anonymous then null else pr.display_name end as author_name,
      case when p.is_anonymous then null else pr.avatar_url end as author_avatar_url,
      p.prayer_count,
      p.comment_count,
      p.answered_at,
      p.held_at,
      p.created_at,
      exists (
        select 1 from public.post_prayers pp
        where pp.post_id = p.id and pp.user_id = (select auth.uid())
      ) as i_prayed,
      p.author_id = (select auth.uid()) as is_mine
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
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
      false,
      t.user_id,
      pr.display_name,
      pr.avatar_url,
      0,
      0,
      null::timestamptz,
      null::timestamptz,
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
      false,
      pl.owner_id,
      pr.display_name,
      pr.avatar_url,
      0,
      0,
      null::timestamptz,
      null::timestamptz,
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
