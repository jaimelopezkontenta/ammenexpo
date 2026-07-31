-- Ammen — que un plan pueda terminar, y que se vean los tres.
--
-- Dos trampas que solo aparecen recorriendo la app entera y esperando.
--
-- **La primera: el plan que se acaba congela la aplicación.** `get_my_day`
-- devuelve el último día desbloqueado (`order by day_number desc limit 1`), así
-- que el día 31 de un plan de 30 sigue devolviendo el día 30. `usePrayedToday`
-- cuenta los registros de ese día *alguna vez*, no hoy, y como el día 30 ya se
-- oró, el botón nunca vuelve. `bump_personal_streak` solo dispara al insertar,
-- así que la racha se cae sola a los dos días. Y `/plan/nuevo` tiene una única
-- entrada en toda la app, dentro de la rama "no tienes plan": con un plan
-- activo no hay ningún camino a crear otro. Terminas tu plan y la app te enseña
-- el día 30 cada mañana, para siempre, diciéndote que ya oraste.
--
-- **La segunda: dos de tus tres planes son invisibles.** El límite gratuito
-- subió a 3 y la consulta de inicio hace `limit(1)` sobre el más reciente. No
-- hay lista de planes en ninguna parte. Los otros dos existen, cuentan contra
-- el cupo, y no se pueden abrir.

-- ---------------------------------------------------------------------------
-- Cómo va un plan
-- ---------------------------------------------------------------------------

-- `finished` se calcula, no se guarda. El enum tiene 'completed' desde la Fase 1
-- y no lo escribe nadie; sin `pg_cron` no hay quien lo escriba, y una bandera
-- que hay que acordarse de poner es una bandera que un día no se pone.
--
-- Exige además que estén escritos todos los días previstos, para no confundir
-- "se acabó" con "la generación se quedó a medias en el día 7 y esa fecha ya
-- pasó" — que es un estado distinto, y con otra salida.
create function public.plan_progress(p_plan_id uuid)
returns table (
  days_total smallint,
  days_written integer,
  days_unlocked integer,
  days_prayed integer,
  intercessions_received integer,
  finished boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.duration_days,
    count(d.id)::integer,
    count(d.id) filter (
      where d.unlock_date <= public.local_today(p.owner_id)
    )::integer,
    count(l.id)::integer,
    coalesce(sum(d.intercession_count), 0)::integer,
    count(d.id) >= p.duration_days
      and max(d.unlock_date) < public.local_today(p.owner_id)
  from public.prayer_plans p
  join public.prayer_plan_days d on d.plan_id = p.id
  -- El left join es contra los registros *del dueño*: `prayer_logs` solo lo lee
  -- su dueño por policy, y esta función es definer, así que sin acotar por
  -- `user_id` contaría los de cualquiera.
  left join public.prayer_logs l
    on l.plan_day_id = d.id and l.user_id = p.owner_id
  where p.id = p_plan_id
    and p.owner_id = (select auth.uid())
  group by p.id, p.duration_days, p.owner_id;
$$;

revoke execute on function public.plan_progress(uuid) from public;
grant execute on function public.plan_progress(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Cuál de tus planes estás recorriendo
-- ---------------------------------------------------------------------------

-- En el servidor y no en el cliente porque es justo lo que las notificaciones
-- van a necesitar para saber de qué plan hablar, y porque una elección que vive
-- en el dispositivo se pierde al reinstalar.
alter table public.profile_settings
  add column active_plan_id uuid
    references public.prayer_plans (id) on delete set null;

-- La policy de UPDATE solo comprueba de quién es la *fila*, no qué se escribe
-- dentro. Sin esto, cualquiera podría apuntar su `active_plan_id` al plan de
-- otra persona: no leería nada —`get_my_day` comprueba el dueño— pero dejaría
-- la fila mintiendo, y la próxima función que se fíe de ella heredaría el
-- agujero sin saberlo.
create function public.validate_active_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active_plan_id is not null then
    if not exists (
      select 1 from public.prayer_plans p
      where p.id = new.active_plan_id and p.owner_id = new.id
    ) then
      raise exception 'active_plan_id must be a plan you own';
    end if;
  end if;

  return new;
end;
$$;

create trigger profile_settings_validate_active_plan
  before insert or update of active_plan_id on public.profile_settings
  for each row execute function public.validate_active_plan();

-- El GRANT es de tabla entera (`grant select, update on public.profile_settings
-- to authenticated`), así que la columna nueva queda cubierta sin tocarlo.
