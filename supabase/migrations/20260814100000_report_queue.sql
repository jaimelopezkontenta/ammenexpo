-- Ammen — poder leer los reportes.
--
-- `reports` lleva desde la Fase 1 siendo **de solo escritura**: la policy deja
-- ver los tuyos y nada más, así que se podía reportar y nadie —literalmente
-- nadie— podía leer un reporte. La Guideline 1.2 exige actuar sobre uno en 24
-- horas; sin esto no hay ni forma de saber que existe.
--
-- **El bit de staff se pone a mano en la base.** No hay pantalla para nombrar a
-- alguien staff, ni RPC: eso sería una escalada de privilegios esperando a que
-- alguien se equivoque en una policy. Se hace con un `update` y se sabe quién lo
-- hizo.

alter table public.profiles
  add column is_staff boolean not null default false;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_staff from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- La cola
-- ---------------------------------------------------------------------------
--
-- Devuelve **el contenido reportado dentro de la fila**. Si para saber qué se
-- reportó hubiera que ir a buscarlo a otra pantalla con el id en la mano, nadie
-- revisaría nada, y una cola que no se revisa es peor que ninguna porque parece
-- que sí.
--
-- SECURITY DEFINER a propósito: quien modera tiene que ver justamente lo que las
-- policies esconden — lo oculto, lo retenido y lo de círculos a los que no
-- pertenece. Por eso la primera línea del cuerpo es la comprobación de staff, y
-- por eso no hay ninguna rama que devuelva algo antes de ella.

create function public.report_queue(
  p_status public.report_status default 'open',
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  status public.report_status,
  created_at timestamptz,
  reporter_name text,
  author_id uuid,
  author_name text,
  content text,
  already_hidden boolean
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
    and (p_before is null or r.created_at < p_before)
  order by r.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;

revoke execute on function public.report_queue(public.report_status, timestamptz, integer) from public;
grant execute on function public.report_queue(public.report_status, timestamptz, integer) to authenticated;

-- Cerrar uno. `report_status` tiene los tres estados desde la Fase 1 y no se ha
-- usado ninguno: todos los reportes del proyecto siguen en 'open'.
create function public.resolve_report(
  p_report_id uuid,
  p_status public.report_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    return false;
  end if;

  if p_status = 'open' then
    raise exception 'a report is closed as reviewed or dismissed, not reopened';
  end if;

  update public.reports
     set status = p_status
   where id = p_report_id;

  -- `found` en vez de devolver true a secas: cerrar un id que no existe tiene
  -- que poder distinguirse de cerrarlo de verdad.
  return found;
end;
$$;

revoke execute on function public.resolve_report(uuid, public.report_status) from public;
grant execute on function public.resolve_report(uuid, public.report_status) to authenticated;

-- Cuántos quedan sin revisar, para que la entrada del perfil pueda decirlo. Sin
-- número, entrar a mirar es un acto de fe y la cola se queda sin abrir.
create function public.open_report_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff() then
      (select count(*)::integer from public.reports where status = 'open')
    else 0
  end;
$$;

revoke execute on function public.open_report_count() from public;
grant execute on function public.open_report_count() to authenticated;
