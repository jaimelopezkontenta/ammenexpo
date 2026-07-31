-- Ammen — Bloque D, segunda parte: el chat del círculo, con moderación.
--
-- `conversations`, `conversation_members` y `messages` llevan desde la Fase 1
-- con RLS, políticas y grants completos, y sin un solo escritor. Este es el
-- primer consumidor — y también el primero de la publicación de Realtime, que
-- incluye siete tablas a las que nadie se ha suscrito nunca.
--
-- La moderación va aquí y no en un commit posterior porque el bloque anterior
-- abrió los círculos públicos a desconocidos. Un chat sin forma de bloquear,
-- reportar ni expulsar, en una app donde la gente escribe por qué necesita que
-- oren por ella, no es una versión temprana: es un daño con fecha.

-- ---------------------------------------------------------------------------
-- La membresía del chat es la membresía del círculo
-- ---------------------------------------------------------------------------

-- `conversation_members` obligaría a escribir una fila al entrar en un círculo
-- y a borrarla al salir, en cuatro caminos distintos (unirse, canjear un
-- enlace, salir, ser expulsado). Dos fuentes de verdad que acaban discrepando,
-- y la forma en que discrepan es la peor posible: alguien expulsado del círculo
-- que sigue leyendo el chat.
--
-- Derivándola, expulsar cierra la puerta en el mismo instante y sin escribir
-- nada. La tabla se queda para las conversaciones que no son de un círculo.
create or replace function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = cid
      and cm.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.conversations c
    join public.group_members m on m.group_id = c.group_id
    where c.id = cid
      and m.user_id = (select auth.uid())
  );
$$;

-- Cada círculo tiene su chat desde que nace. Nada que crear a mano, ningún
-- camino en el que la pantalla exista y la conversación no.
create function public.handle_new_group_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversations (group_id, created_by)
  values (new.id, new.owner_id)
  on conflict (group_id) do nothing;
  return new;
end;
$$;

create trigger on_group_created_conversation
  after insert on public.groups
  for each row execute function public.handle_new_group_conversation();

insert into public.conversations (group_id, created_by)
select g.id, g.owner_id
from public.groups g
on conflict (group_id) do nothing;

-- ---------------------------------------------------------------------------
-- Bloquear a una persona
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- Una policy de SELECT que decide con las columnas de la propia fila, para que
-- `insert ... returning` funcione. Es la regla que ya costó depurar dos veces.
create policy "you read your own blocks"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "you block on your own behalf"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "you unblock what you blocked"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- Los GRANT son una capa distinta de RLS: sin esto el error sería "permission
-- denied for table blocks", que no se parece en nada a un fallo de policy.
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;

-- Definer para que la comprobación no dependa de la policy de `blocks` dentro
-- de otras policies, y para poder usarla desde funciones de terceros.
create function public.has_blocked(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where b.blocker_id = (select auth.uid())
      and b.blocked_id = p_user_id
  );
$$;

