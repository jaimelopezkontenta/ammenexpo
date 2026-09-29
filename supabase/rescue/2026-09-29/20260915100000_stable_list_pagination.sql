-- Stable paging for every consumer of usePagedQuery. Existing RPCs remain
-- available for older clients. Row visibility, staff guards and returned fields
-- are preserved; the new endpoints add deterministic composite cursors.
begin;

CREATE FUNCTION public.held_content_queue_page(p_statuses text[] DEFAULT ARRAY['pending'::text, 'claimed'::text], p_after timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_after_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, target_type text, target_id uuid, author_id uuid, author_name text, body text, status text, claimed_by uuid, claimed_by_name text, reason text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_staff() then
    return;
  end if;

  return query
  select
    h.id,
    h.target_type,
    h.target_id,
    h.author_id,
    pr.display_name,
    coalesce(po.body, c.body),
    h.status,
    h.claimed_by,
    cpr.display_name,
    h.reason,
    h.created_at
  from public.content_holds h
  join public.profiles pr on pr.id = h.author_id
  left join public.profiles cpr on cpr.id = h.claimed_by
  left join public.posts po on po.id = h.target_id and h.target_type = 'post'
  left join public.comments c on c.id = h.target_id and h.target_type = 'comment'
  where h.status = any(p_statuses)
    and (((p_after is null and p_after_id is null) or (h.created_at, h.id) > (p_after, p_after_id)))
  -- Más antiguo primero: es la cola de un SLA, no un muro social.
  order by h.created_at asc, h.id asc
  limit greatest(least(p_limit, 50), 1);
end;
$function$;

revoke execute on function public.held_content_queue_page(p_statuses text[], p_after timestamp with time zone, p_limit integer, p_after_id uuid) from public;

grant execute on function public.held_content_queue_page(p_statuses text[], p_after timestamp with time zone, p_limit integer, p_after_id uuid) to authenticated;

CREATE FUNCTION public.home_feed_page(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid, p_before_kind text DEFAULT NULL::text)
 RETURNS TABLE(kind text, id uuid, body text, title text, is_anonymous boolean, author_id uuid, author_name text, author_avatar_url text, prayer_count integer, comment_count integer, answered_at timestamp with time zone, held_at timestamp with time zone, crisis_flagged_at timestamp with time zone, created_at timestamp with time zone, i_prayed boolean, is_mine boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
  where ((p_before is null and p_before_id is null and p_before_kind is null) or (e.created_at, e.id, e.kind) < (p_before, p_before_id, p_before_kind))
  order by e.created_at desc, e.id desc, e.kind desc
  limit greatest(least(p_limit, 50), 1);
end;
$function$;

revoke execute on function public.home_feed_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid, p_before_kind text) from public;

grant execute on function public.home_feed_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid, p_before_kind text) to authenticated;

CREATE FUNCTION public.my_notifications_page(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, type text, payload jsonb, read_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select n.id, n.type, n.payload, n.read_at, n.created_at
  from public.notifications n
  where n.user_id = (select auth.uid())
    and not public.has_blocked((n.payload ->> 'intercessor_id')::uuid)
    and (((p_before is null and p_before_id is null) or (n.created_at, n.id) < (p_before, p_before_id)))
  order by n.created_at desc, n.id desc
  limit greatest(least(p_limit, 100), 1);
$function$;

revoke execute on function public.my_notifications_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid) from public;

grant execute on function public.my_notifications_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid) to authenticated;

CREATE FUNCTION public.prayer_feed_page(p_group_id uuid DEFAULT NULL::uuid, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, body text, is_anonymous boolean, author_id uuid, author_name text, author_avatar_url text, prayer_count integer, comment_count integer, answered_at timestamp with time zone, held_at timestamp with time zone, crisis_flagged_at timestamp with time zone, created_at timestamp with time zone, i_prayed boolean, is_mine boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
    and (((p_before is null and p_before_id is null) or (p.created_at, p.id) < (p_before, p_before_id)))
  order by p.created_at desc, p.id desc
  limit greatest(least(p_limit, 50), 1);
end;
$function$;

revoke execute on function public.prayer_feed_page(p_group_id uuid, p_before timestamp with time zone, p_limit integer, p_before_id uuid) from public;

grant execute on function public.prayer_feed_page(p_group_id uuid, p_before timestamp with time zone, p_limit integer, p_before_id uuid) to authenticated;

CREATE FUNCTION public.report_queue_page(p_status public.report_status DEFAULT 'open'::public.report_status, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, target_type text, target_id uuid, reason text, status public.report_status, created_at timestamp with time zone, reporter_name text, author_id uuid, author_name text, content text, already_hidden boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_staff() then
    return;
  end if;

  return query
  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    rp.display_name,
    -- Quién escribió lo reportado, para poder ir a su perfil y ver si es la
    -- tercera vez esta semana.
    coalesce(po.author_id, c.author_id, m.sender_id, t.user_id, i.intercessor_id),
    coalesce(pa.display_name, ca.display_name, ma.display_name,
             ta.display_name, ia.display_name),
    -- El texto. Una intercesión reportada es su mensaje: el gesto en sí no se
    -- reporta, se reporta lo que alguien escribió con él.
    coalesce(po.body, c.body, m.body, t.body, i.message),
    coalesce(po.hidden_at, c.hidden_at, m.hidden_at) is not null
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id
  left join public.posts po on po.id = r.target_id and r.target_type = 'post'
  left join public.profiles pa on pa.id = po.author_id
  left join public.comments c on c.id = r.target_id and r.target_type = 'comment'
  left join public.profiles ca on ca.id = c.author_id
  left join public.messages m on m.id = r.target_id and r.target_type = 'message'
  left join public.profiles ma on ma.id = m.sender_id
  left join public.testimonies t on t.id = r.target_id and r.target_type = 'testimony'
  left join public.profiles ta on ta.id = t.user_id
  left join public.intercessions i on i.id = r.target_id and r.target_type = 'intercession'
  left join public.profiles ia on ia.id = i.intercessor_id
  where r.status = p_status
    and (((p_before is null and p_before_id is null) or (r.created_at, r.id) < (p_before, p_before_id)))
  order by r.created_at desc, r.id desc
  limit greatest(least(p_limit, 50), 1);
end;
$function$;

revoke execute on function public.report_queue_page(p_status public.report_status, p_before timestamp with time zone, p_limit integer, p_before_id uuid) from public;

grant execute on function public.report_queue_page(p_status public.report_status, p_before timestamp with time zone, p_limit integer, p_before_id uuid) to authenticated;

CREATE FUNCTION public.visible_testimonies_page(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, body text, visibility text, created_at timestamp with time zone, author_id uuid, author_name text, author_avatar_url text, plan_title text, is_mine boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    t.id,
    t.body,
    t.visibility::text,
    t.created_at,
    t.user_id,
    pr.display_name,
    pr.avatar_url,
    p.title,
    t.user_id = (select auth.uid())
  from public.testimonies t
  join public.profiles pr on pr.id = t.user_id
  left join public.prayer_plans p on p.id = t.plan_id
  where ((p_before is null and p_before_id is null) or (t.created_at, t.id) < (p_before, p_before_id))
  order by t.created_at desc, t.id desc
  limit greatest(least(p_limit, 100), 1);
$function$;

revoke execute on function public.visible_testimonies_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid) from public;

grant execute on function public.visible_testimonies_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

