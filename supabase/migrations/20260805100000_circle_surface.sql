-- Ammen — tres huecos que se notan a diario.
--
-- 1. Un plan de 30 días no parece que continúe: los días futuros están ocultos
--    por policy, así que la pantalla de historial acaba en el de hoy y no hay
--    nada que diga que queda camino. `plan.locked` —"Este día se abre el
--    {{date}}"— lleva traducido en los dos idiomas desde la primera semana sin
--    que nada lo pinte.
-- 2. No hay forma de saber si alguien ha escrito en el chat del círculo sin
--    entrar a mirar.
-- 3. Desde dentro de un círculo no se ve qué se comparte con él. La consulta
--    inversa —`usePlanCircles`— está indexada por plan; círculo→planes no
--    existía en todo el proyecto.

-- ---------------------------------------------------------------------------
-- Que se vea que el plan continúa
-- ---------------------------------------------------------------------------

-- Los días futuros siguen sin poder leerse: esta función devuelve su número y
-- su fecha, y **nada más**. Ver que el día 12 se abre el jueves es lo que hace
-- que un plan se sienta como un camino; ver su contenido sería saltarse el
-- mecanismo entero.
-- Soltada y recreada, no reemplazada: el tipo de retorno gana columnas, y
-- `create or replace` no puede cambiar una firma.
drop function public.my_plan_days(uuid);

create function public.my_plan_days(p_plan_id uuid)
returns table (
  id uuid,
  day_number smallint,
  title text,
  scripture_ref text,
  prayed boolean,
  unlock_date date,
  unlocked boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when d.unlock_date <= public.local_today(p.owner_id) then d.id end,
    d.day_number,
    -- El título de un día que aún no toca es contenido: se queda fuera.
    case when d.unlock_date <= public.local_today(p.owner_id) then d.title end,
    case when d.unlock_date <= public.local_today(p.owner_id)
         then d.scripture_ref end,
    exists (
      select 1 from public.prayer_logs l
      where l.plan_day_id = d.id and l.user_id = (select auth.uid())
    ),
    d.unlock_date,
    d.unlock_date <= public.local_today(p.owner_id)
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.plan_id = p_plan_id
    and p.owner_id = (select auth.uid())
  order by d.day_number desc;
$$;

revoke execute on function public.my_plan_days(uuid) from public;
grant execute on function public.my_plan_days(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Mensajes sin leer
-- ---------------------------------------------------------------------------

-- La membresía del chat se *deriva* de la del círculo desde el bloque D, así
-- que la mayoría de la gente no tiene fila en `conversation_members`. La marca
-- de lectura la crea esta función cuando hace falta: la fila pasa a ser solo
-- eso, una marca, y no una segunda fuente de verdad sobre quién pertenece.
create function public.mark_conversation_read(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_conversation uuid;
begin
  select c.id into v_conversation
  from public.conversations c
  where c.group_id = p_group_id;

  if v_conversation is null or not public.is_group_member(p_group_id) then
    return;
  end if;

  insert into public.conversation_members (conversation_id, user_id, last_read_at)
  values (v_conversation, v_user, now())
  on conflict (conversation_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke execute on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Cuántos mensajes sin leer hay en cada círculo, en una sola consulta: la
-- pestaña necesita el total y cada fila de la lista necesita el suyo.
--
-- Cuenta lo mismo que se puede leer: nada tuyo, nada oculto por quien modera,
-- y nada de alguien a quien has bloqueado. Un punto rojo por un mensaje que la
-- pantalla no va a enseñar es un punto rojo que no se puede quitar.
create function public.my_unread_counts()
returns table (group_id uuid, unread integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.group_id,
    count(m.id)::integer
  from public.conversations c
  join public.group_members gm
    on gm.group_id = c.group_id and gm.user_id = (select auth.uid())
  left join public.conversation_members cm
    on cm.conversation_id = c.id and cm.user_id = (select auth.uid())
  left join public.messages m
    on m.conversation_id = c.id
   and m.sender_id <> (select auth.uid())
   and m.hidden_at is null
   and not exists (
     select 1 from public.blocks b
     where b.blocker_id = (select auth.uid())
       and b.blocked_id = m.sender_id
   )
   -- Sin marca de lectura, todo lo que no es tuyo está sin leer: es la primera
   -- vez que abres ese chat.
   and (cm.last_read_at is null or m.created_at > cm.last_read_at)
  where c.group_id is not null
  group by c.group_id;
$$;

revoke execute on function public.my_unread_counts() from public;
grant execute on function public.my_unread_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- Qué se comparte con este círculo
-- ---------------------------------------------------------------------------

-- Desde dentro de un círculo no se veía nada de lo que pasa en él. Devuelve
-- también los tuyos, marcados: saber que estás compartiendo el tuyo ahí importa
-- tanto como ver los de los demás.
create function public.circle_shared_plans(p_group_id uuid)
returns table (
  plan_id uuid,
  plan_title text,
  owner_id uuid,
  owner_name text,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.title,
    p.owner_id,
    pr.display_name,
    p.owner_id = (select auth.uid())
  from public.plan_shares s
  join public.prayer_plans p on p.id = s.plan_id
  join public.profiles pr on pr.id = p.owner_id
  where s.group_id = p_group_id
    and p.status = 'active'
    and public.is_group_member(p_group_id)
    and not public.has_blocked(p.owner_id)
  order by (p.owner_id = (select auth.uid())) desc, pr.display_name;
$$;

revoke execute on function public.circle_shared_plans(uuid) from public;
grant execute on function public.circle_shared_plans(uuid) to authenticated;
