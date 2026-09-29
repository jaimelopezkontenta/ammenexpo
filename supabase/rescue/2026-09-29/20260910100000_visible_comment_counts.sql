-- Count only comments visible to the current viewer, using the existing RLS.
-- Stored counters include hidden/held comments and blocked authors.
-- Keep paging, feature flags, output types and all authorization unchanged.


create or replace function public.prayer_feed(
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
    (select count(*)::integer from public.comments c where c.post_id = p.id) as comment_count,
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

create or replace function public.person_posts(p_user_id uuid, p_limit integer default 20)
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
    (select count(*)::integer from public.comments c where c.post_id = p.id) as comment_count,
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

create or replace function public.home_feed(
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
  -- Fail-closed: la comunidad se sirve solo si el flag está encendido. El
  -- chequeo vive en el servidor y ANTES de leer nada, así que OFF es
  -- conjunto vacío —no un filtrado parcial— y un flag desconocido se
  -- comporta igual (fail-closed). Las policies de SELECT de cada fuente
  -- siguen decidiendo exactamente igual para el caso ON.
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  with following as (
    -- Sin alias `as id`: en plpgsql la columna `id` del `returns table` es una
    -- variable OUT y un `id` pelado en una subconsulta quedaría ambiguo. El
    -- nombre `followee_id` no colisiona con ninguna variable.
    select f.followee_id
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
      (select count(*)::integer from public.comments c where c.post_id = p.id) as comment_count,
      p.answered_at,
      p.held_at,
      p.crisis_flagged_at,
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
        or p.author_id in (select followee_id from following)
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
      null::timestamptz,
      t.created_at,
      false,
      t.user_id = (select auth.uid())
    from public.testimonies t
    join public.profiles pr on pr.id = t.user_id
    left join public.prayer_plans pl on pl.id = t.plan_id
    where (
      (select yes from everyone)
      or t.user_id in (select followee_id from following)
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
        or pl.owner_id in (select followee_id from following)
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
end;
$$;