revoke execute on function public.has_blocked(uuid) from public;
grant execute on function public.has_blocked(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Mensajes ocultos
-- ---------------------------------------------------------------------------

alter table public.messages
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profiles (id) on delete set null;

-- Bloquear es personal y silencioso: quien bloquea deja de ver, y a quien
-- bloquean no se le avisa ni se le expulsa de nada. Ocultar es del círculo:
-- lo hace quien lo administra y vale para todos.
drop policy "members read the messages" on public.messages;

create policy "members read the messages"
  on public.messages for select
  to authenticated
  using (
    public.is_conversation_member(conversation_id)
    and hidden_at is null
    and not public.has_blocked(sender_id)
  );

-- Ocultar por RPC y no por UPDATE: con la policy de arriba, una fila oculta
-- deja de ser legible, así que un `update ... returning` desde el cliente
-- devolvería cero filas — es decir, un 204 sin error, que es exactamente la
-- forma de fallo silencioso que ya apareció al revocar un enlace.
create function public.hide_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  select c.group_id into v_group
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = p_message_id;

  if v_group is null or not public.is_group_admin(v_group) then
    return false;
  end if;

  update public.messages
     set hidden_at = now(),
         hidden_by = (select auth.uid())
   where id = p_message_id
     and hidden_at is null;

  return found;
end;
$$;

revoke execute on function public.hide_message(uuid) from public;
grant execute on function public.hide_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Expulsar, y a quién no se puede expulsar
-- ---------------------------------------------------------------------------

-- La policy de DELETE ya dejaba a un admin borrar cualquier fila del censo,
-- incluida la de quien creó el círculo. Dos admins podían echarse el uno al
-- otro, y cualquiera de ellos dejar al dueño fuera de su propio círculo — sin
-- vuelta atrás, porque la policy de INSERT exige ser admin para readmitir.
create function public.protect_group_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select g.owner_id into v_owner
  from public.groups g
  where g.id = old.group_id;

  -- Salirse uno mismo sí se permite: es el dueño decidiendo, y el círculo
  -- sigue siendo suyo. Lo que no se permite es que lo eche otro.
  if old.user_id = v_owner and old.user_id <> (select auth.uid()) then
    raise exception 'cannot remove the circle owner';
  end if;

  return old;
end;
$$;

create trigger group_members_protect_owner
  before delete on public.group_members
  for each row execute function public.protect_group_owner();

-- ---------------------------------------------------------------------------
-- El chat, en una sola consulta
-- ---------------------------------------------------------------------------

create function public.circle_conversation(p_group_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id
  from public.conversations c
  where c.group_id = p_group_id
    and public.is_group_member(p_group_id);
$$;

revoke execute on function public.circle_conversation(uuid) from public;
grant execute on function public.circle_conversation(uuid) to authenticated;

-- Los mensajes con el nombre y el avatar de quien escribe. Se pagina hacia
-- atrás desde el final, que es como se lee un chat.
create function public.circle_messages(
  p_group_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  sender_avatar_url text,
  body text,
  created_at timestamptz,
  is_mine boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.sender_id,
    pr.display_name,
    pr.avatar_url,
    m.body,
    m.created_at,
    m.sender_id = (select auth.uid())
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.profiles pr on pr.id = m.sender_id
  where c.group_id = p_group_id
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit greatest(least(p_limit, 100), 1);
$$;

revoke execute on function public.circle_messages(uuid, timestamptz, integer)
  from public;
grant execute on function public.circle_messages(uuid, timestamptz, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Bloquear protege donde la app es más personal, no solo en el chat
-- ---------------------------------------------------------------------------

-- Si bloquear solo callara el chat, seguiría llegando quién oró por ti con su
-- mensaje, y su plan seguiría en la pestaña Orar. Bloquear tiene que significar
-- lo que la gente entiende que significa.
create or replace function public.who_prayed_for_me(p_since date default null)
returns table (
  intercession_id uuid,
  intercessor_id uuid,
  intercessor_name text,
  intercessor_avatar_url text,
  message text,
  day_number smallint,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with viewer as (
    select public.valid_timezone(ps.timezone) as tz
    from public.profile_settings ps
    where ps.id = (select auth.uid())
  )
  select
    i.id,
    i.intercessor_id,
    pr.display_name,
    pr.avatar_url,
    case when i.message_hidden_at is null then i.message end,
    d.day_number,
    i.created_at
  from public.intercessions i
  cross join viewer v
  join public.profiles pr on pr.id = i.intercessor_id
  join public.prayer_plan_days d on d.id = i.plan_day_id
  where i.plan_owner_id = (select auth.uid())
    and not public.has_blocked(i.intercessor_id)
    and (i.created_at at time zone v.tz)::date
        >= coalesce(p_since, (now() at time zone v.tz)::date)
  order by i.created_at desc;
$$;

drop function if exists public.plans_shared_with_me();

create function public.plans_shared_with_me()
returns table (
  plan_id uuid,
  plan_title text,
  owner_id uuid,
  owner_name text,
  owner_avatar_url text,
  day_id uuid,
  day_number smallint,
  day_title text,
  scripture_ref text,
  scripture_text text,
  intercessor_prayer text,
  already_prayed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from (
    select
      p.id as plan_id,
      p.title as plan_title,
      p.owner_id as owner_id,
      pr.display_name as owner_name,
      pr.avatar_url as owner_avatar_url,
      d.id as day_id,
      d.day_number as day_number,
      d.title as day_title,
      d.scripture_ref as scripture_ref,
      d.scripture_text as scripture_text,
      d.intercessor_prayer as intercessor_prayer,
      exists (
        select 1 from public.intercessions i
        where i.plan_day_id = d.id
          and i.intercessor_id = (select auth.uid())
      ) as already_prayed
    from public.prayer_plans p
    join public.profiles pr on pr.id = p.owner_id
    join lateral (
      select dd.id, dd.day_number, dd.title, dd.scripture_ref,
             dd.scripture_text, dd.intercessor_prayer
      from public.prayer_plan_days dd
      where dd.plan_id = p.id
      order by dd.day_number desc
      limit 1
    ) d on true
    where p.owner_id <> (select auth.uid())
      and p.status = 'active'
      and not public.has_blocked(p.owner_id)
  ) rows
  order by rows.already_prayed, rows.owner_name;
$$;

grant execute on function public.plans_shared_with_me() to authenticated;
