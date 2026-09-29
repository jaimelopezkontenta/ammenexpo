-- Reservation must use the same owner calendar as day unlocks.
-- Preserve ledger locks, quota, idempotency and the sharing contract.
create or replace function public.reserve_generation(
  p_request_id uuid,
  p_scope text,
  p_duration_days smallint,
  p_group_id uuid default null,
  p_visibility text default 'private',
  p_source_prompt jsonb default null,
  p_circle_ids uuid[] default null
)
returns table (
  ok boolean,
  reason text,
  plan_id uuid,
  reservation_id uuid,
  quota_used integer,
  quota_limit integer,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_limit constant integer := 3;
  v_used integer;
  v_existing public.generation_ledger;
  v_plan public.prayer_plans;
  v_reservation_id uuid;
  v_visibility public.plan_visibility;
  v_circle uuid;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_scope not in ('personal', 'circle') then
    raise exception 'reserve_generation: unknown scope %', p_scope;
  end if;

  -- Serializa las reservas de ESTE usuario ANTES de mirar nada: así la
  -- idempotencia y el conteo de cuota no pueden correr.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  -- Idempotencia DENTRO del lock y acotada al dueño: un caller nunca lee el
  -- plan ajeno adivinando un request_id.
  select * into v_existing
    from public.generation_ledger
   where request_id = p_request_id
     and user_id = v_user
     and scope in ('personal', 'circle');
  if found then
    select count(*) into v_used
      from public.generation_ledger
     where user_id = v_user
       and scope in ('personal', 'circle');

    return query
      select true, 'ok', v_existing.plan_id, v_existing.id, v_used, v_limit, false;
    return;
  end if;

  -- Un request_id que YA usó otro usuario: rechazo limpio, no un UNIQUE
  -- violation convertido en 500.
  if exists (
    select 1 from public.generation_ledger where request_id = p_request_id
  ) then
    return query
      select false, 'request_id_conflict', null::uuid, null::uuid, 0, v_limit, false;
    return;
  end if;

  -- Revalidación server-side de la duración: nunca se fía del cliente.
  if p_duration_days < 3 or p_duration_days > 30 then
    return query
      select false, 'invalid_duration', null::uuid, null::uuid, 0, v_limit, false;
    return;
  end if;

  -- Un plan de círculo: el dueño debe administrarlo y no puede haber ya un
  -- plan activo en él.
  if p_scope = 'circle' then
    if p_group_id is null or not public.can_create_circle_plan(p_group_id) then
      return query
        select false, 'circle_not_allowed', null::uuid, null::uuid, 0, v_limit, false;
      return;
    end if;
    v_visibility := 'group'::public.plan_visibility;
  else
    v_visibility := case p_visibility
      when 'link' then 'link'::public.plan_visibility
      when 'public' then 'public'::public.plan_visibility
      else 'private'::public.plan_visibility
    end;
  end if;

  -- Validar los círculos a compartir ANTES de gastar cuota: un id inválido
  -- revierte la reserva entera (sin plan, sin fila de ledger).
  if p_scope = 'personal' and p_circle_ids is not null then
    foreach v_circle in array p_circle_ids loop
      if v_circle is null or not public.is_group_member(v_circle) then
        return query
          select false, 'invalid_circles', null::uuid, null::uuid, 0, v_limit, false;
        return;
      end if;
    end loop;
  end if;

  select count(*) into v_used
    from public.generation_ledger
   where user_id = v_user
     and scope in ('personal', 'circle');

  if v_used >= v_limit then
    return query
      select false, 'quota_exhausted', null::uuid, null::uuid, v_used, v_limit, false;
    return;
  end if;

  -- Plan + reserva + shares nacen en la MISMA transacción: no hay ventana entre
  -- "consumí la cuota" y "existe el plan", ni entre "existe el plan" y "está
  -- compartido con los círculos elegidos".
  insert into public.prayer_plans (
    owner_id, title, duration_days, start_date, visibility, group_id,
    status, generated_by, source_prompt
  )
  values (
    v_user, '…', p_duration_days, public.local_today(v_user), v_visibility,
    case when p_scope = 'circle' then p_group_id else null end,
    'generating', 'ai', p_source_prompt
  )
  returning * into v_plan;

  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, group_id, duration_days, status
  )
  values (
    p_request_id, v_user, p_scope, v_plan.id,
    case when p_scope = 'circle' then p_group_id else null end,
    p_duration_days, 'reserved'
  )
  returning id into v_reservation_id;

  if p_scope = 'personal' and p_circle_ids is not null then
    insert into public.plan_shares (plan_id, group_id, created_by)
    select v_plan.id, c, v_user from unnest(p_circle_ids) c;
  end if;

  return query
    select true, 'ok', v_plan.id, v_reservation_id, v_used + 1, v_limit, true;
end;
$$;

revoke execute on function public.reserve_generation(uuid, text, smallint, uuid, text, jsonb, uuid[])
  from public;

grant execute on function public.reserve_generation(uuid, text, smallint, uuid, text, jsonb, uuid[])
  to authenticated;

