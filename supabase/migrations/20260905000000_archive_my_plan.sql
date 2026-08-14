-- Ammen — archivar un plan propio (ciclo de vida mínimo C2).
--
-- `authenticated` ya no puede UPDATE de `prayer_plans.status` (solo `title` y
-- `visibility`). Archivar tiene que pasar por una RPC forward-only.
--
-- Qué hace: si eres el dueño y el plan está `active` o `completed`, lo marca
-- `archived`. No toca `generation_ledger`: archivar no devuelve cuota.
-- No borra nada. `failed` y `generating` no se archivan por este camino.

create or replace function public.archive_my_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  updated integer;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  update public.prayer_plans
     set status = 'archived'
   where id = p_plan_id
     and owner_id = current_user_id
     and status in ('active', 'completed');

  get diagnostics updated = row_count;

  if updated = 0 then
    raise exception 'not_archivable';
  end if;

  -- El puntero de Hoy no debe seguir apuntando a un plan que ya no se lista.
  update public.profile_settings
     set active_plan_id = null
   where id = current_user_id
     and active_plan_id = p_plan_id;
end;
$$;

revoke execute on function public.archive_my_plan(uuid) from public;
grant execute on function public.archive_my_plan(uuid) to authenticated;
