-- Ammen — flags server-side: apagar y encender superficies sin redeploy.
--
-- **El agujero.** La superficie comunitaria (`home_feed`) se servía siempre,
-- sin interruptor. El único kill-switch de la app era `PUSH_SENDER_ENABLED`
-- por variable de entorno del sender; no había forma de cerrar una pantalla
-- desde fuera del código sin tocar la UI — y desactivar desde la UI es
-- desactivar en el cliente, que cachea y es opaco.
--
-- **El modelo.** Una tabla de flags con su razón de ser y quién la posee, una
-- auditoría append-only (sin FK, sin policies, exactamente igual que
-- `staff_admin_events`), una lectura fail-closed (`flag_enabled`) y una única
-- RPC de escritura que solo acepta `service_role` o una cuenta staff
-- (`is_staff()`). El registro vive en la tabla, no en un fichero; este
-- comentario y `docs/plan-producto-operativo-2026-08.md` §9 describen el
-- mecanismo y no replican la lista.
--
-- **Fail-closed.** `flag_enabled` devuelve `false` para cualquier clave que no
-- tenga fila — un flag ausente o mal escrito nunca abre una superficie, y un
-- flag recién registrado nace OFF hasta que alguien lo encienda.
--
-- **El flag de comunidad.** `community_feed` nace OFF: en una instalación
-- limpia/remota la comunidad no se sirve sola — hay que decidir abrirla desde
-- el canal administrativo. El seed local lo enciende explícitamente para
-- conservar el contrato B2 que las suites de `db:test` llevan probando desde
-- `20260810100200_community.sql`.
--
-- Lo que NO va aquí: ni la medición de efecto (RDY-09), ni flags por cohorte,
-- ni un mecanismo de rollout incremental. Es un interruptor on/off con
-- auditoría, y punto.

-- ---------------------------------------------------------------------------
-- El registro de flags
-- ---------------------------------------------------------------------------

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  owner text not null check (char_length(btrim(owner)) > 0),
  reason text not null check (char_length(btrim(reason)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

-- Solo la lee quien opera la base (service_role) o las funciones definer
-- de abajo. El cliente ni por asomo — las políticas de SELECT no tienen
-- una cláusula que pueda filtrar: revocar todo al cliente es la regla.
revoke all on public.feature_flags from anon, authenticated, service_role;
grant select on public.feature_flags to service_role;

-- ---------------------------------------------------------------------------
-- Auditoría append-only: quién, qué, cuándo y por qué
-- ---------------------------------------------------------------------------

create table public.feature_flag_events (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null,
  action text not null check (action in ('enable', 'disable')),
  actor text not null check (char_length(btrim(actor)) > 0),
  reason text not null check (char_length(btrim(reason)) > 0),
  created_at timestamptz not null default now()
);

alter table public.feature_flag_events enable row level security;

-- Misma regla que `staff_admin_events`: no se borra, no se reescribe, solo
-- la lee quien opera.
revoke all on public.feature_flag_events from anon, authenticated, service_role;
grant select on public.feature_flag_events to service_role;

-- ---------------------------------------------------------------------------
-- Lectura segura: fail-closed para cualquier flag desconocido o ausente
-- ---------------------------------------------------------------------------

create function public.flag_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select f.enabled from public.feature_flags f where f.key = p_key),
    false
  );
$$;

-- La leen tanto el servidor (`home_feed`, security invoker, necesita
-- EXECUTE como authenticated) como quien opera (service_role).
revoke execute on function public.flag_enabled(text) from public;
grant execute on function public.flag_enabled(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Escritura: solo service_role o staff, con actor y motivo, y auditado
-- ---------------------------------------------------------------------------

create function public.admin_set_flag(
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
  -- El canal administrativo (service_role) no trae `sub` en el JWT, así que
  -- `auth.uid()` es nulo. Un usuario autenticado necesita además el bit de
  -- staff. anon no puede ejecutar (sin grant), así que el nulo es seguro.
  if (select auth.uid()) is not null and not public.is_staff() then
    raise exception 'admin_set_flag requires staff or the service role';
  end if;

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

revoke execute on function public.admin_set_flag(text, boolean, text, text)
  from public;
grant execute on function public.admin_set_flag(text, boolean, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- El primer flag: la comunidad
-- ---------------------------------------------------------------------------

insert into public.feature_flags (key, enabled, owner, reason)
values (
  'community_feed',
  false,
  'producto',
  'La superficie comunitaria (home_feed). OFF por defecto en instalaciones limpias/remotas: la comunidad se abre con una decisión explícita desde el canal administrativo, no sola.'
);

-- ---------------------------------------------------------------------------
-- Enforcement en home_feed: OFF ⇒ conjunto vacío, sin filtrar datos
-- ---------------------------------------------------------------------------
--
-- La función pasa de `language sql` a `language plpgsql` para hacer un
-- early-return antes de leer nada — el mismo patrón que `report_queue` y
-- `held_content_queue` usan para la comprobación de staff. Las columnas de
-- retorno, los CTE y el orden son los mismos que en
-- `20260822100000_crisis_separation.sql`; lo único que cambia es la guarda
-- de arriba y el envoltorio plpgsql.

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
      p.comment_count,
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

revoke execute on function public.home_feed(timestamptz, integer) from public;
grant execute on function public.home_feed(timestamptz, integer) to authenticated;