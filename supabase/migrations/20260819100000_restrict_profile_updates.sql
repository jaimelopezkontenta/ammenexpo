-- Ammen — B0: cerrar la autoescalada de staff y la racha editable.
--
-- **El agujero.** `20260730100400_grants.sql` concedió `update` sobre TODA la
-- tabla `profiles` al rol `authenticated`, y la policy deja tocar la fila
-- propia. Mientras `profiles` solo tenía nombre, avatar y racha, el daño era
-- menor. Pero `20260814100000_report_queue.sql` añadió `is_staff` a esa tabla,
-- y `is_staff()` abre las RPC de moderación: con el grant vigente, cualquier
-- cuenta podía nombrarse staff a sí misma con un `update` por API y leer y
-- resolver la cola global de reportes. El mismo grant dejaba inflar
-- `streak_count` y reescribir `streak_last_day`.
--
-- **La corrección es por columna, no por policy.** RLS decide filas, no
-- columnas; la única forma de que una columna privilegiada no la toque su
-- dueño es que el rol cliente no tenga grant sobre ella. Es el mismo patrón
-- que ya protege `prayer_plan_days.prayer_body` desde
-- `20260801160000_intercessor_prayer.sql`.
--
-- **Columnas que quedan editables: `display_name` y `avatar_url`, y nada
-- más.** Es exactamente lo que el cliente escribe hoy —auditado en
-- `core/profile/queries.ts` (nombre) y `core/profile/avatar.ts` (foto)—, así
-- que la edición legítima no se rompe. La racha la mueve el trigger
-- `bump_personal_streak()`, que es SECURITY DEFINER y no pasa por el grant;
-- `is_staff` sale del alcance del cliente por completo.

revoke update on public.profiles from authenticated;

grant update (display_name, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- El canal administrativo: nombrar staff sin abrir la puerta al cliente
-- ---------------------------------------------------------------------------
--
-- Antes el bit "se ponía a mano en la base" y se confiaba en saber quién lo
-- hizo. Eso no deja rastro. A partir de aquí el nombramiento pasa por una RPC
-- que **solo el service_role puede ejecutar** —un operador en un runner
-- protegido, el dashboard SQL, jamás la app— y que registra actor, timestamp
-- y motivo en una tabla de la que no se borra.
--
-- `staff_admin_events` no lleva FK a `profiles` a propósito: un registro de
-- auditoría no desaparece en cascada cuando una cuenta se borra. Y no lleva
-- policies: la lee quien opera la base (service_role salta RLS por atributo),
-- nadie por la API pública.

create table public.staff_admin_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid,
  action text not null check (action in ('grant', 'revoke')),
  -- Quién operó, declarado por el propio canal administrativo: con
  -- service_role no hay `auth.uid()` que leer, así que el actor se exige como
  -- parámetro en vez de fingir que la base puede saberlo.
  actor text not null check (char_length(btrim(actor)) > 0),
  reason text not null check (char_length(btrim(reason)) > 0),
  created_at timestamptz not null default now()
);

alter table public.staff_admin_events enable row level security;

-- Los DEFAULT PRIVILEGES del entorno conceden por sí solos DELETE/TRIGGER a
-- los tres roles de API sobre cualquier tabla nueva (visible con `\dp`): una
-- tabla de auditoría no puede heredar un borrado que nadie concedió a mano.
-- Se revoca TODO y se vuelve a dar exactamente lo necesario: lectura para
-- quien opera, nada para el cliente.
revoke all on public.staff_admin_events from anon, authenticated, service_role;
grant select on public.staff_admin_events to service_role;

create function public.admin_set_staff(
  p_user_id uuid,
  p_make_staff boolean,
  p_actor text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or char_length(btrim(p_actor)) = 0 then
    raise exception 'admin_set_staff requires who is operating';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'admin_set_staff requires a reason';
  end if;

  update public.profiles
     set is_staff = p_make_staff
   where id = p_user_id;

  if not found then
    return false;
  end if;

  insert into public.staff_admin_events (target_user_id, action, actor, reason)
  values (
    p_user_id,
    case when p_make_staff then 'grant' else 'revoke' end,
    btrim(p_actor),
    btrim(p_reason)
  );

  return true;
end;
$$;

-- El cliente no la llama ni conoce: solo el canal administrativo.
revoke execute on function public.admin_set_staff(uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_set_staff(uuid, boolean, text, text)
  to service_role;
