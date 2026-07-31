-- Ammen — peticiones de oración: en el círculo, y en un muro abierto.
--
-- `posts`, `post_prayers` y `comments` existen desde la Fase 1 con RLS,
-- policies, contadores por trigger y GRANT completos, y **ninguna pantalla**.
-- Es lo que la gente hace de verdad en un grupo de oración —"oren por la
-- operación de mi madre mañana"— y hasta ahora solo cabía en el chat, donde se
-- pierde hacia arriba y donde no hay forma de decir "yo también oré".
--
-- El muro público es una decisión con consecuencias: son datos sensibles
-- delante de desconocidos. Lo que trae este archivo es que las herramientas que
-- ya existen —bloquear, reportar, ocultar— alcancen aquí, en vez de inventar
-- una moderación nueva que habría que aprender por separado.

-- ---------------------------------------------------------------------------
-- Bloquear alcanza al muro
-- ---------------------------------------------------------------------------

-- Sin esto, bloquear a alguien lo callaba en el chat, en la pestaña Orar y en
-- los testimonios, y lo dejaba intacto en la superficie más pública que tiene
-- la app. Se resuelve en la policy para que ninguna pantalla tenga que
-- acordarse.
alter table public.posts
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profiles (id) on delete set null;

alter table public.comments
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profiles (id) on delete set null;

drop policy "posts readable in the global feed or by group members"
  on public.posts;

-- La rama del autor va primero y decide con columnas de la propia fila: es lo
-- que hace que `insert ... returning` funcione, la regla que este proyecto ya
-- ha pisado tres veces.
create policy "your own always, everyone else's if visible to you"
  on public.posts for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (
      hidden_at is null
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
      and not public.has_blocked(author_id)
      and public.can_read_post(post_id)
    )
  );

-- `can_read_post` decide si se puede *orar* y *comentar*, así que también tiene
-- que respetar el ocultado: dejar orar por algo que ya no se ve sería un
-- contador subiendo solo.
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
      and (p.group_id is null or public.is_group_member(p.group_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Ocultar
-- ---------------------------------------------------------------------------

-- Solo tiene sentido dentro de un círculo, que es donde hay alguien a cargo. En
-- el muro abierto no hay quien administre, así que lo que queda ahí es reportar
-- —se revisa fuera de la app— y bloquear, que retira a esa persona de todo.
--
-- Por RPC y no por UPDATE: con la policy de arriba, una fila oculta deja de ser
-- legible, así que un `update ... returning` devolvería cero filas — es decir,
-- un 204 sin error, la misma forma de fallo silencioso que ya apareció al
-- revocar un enlace.
create function public.hide_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  select p.group_id into v_group from public.posts p where p.id = p_post_id;

  if v_group is null or not public.is_group_admin(v_group) then
    return false;
  end if;

  update public.posts
     set hidden_at = now(), hidden_by = (select auth.uid())
   where id = p_post_id and hidden_at is null;

  return found;
end;
$$;

create function public.hide_comment(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  select p.group_id into v_group
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = p_comment_id;

  if v_group is null or not public.is_group_admin(v_group) then
    return false;
  end if;

  update public.comments
     set hidden_at = now(), hidden_by = (select auth.uid())
   where id = p_comment_id and hidden_at is null;

  return found;
end;
$$;

revoke execute on function public.hide_post(uuid) from public;
revoke execute on function public.hide_comment(uuid) from public;
grant execute on function public.hide_post(uuid) to authenticated;
grant execute on function public.hide_comment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Leer el muro
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER: las policies de arriba ya deciden qué se ve, y repetir esas
-- reglas aquí sería tener dos sitios donde equivocarse.
--
-- **El anonimato se aplica en la lista de columnas.** `author_id` no sale
-- tampoco: devolver el id de una petición anónima permitiría correlacionar dos
-- de la misma persona, que es exactamente lo que alguien quería evitar al
-- marcarla. La consecuencia hay que decirla: a quien publica en anónimo no se
-- le puede bloquear desde la pantalla, solo reportar.
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

revoke execute on function public.prayer_feed(uuid, timestamptz, integer)
  from public;
grant execute on function public.prayer_feed(uuid, timestamptz, integer)
  to authenticated;

create function public.post_comments(p_post_id uuid)
returns table (
  id uuid,
  body text,
  author_id uuid,
  author_name text,
  author_avatar_url text,
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
    c.created_at,
    c.author_id = (select auth.uid())
  from public.comments c
  join public.profiles pr on pr.id = c.author_id
  where c.post_id = p_post_id
  order by c.created_at;
$$;

revoke execute on function public.post_comments(uuid) from public;
grant execute on function public.post_comments(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reportarlas
-- ---------------------------------------------------------------------------

-- `reports.target_type` ya acepta 'post' y 'comment' desde la Fase 1: la
-- superficie estaba prevista y era lo único que faltaba usar.
