-- Ammen — Bloque D, lo que quedaba: el plan común del círculo y su racha.
--
-- `prayer_plans.group_id` existe desde la Fase 1 con su FK, su check
-- `prayer_plans_group_required`, su índice parcial, y está contemplado en
-- `can_read_plan` y en la policy de SELECT de `prayer_plans`. Nadie lo escribe
-- nunca. `group_prayer_days` tiene tabla, RLS con tres policies y GRANT, y cero
-- lecturas y cero escrituras en todo el repo. `groups.streak_count` y
-- `streak_last_day` devuelven 0 y null para siempre.
--
-- Esto los conecta.

-- ---------------------------------------------------------------------------
-- Un plan por círculo, y lo crea quien lo administra
-- ---------------------------------------------------------------------------

-- Sin esto, "un plan activo por círculo" sería una comprobación en la Edge
-- Function, es decir, una comprobación que dos peticiones a la vez se saltan.
create unique index prayer_plans_one_active_per_group
  on public.prayer_plans (group_id)
  where group_id is not null and status in ('generating', 'active');

create function public.can_create_circle_plan(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_group_admin(p_group_id)
    and not exists (
      select 1 from public.prayer_plans p
      where p.group_id = p_group_id
        and p.status in ('generating', 'active')
    );
$$;

revoke execute on function public.can_create_circle_plan(uuid) from public;
grant execute on function public.can_create_circle_plan(uuid) to authenticated;

-- El plan del círculo, para la pantalla del círculo. SECURITY DEFINER porque
-- `prayer_plans` es legible por los miembros pero la fila del día no lo es
-- hasta que se desbloquea, y aquí solo hacen falta la cabecera y el progreso.
create function public.circle_plan(p_group_id uuid)
returns table (
  plan_id uuid,
  title text,
  theme text,
  duration_days smallint,
  status text,
  day_id uuid,
  day_number smallint,
  day_title text,
  prayed_today boolean,
  prayed_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.title,
    p.theme,
    p.duration_days,
    p.status::text,
    d.id,
    d.day_number,
    d.title,
    exists (
      select 1 from public.group_prayer_days g
      where g.plan_day_id = d.id and g.user_id = (select auth.uid())
    ),
    (
      select count(*)::integer from public.group_prayer_days g
      where g.plan_day_id = d.id
    )
  from public.prayer_plans p
  left join lateral (
    select dd.id, dd.day_number, dd.title
    from public.prayer_plan_days dd
    where dd.plan_id = p.id
      and dd.unlock_date <= public.plan_today(p.id)
    order by dd.day_number desc
    limit 1
  ) d on true
  where p.group_id = p_group_id
    and p.status in ('generating', 'active')
    and public.is_group_member(p_group_id);
$$;

revoke execute on function public.circle_plan(uuid) from public;
grant execute on function public.circle_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Marcar el día del círculo
-- ---------------------------------------------------------------------------

-- Una acción, dos registros. `prayer_logs` es lo que dispara tu racha personal
-- —oraste, y cuenta— y `group_prayer_days` es lo que el círculo puede leer:
-- la policy de SELECT de `prayer_logs` es `user_id = auth.uid()`, así que un
-- miembro no puede ver los registros de otro ni para contarlos.
create function public.mark_circle_day(p_plan_day_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid;
begin
  select p.group_id into v_group
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.id = p_plan_day_id
    and d.unlock_date <= public.plan_today(p.id);

  if v_group is null then
    return false;
  end if;

  if not exists (
    select 1 from public.group_members m
    where m.group_id = v_group and m.user_id = v_user
  ) then
    return false;
  end if;

  -- Pulsar dos veces, o desde dos dispositivos, no es un fallo: oraste. Los
  -- dos índices únicos lo absorben.
  insert into public.prayer_logs (user_id, plan_day_id)
  values (v_user, p_plan_day_id)
  on conflict (user_id, plan_day_id) do nothing;

  insert into public.group_prayer_days (group_id, plan_day_id, user_id)
  values (v_group, p_plan_day_id, v_user)
  on conflict (group_id, plan_day_id, user_id) do nothing;

  return true;
end;
$$;

revoke execute on function public.mark_circle_day(uuid) from public;
grant execute on function public.mark_circle_day(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- La racha del círculo
-- ---------------------------------------------------------------------------

-- **La regla: cuenta el día si ora la mitad del círculo.** Redondeando hacia
-- arriba, así que en un círculo de tres hacen falta dos.
--
-- **El umbral se evalúa con los miembros de hoy.** Que alguien entre mañana no
-- puede reescribir si el martes pasado contó.
--
-- **Con día de gracia**, igual que la personal. Con una regla ya exigente,
-- quitarla significa que la racha de un círculo de ocho no sobrevive a un
-- domingo — y una racha que se rompe siempre deja de mirarse.
--
-- El día del círculo es el `unlock_date` del día del plan, no el reloj de
-- pared. Un plan común es un calendario compartido: todos reciben el mismo día
-- a la vez, y así no hay dos miembros en husos distintos discrepando sobre qué
-- día era. Ojo con la consecuencia, que es una decisión y no un descuido:
-- `plan_today()` resuelve con `local_today(owner_id)`, así que el día del
-- círculo se abre en el calendario de quien creó el plan.
create function public.bump_group_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date;
  v_threshold integer;
  v_prayed integer;
  v_last date;
  v_streak integer;
begin
  select d.unlock_date into v_day
  from public.prayer_plan_days d
  where d.id = new.plan_day_id;

  select ceil(g.member_count / 2.0)::integer, g.streak_last_day, g.streak_count
    into v_threshold, v_last, v_streak
  from public.groups g
  where g.id = new.group_id;

  -- Rellenar un día antiguo no debe volver a contarlo ni retroceder la racha.
  if v_last is not null and v_day <= v_last then
    return new;
  end if;

  select count(*)::integer into v_prayed
  from public.group_prayer_days gp
  where gp.plan_day_id = new.plan_day_id;

  if v_prayed < greatest(v_threshold, 1) then
    return new;
  end if;

  if v_last is not null and v_last >= v_day - 2 then
    v_streak := coalesce(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  update public.groups
     set streak_count = v_streak,
         streak_last_day = v_day
   where id = new.group_id;

  return new;
end;
$$;

create trigger group_prayer_days_bump_streak
  after insert on public.group_prayer_days
  for each row execute function public.bump_group_streak();
