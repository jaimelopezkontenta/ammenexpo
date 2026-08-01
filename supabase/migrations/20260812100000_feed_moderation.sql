-- Ammen — que el feed abierto pueda moderarse.
--
-- La comunidad pintaba su propia tarjeta —orar y comentarios— mientras
-- `PrayerRequestCard`, que ya trae reportar, bloquear, ocultar, marcar
-- respondida y borrar, se usaba solo en `/peticiones`. O sea: en la pantalla
-- donde aparecen más desconocidos no había ni reportar ni bloquear. Es
-- exactamente lo que mira la Guideline 1.2 de Apple, y lo abrí yo tres commits
-- atrás al construir el feed.
--
-- Para que las dos superficies compartan tarjeta, el feed tiene que devolver lo
-- mismo que el muro: **`is_anonymous`** —hoy se adivinaba por un `author_id`
-- nulo, que es cierto pero indirecto— y **`answered_at`**, que es lo que pinta
-- una petición ya respondida y en el feed no llegaba de ninguna forma.
--
-- Cambia el tipo de retorno, así que hay que soltarla, recrearla y **volver a
-- emitir el grant**. Quinta vez en este proyecto; ya no sorprende a nadie.

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
