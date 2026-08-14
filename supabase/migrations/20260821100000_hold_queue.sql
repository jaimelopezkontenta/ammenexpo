-- Ammen — B1a: la cola de lo retenido, con dueño, liberar y retirar.
--
-- **El agujero.** `20260813100100_content_hold.sql` retiene automáticamente
-- (`held_at`) lo que coincide con el filtro. Retenido, y nada más: nadie lo
-- ve en una cola, no hay reclamar, no hay liberar ni retirar, y no queda
-- ningún rastro de quién decidió qué. Un falso positivo se queda retenido
-- para siempre y nadie —ni el autor, ni el equipo— tiene un botón para
-- sacarlo de ahí. La auditoría lo llama B1a: "no hay liberación visible".
--
-- **Esta migración no toca el filtro.** `is_objectionable()` e
-- `is_crisis_text()` (la migración siguiente separa crisis del resto) siguen
-- igual. Lo que se añade es lo que pasa *después* de que algo queda retenido:
-- una fila en `content_holds` por cada vez que algo entra en el estado
-- `held`, y tres RPC auditadas —`claim_hold`, `release_hold`, `remove_hold`—
-- para que una persona de staff pueda reclamarlo, liberarlo o retirarlo,
-- siempre con motivo y siempre con quién y cuándo.
--
-- **Por qué una tabla nueva y no solo columnas en `posts`/`comments`.** El
-- ciclo de vida de una decisión de moderación (pendiente → reclamado →
-- liberado/retirado, con actor, motivo y hora en cada paso) no es una
-- propiedad del post, es un evento sobre el post — y el mismo contenido
-- puede pasar por este ciclo más de una vez si se edita y vuelve a coincidir
-- con el filtro. Igual que `staff_admin_events` en 20260819100000: el
-- historial no se sobrescribe encima de la fila que decide, se acumula al
-- lado de ella.

create table public.content_holds (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  -- Denormalizado a propósito: la cola necesita el autor para poder
  -- enlazar a su perfil sin otro join condicional por tipo, el mismo patrón
  -- que ya usa `report_queue`.
  author_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'released', 'removed')),
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

create index content_holds_queue_idx
  on public.content_holds (status, created_at);

create index content_holds_target_idx
  on public.content_holds (target_type, target_id);

alter table public.content_holds enable row level security;

-- Sin policies y sin grant al cliente: se lee y se escribe únicamente a
-- través de las RPC de abajo, que comprueban `is_staff()` ellas mismas — el
-- mismo patrón que `report_queue`/`resolve_report`. Los DEFAULT PRIVILEGES
-- del entorno conceden DELETE/TRIGGER por sí solos a los tres roles de API
-- sobre cualquier tabla nueva; se revocan para que una cola de moderación no
-- herede un borrado que nadie concedió a mano.
revoke all on public.content_holds from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Encolar automáticamente cuando algo entra en `held`
-- ---------------------------------------------------------------------------
--
-- AFTER, no BEFORE: `hold_objectionable()` sigue siendo quien decide y
-- escribe `held_at` en la fila; este trigger solo mira lo que quedó escrito.
-- Dispara en INSERT siempre que nace retenido, y en UPDATE solo en la
-- transición real (`old.held_at is null`) — así que editar dos veces un texto
-- que sigue retenido no duplica la fila de cola.
create function public.enqueue_content_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.held_at is not null
     and (tg_op = 'INSERT' or old.held_at is null) then
    insert into public.content_holds (target_type, target_id, author_id)
    values (tg_argv[0], new.id, new.author_id);
  end if;

  return new;
end;
$$;

create trigger posts_enqueue_hold
  after insert or update of body on public.posts
  for each row execute function public.enqueue_content_hold('post');

create trigger comments_enqueue_hold
  after insert or update of body on public.comments
  for each row execute function public.enqueue_content_hold('comment');

