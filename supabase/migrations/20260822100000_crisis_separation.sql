-- Ammel — B1b: crisis dejar de ser un caso más del filtro genérico.
--
-- **El agujero, tal como lo deja `20260813100100_content_hold.sql`.** Las
-- frases de autolesión ('quiero matarme', 'kill yourself', 'i want to die'…)
-- viven en la misma lista que insultos y espam, y disparan exactamente el
-- mismo `held_at`: la persona que escribió "quiero matarme" recibe la misma
-- nota de "en revisión" que alguien que publicó un enlace de bitcoin gratis,
-- y entra en la misma cola que el spam, sin urgencia, sin recursos, sin
-- ningún camino de escalado. La auditoría lo llama B1b y lo marca crítico.
--
-- **Lo que separa esta migración.** Las frases de crisis salen de
-- `is_objectionable()` y pasan a `is_crisis_text()`, con su propia columna
-- (`crisis_flagged_at`, nunca `held_at` a solas) y su propia cola
-- (`crisis_escalations`, nunca mezclada con `content_holds`). El texto se
-- sigue ocultando igual que un hold normal —nadie más lo ve—, pero el camino
-- de vuelta no es "un moderador lo revisará cuando le toque": es que el
-- cliente, al recibir la fila de vuelta de un insert con
-- `crisis_flagged_at` puesto, muestra recursos inmediatos en el momento,
-- **no como resultado de dar a Recargar en una pantalla de moderación.**
--
-- **Lo que esta migración NO hace, y por qué queda así.** No hay
-- diagnóstico ni clasificación clínica: `is_crisis_text()` es un filtro de
-- frases, igual de tosco que `is_objectionable()`, y solo decide "mostrar
-- recursos ya", nunca "esta persona está en riesgo de X". No hay
-- intervención automática: la única acción del sistema es enseñar recursos y
-- dejar un registro para que una persona lo confirme. El protocolo real —qué
-- países, qué edades, qué SLA, qué texto exacto en los recursos— pide
-- especialista y no está aprobado; esta migración construye el mecanismo
-- para que, cuando lo esté, tenga dónde encajar. El plan es explícito en
-- esto: **beta puede abrir con este mínimo, público no.**

-- ---------------------------------------------------------------------------
-- El clasificador de crisis, separado del genérico
-- ---------------------------------------------------------------------------

