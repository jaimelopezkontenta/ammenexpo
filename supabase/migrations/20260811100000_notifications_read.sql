-- Ammen — los avisos, que llevaban meses acumulándose sin que nadie los leyera.
--
-- `notifications` tiene tabla, trigger, índice de deduplicación y publicación de
-- Realtime desde la Fase 1, y se escribe una fila **cada vez que alguien ora por
-- ti**. Nunca se ha leído ninguna. `read_at` no lo escribe nadie. Las cinco
-- cadenas `notifications.*` llevan traducidas en los dos idiomas esperando.
--
-- Esto no necesita push: los datos ya están dentro.

-- El aviso lleva el nombre de quien oró **dentro del payload**, y la policy de
-- la tabla decide por `user_id` y no sabe nada de bloqueos. Sin este filtro,
-- bloquear a alguien silenciaría su mensaje en la pantalla de Hoy y su cara en
-- el chat, y su nombre seguiría apareciendo aquí. La regla vive en la RPC para
-- que ninguna pantalla tenga que acordarse.
create function public.my_notifications(p_limit integer default 50)
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
  order by n.created_at desc
  limit greatest(least(p_limit, 100), 1);
$$;

revoke execute on function public.my_notifications(integer) from public;
grant execute on function public.my_notifications(integer) to authenticated;

-- Cuántos sin leer, para el punto de la cabecera. Cuenta **lo mismo que la
-- pantalla va a enseñar**: un punto rojo por un aviso de alguien bloqueado
-- sería un punto que no hay forma de quitar.
create function public.my_unread_notifications()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications n
  where n.user_id = (select auth.uid())
    and n.read_at is null
    and not public.has_blocked((n.payload ->> 'intercessor_id')::uuid);
$$;

revoke execute on function public.my_unread_notifications() from public;
grant execute on function public.my_unread_notifications() to authenticated;

-- Marcar leído es idempotente a propósito: se llama al abrir la pantalla, y
-- abrirla dos veces no puede ser un error. Devuelve cuántos cambió para que el
-- cliente sepa si merece la pena invalidar nada.
create function public.mark_notifications_read()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid())
     and read_at is null;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke execute on function public.mark_notifications_read() from public;
grant execute on function public.mark_notifications_read() to authenticated;