-- ---------------------------------------------------------------------------
-- La cola: lo que ve quien modera
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER porque quien modera tiene que ver el texto retenido, que
-- las policies normales esconden de todo el mundo salvo su autor. La primera
-- línea es la comprobación de staff, y no hay ninguna rama que devuelva algo
-- antes — igual que `report_queue`.

create function public.held_content_queue(
  p_statuses text[] default array['pending', 'claimed'],
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
  status text,
  claimed_by uuid,
  claimed_by_name text,
  reason text,
  created_at timestamptz
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
    and (p_before is null or h.created_at < p_before)
  -- Más antiguo primero: es la cola de un SLA, no un muro social.
  order by h.created_at asc
  limit greatest(least(p_limit, 50), 1);
end;
$$;

revoke execute on function public.held_content_queue(text[], timestamptz, integer)
  from public;
grant execute on function public.held_content_queue(text[], timestamptz, integer)
  to authenticated;

create function public.open_hold_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff() then
      (select count(*)::integer from public.content_holds
        where status in ('pending', 'claimed'))
    else 0
  end;
$$;

revoke execute on function public.open_hold_count() from public;
grant execute on function public.open_hold_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Reclamar, liberar, retirar — cada una audita quién y por qué
-- ---------------------------------------------------------------------------

create function public.claim_hold(p_hold_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    return false;
  end if;

  update public.content_holds
     set status = 'claimed',
         claimed_by = (select auth.uid()),
         claimed_at = now()
   where id = p_hold_id
     and status = 'pending';

  return found;
end;
$$;

-- Libera: el falso positivo. `held_at` se limpia, así que vuelve a ser
-- visible para todo el mundo exactamente como si nunca hubiera coincidido
-- con el filtro.
create function public.release_hold(p_hold_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_type text;
  v_target_id uuid;
begin
  if not public.is_staff() then
    return false;
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'release_hold requires a reason';
  end if;

  select h.target_type, h.target_id into v_target_type, v_target_id
  from public.content_holds h
  where h.id = p_hold_id
    and h.status in ('pending', 'claimed');

  if v_target_id is null then
    return false;
  end if;

  update public.content_holds
     set status = 'released',
         resolved_by = (select auth.uid()),
         resolved_at = now(),
         reason = btrim(p_reason)
   where id = p_hold_id;

  if v_target_type = 'post' then
    update public.posts set held_at = null where id = v_target_id;
  else
    update public.comments set held_at = null where id = v_target_id;
  end if;

  return true;
end;
$$;

-- Retira: lo abusivo. A propósito **no** limpia `held_at` — la fila sigue
-- leyéndose "en revisión" para su propio autor en vez de volver a parecer un
-- envío normal y corriente, que sería el mensaje equivocado — y además pone
-- `hidden_at`, el mismo campo que ya usa el resto de moderación, así que
-- terceros no la ven bajo ninguna de las dos condiciones de la policy.
create function public.remove_hold(p_hold_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_type text;
  v_target_id uuid;
begin
  if not public.is_staff() then
    return false;
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'remove_hold requires a reason';
  end if;

  select h.target_type, h.target_id into v_target_type, v_target_id
  from public.content_holds h
  where h.id = p_hold_id
    and h.status in ('pending', 'claimed');

  if v_target_id is null then
    return false;
  end if;

  update public.content_holds
     set status = 'removed',
         resolved_by = (select auth.uid()),
         resolved_at = now(),
         reason = btrim(p_reason)
   where id = p_hold_id;

  if v_target_type = 'post' then
    update public.posts
       set hidden_at = now(), hidden_by = (select auth.uid())
     where id = v_target_id;
  else
    update public.comments
       set hidden_at = now(), hidden_by = (select auth.uid())
     where id = v_target_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.claim_hold(uuid) from public;
revoke execute on function public.release_hold(uuid, text) from public;
revoke execute on function public.remove_hold(uuid, text) from public;
grant execute on function public.claim_hold(uuid) to authenticated;
grant execute on function public.release_hold(uuid, text) to authenticated;
grant execute on function public.remove_hold(uuid, text) to authenticated;