create function public.is_crisis_text(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_clean text;
  v_term text;
  v_terms text[] := array[
    'te voy a matar', 'os voy a matar', 'ojala te mueras',
    'quiero matarme', 'me voy a matar', 'voy a suicidarme',
    'quiero suicidarme', 'no quiero seguir viviendo',
    'kill yourself', 'kys', 'i want to die', 'i want to kill myself',
    'i am going to kill myself', 'suicidal'
  ];
begin
  if p_text is null then
    return false;
  end if;

  v_clean := lower(public.immutable_unaccent(p_text));

  foreach v_term in array v_terms loop
    if v_clean ~ ('\m' || v_term || '\M') then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- El genérico pierde las frases de crisis: a partir de aquí solo decide
-- insulto, odio, sexual explícito y espam. Misma firma, `create or replace`.
create or replace function public.is_objectionable(p_text text)
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
    if v_clean ~ ('\m' || v_term || '\M') then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- La columna y el trigger de crisis, en paralelo al de `held_at`
-- ---------------------------------------------------------------------------

alter table public.posts add column crisis_flagged_at timestamptz;
alter table public.comments add column crisis_flagged_at timestamptz;

create function public.flag_crisis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_crisis_text(new.body) then
    new.crisis_flagged_at := now();
    -- Oculto para todo el mundo salvo su autor, con el mismo campo que ya
    -- decide eso en la policy — pero NUNCA se enseña como un hold genérico:
    -- el cliente distingue por `crisis_flagged_at`, no por `held_at`.
    new.held_at := now();
  end if;

  return new;
end;
$$;

create trigger posts_flag_crisis
  before insert or update of body on public.posts
  for each row execute function public.flag_crisis();

create trigger comments_flag_crisis
  before insert or update of body on public.comments
  for each row execute function public.flag_crisis();

-- La cola genérica deja fuera lo que ya es una escalada de crisis: mezclarlo
-- con espam retenido es exactamente lo que este ticket existe para deshacer.
create or replace function public.enqueue_content_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.held_at is not null
     and new.crisis_flagged_at is null
     and (tg_op = 'INSERT' or old.held_at is null) then
    insert into public.content_holds (target_type, target_id, author_id)
    values (tg_argv[0], new.id, new.author_id);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- La cola de crisis: separada, y con acuse de recibo humano
-- ---------------------------------------------------------------------------
--
-- Sin políticas ni grant al cliente, igual que `content_holds`: se llega
-- únicamente por las RPC de abajo. `acknowledged_by`/`acknowledged_at` son la
-- mitad de "escalado humano definido" que sí se puede construir sin
-- especialista — la mitad de "SLA ensayado con especialista" queda **fuera**
-- de esta migración porque no hay a quién ensayarlo con.

create table public.crisis_escalations (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  note text
);

create index crisis_escalations_open_idx
  on public.crisis_escalations (acknowledged_at, created_at);

alter table public.crisis_escalations enable row level security;
revoke all on public.crisis_escalations from anon, authenticated, service_role;

create function public.enqueue_crisis_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.crisis_flagged_at is not null
     and (tg_op = 'INSERT' or old.crisis_flagged_at is null) then
    insert into public.crisis_escalations (target_type, target_id, author_id)
    values (tg_argv[0], new.id, new.author_id);
  end if;

  return new;
end;
$$;

create trigger posts_enqueue_crisis
  after insert or update of body on public.posts
  for each row execute function public.enqueue_crisis_escalation('post');

create trigger comments_enqueue_crisis
  after insert or update of body on public.comments
  for each row execute function public.enqueue_crisis_escalation('comment');

-- Quién tiene guardia ve las escaladas sin acuse, ordenadas por antigüedad —
-- nunca junto al texto en un listado que viaje fuera de este RPC. Devuelve el
-- cuerpo porque quien responde tiene que leer qué se escribió para poder
-- ayudar: es la misma razón por la que `report_queue`/`held_content_queue`
-- devuelven el contenido a quien modera. La regla del plan sobre "sin texto
-- de crisis en claro" es para la EVIDENCIA que se conserva o se comparte
-- (capturas, logs, tickets) — no para la pantalla operativa donde alguien
-- decide si hace falta llamar a alguien.
create function public.crisis_queue(
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  author_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  acknowledged_by uuid,
  acknowledged_by_name text,
  acknowledged_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    return;
  end if;

  return query
  select
    e.id,
    e.target_type,
    e.target_id,
    e.author_id,
    pr.display_name,
    coalesce(po.body, c.body),
    e.created_at,
    e.acknowledged_by,
    apr.display_name,
    e.acknowledged_at
  from public.crisis_escalations e
  join public.profiles pr on pr.id = e.author_id
  left join public.profiles apr on apr.id = e.acknowledged_by
  left join public.posts po on po.id = e.target_id and e.target_type = 'post'
  left join public.comments c on c.id = e.target_id and e.target_type = 'comment'
  where p_before is null or e.created_at < p_before
  order by e.acknowledged_at is not null, e.created_at asc
  limit greatest(least(p_limit, 50), 1);
end;
$$;

revoke execute on function public.crisis_queue(timestamptz, integer) from public;
grant execute on function public.crisis_queue(timestamptz, integer) to authenticated;

create function public.open_crisis_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff() then
      (select count(*)::integer from public.crisis_escalations
        where acknowledged_at is null)
    else 0
  end;
$$;

revoke execute on function public.open_crisis_count() from public;
grant execute on function public.open_crisis_count() to authenticated;

create function public.acknowledge_crisis(p_id uuid, p_note text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    return false;
  end if;

  if p_note is null or char_length(btrim(p_note)) = 0 then
    raise exception 'acknowledge_crisis requires a note';
  end if;

  update public.crisis_escalations
     set acknowledged_by = (select auth.uid()),
         acknowledged_at = now(),
         note = btrim(p_note)
   where id = p_id
     and acknowledged_at is null;

  return found;
end;
$$;

revoke execute on function public.acknowledge_crisis(uuid, text) from public;
grant execute on function public.acknowledge_crisis(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Las tres RPC que ya devolvían `held_at` también devuelven `crisis_flagged_at`
-- ---------------------------------------------------------------------------
--
-- El cliente necesita distinguir "el filtro genérico lo retuvo" de "esto es
-- una escalada de crisis" para decidir si enseña la nota de "en revisión" o
-- los recursos inmediatos — la respuesta de `insert ... select()` es de dónde
-- lo lee justo después de escribir, sin esperar a la siguiente carga del muro.

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
  crisis_flagged_at timestamptz,
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
    c.crisis_flagged_at,
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
  crisis_flagged_at timestamptz,
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

