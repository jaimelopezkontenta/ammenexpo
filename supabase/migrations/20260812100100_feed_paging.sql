-- Ammen — que las listas no se acaben en la fila 30.
--
-- `home_feed` acepta `p_before` desde que existe y **el cliente nunca lo
-- pasaba**; `prayer_feed` igual; los avisos y los testimonios ni siquiera lo
-- ofrecían. Techo de 30 filas y hasta ahí: a los dos meses de uso, lo de hace
-- tres semanas es inalcanzable — y los avisos son la lista que más rápido crece,
-- porque escribe una fila por persona y día.
--
-- Cursor y no `offset`: con `offset`, una fila nueva escrita entre dos páginas
-- desplaza todo y repites o te saltas contenido. El cursor es la fecha de la
-- última fila que ya tienes, así que lo que llegue nuevo aparece arriba y no
-- descoloca lo de abajo.

-- Las dos que ya lo tenían no se tocan. Estas dos cambian de firma, así que
-- drop, recreate y **volver a emitir el grant**.

drop function public.my_notifications(integer);

create function public.my_notifications(
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  type text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id, n.type, n.payload, n.read_at, n.created_at
  from public.notifications n
  where n.user_id = (select auth.uid())
    and not public.has_blocked((n.payload ->> 'intercessor_id')::uuid)
    and (p_before is null or n.created_at < p_before)
  order by n.created_at desc
  limit greatest(least(p_limit, 100), 1);
$$;

revoke execute on function public.my_notifications(timestamptz, integer) from public;
grant execute on function public.my_notifications(timestamptz, integer) to authenticated;

drop function public.visible_testimonies(integer);

create function public.visible_testimonies(
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  body text,
  visibility text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_avatar_url text,
  plan_title text,
  is_mine boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
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
  where p_before is null or t.created_at < p_before
  order by t.created_at desc
  limit greatest(least(p_limit, 100), 1);
$$;

revoke execute on function public.visible_testimonies(timestamptz, integer) from public;
grant execute on function public.visible_testimonies(timestamptz, integer) to authenticated;
