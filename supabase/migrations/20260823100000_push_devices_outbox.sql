-- Ammen — B4: dispositivos, no perfil; y un buzón de salida auditable.
--
-- **RDY-10, el agujero.** `profile_settings.expo_push_token` es UN token por
-- persona. Instalar en un segundo dispositivo pisa el primero; cerrar sesión
-- no lo borra; cambiar de cuenta en el mismo teléfono hereda el token de
-- quien entró antes. Nada de eso es hipotético — es lo que un solo campo
-- siempre hace cuando el dueño real es la instalación, no la cuenta.
--
-- **RDY-11, el agujero.** No hay outbox, no hay receipts, no hay retry y no
-- hay forma de invalidar un token que el proveedor dice que ya no existe. Sin
-- eso, "una entrega por oración" es una promesa sin mecanismo detrás.
--
-- **Lo que esta migración construye, y lo que deja fuera a propósito.**
-- Construye el modelo de datos, las RPC auditadas y el trigger que encola.
-- Deja fuera un sender que hable con un proveedor push real: eso vive en
-- `supabase/functions/send-intercession-push/`, y el plan es explícito en que
-- mocks de desarrollo **nunca cuentan como cierre de push** — ver
-- `docs/runbooks/push-b4.md`.

-- ---------------------------------------------------------------------------
-- push_devices — una fila por instalación, nunca por persona
-- ---------------------------------------------------------------------------

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  -- Null mientras el dispositivo puede recibir push. Se pone al cerrar
  -- sesión, al invalidar por receipt del proveedor, o al bloquear.
  revoked_at timestamptz
);

create index push_devices_user_idx on public.push_devices (user_id)
  where revoked_at is null;

alter table public.push_devices enable row level security;

-- Solo lectura de la fila propia por policy; escribir pasa siempre por una
-- RPC. La razón concreta: un `upsert` de cliente sobre `expo_push_token`
-- (único, y compartido entre instalaciones si el mismo teléfono cambia de
-- cuenta) tendría que decidir en la policy si reasignar el dueño es
-- legítimo — y esa decisión pertenece a una función que audita el cambio,
-- no a un `using()` que solo puede decir sí o no.
create policy "users see their own devices"
  on public.push_devices for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_devices from anon, authenticated, service_role;
grant select on public.push_devices to authenticated;
grant select on public.push_devices to service_role;

-- Registrar es tanto el alta como la rotación: el mismo token puede volver
-- con permiso reconcedido tras haber sido revocado, y un teléfono que cambia
-- de cuenta reasigna la fila en vez de acumular basura por token.
create function public.register_push_device(p_token text, p_platform text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or char_length(btrim(p_token)) = 0 then
    raise exception 'register_push_device requires a token';
  end if;

  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'register_push_device requires a valid platform';
  end if;

  insert into public.push_devices (user_id, expo_push_token, platform)
  values ((select auth.uid()), btrim(p_token), p_platform)
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        last_used_at = now(),
        revoked_at = null;

  return true;
end;
$$;

-- Logout de un dispositivo concreto: lo que corre al cerrar sesión.
create function public.revoke_push_device(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_devices
     set revoked_at = now()
   where expo_push_token = p_token
     and user_id = (select auth.uid())
     and revoked_at is null;

  return found;
end;
$$;

-- Borrado de cuenta / "cierra todo": todas las instalaciones de esta persona.
create function public.revoke_all_my_push_devices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.push_devices
     set revoked_at = now()
   where user_id = (select auth.uid())
     and revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.register_push_device(text, text) from public;
revoke execute on function public.revoke_push_device(text) from public;
revoke execute on function public.revoke_all_my_push_devices() from public;
grant execute on function public.register_push_device(text, text) to authenticated;
grant execute on function public.revoke_push_device(text) to authenticated;
grant execute on function public.revoke_all_my_push_devices() to authenticated;

-- ---------------------------------------------------------------------------
-- push_outbox — una entrega intentada por (intercesión, dispositivo)
-- ---------------------------------------------------------------------------
--
-- La clave única es el idempotency key real: reintentar nunca duplica,
-- porque reintentar es "vuelve a intentar esta misma fila", no "crea otra".

create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  intercession_id uuid not null references public.intercessions (id) on delete cascade,
  device_id uuid not null references public.push_devices (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  -- El id que el proveedor devuelve al aceptar el envío; se resuelve después,
  -- por separado, contra su endpoint de receipts.
  receipt_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  unique (intercession_id, device_id)
);

create index push_outbox_pending_idx on public.push_outbox (status, created_at)
  where status = 'pending';

create index push_outbox_receipt_idx on public.push_outbox (receipt_id)
  where receipt_id is not null;

alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated, service_role;
-- Solo el sender (service_role) lee/escribe el outbox. El cliente nunca ve
-- esta tabla: lo que le importa es el aviso en `notifications`, que ya existe
-- desde antes de este ticket y no cambia aquí.
grant select, update on public.push_outbox to service_role;

-- El trigger que encola: una fila de outbox por dispositivo activo del dueño
-- del plan, en el momento en que la intercesión se inserta. `security
-- definer` porque lee `push_devices` de otra persona (el dueño del plan, no
-- quien ora), que la policy de arriba no deja ver por SELECT normal.
create function public.enqueue_push_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_outbox (intercession_id, device_id)
  select new.id, d.id
  from public.push_devices d
  where d.user_id = new.plan_owner_id
    and d.revoked_at is null;

  return new;
end;
$$;

create trigger intercessions_enqueue_push
  after insert on public.intercessions
  for each row execute function public.enqueue_push_outbox();

-- El sender resuelve/marca por su cuenta (SECURITY DEFINER, execute a
-- service_role): recibir un receipt del proveedor y, si dice
-- "DeviceNotRegistered", invalidar el dispositivo — no solo esta fila.
create function public.mark_push_delivery(
  p_outbox_id uuid,
  p_status text,
  p_receipt_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device_id uuid;
begin
  if p_status not in ('sent', 'delivered', 'failed', 'skipped') then
    raise exception 'mark_push_delivery requires a terminal status';
  end if;

  update public.push_outbox
     set status = p_status,
         attempts = attempts + 1,
         receipt_id = coalesce(p_receipt_id, receipt_id),
         last_error = p_error,
         sent_at = case when p_status = 'sent' then now() else sent_at end,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end
   where id = p_outbox_id
  returning device_id into v_device_id;

  if v_device_id is null then
    return false;
  end if;

  -- El token ya no existe del lado del proveedor: se desactiva el
  -- dispositivo entero, no solo el intento — un token muerto lo sigue
  -- estando la próxima vez.
  if p_status = 'failed' and p_error = 'DeviceNotRegistered' then
    update public.push_devices
       set revoked_at = now()
     where id = v_device_id
       and revoked_at is null;
  end if;

  return true;
end;
$$;

revoke execute on function public.mark_push_delivery(uuid, text, text, text) from public;
grant execute on function public.mark_push_delivery(uuid, text, text, text) to service_role;

-- Lo que el sender pide para trabajar: pendientes con su token, sin exponer
-- la tabla entera. `security definer` porque lee `push_devices`,
-- `intercessions` y `profiles` de gente que no es quien llama —el sender
-- corre como service_role, que ya salta RLS, pero declarar el helper así
-- deja la intención explícita y es reutilizable si algún día un runner
-- restringido necesita la misma lectura.
create function public.pending_push_outbox(p_limit integer default 50)
returns table (
  outbox_id uuid,
  intercession_id uuid,
  expo_push_token text,
  owner_id uuid,
  owner_name text,
  intercessor_name text,
  attempts integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.intercession_id,
    d.expo_push_token,
    p.plan_owner_id,
    pr.display_name,
    ipr.display_name,
    o.attempts
  from public.push_outbox o
  join public.push_devices d on d.id = o.device_id
  join public.intercessions p on p.id = o.intercession_id
  join public.profiles pr on pr.id = p.plan_owner_id
  join public.profiles ipr on ipr.id = p.intercessor_id
  where o.status = 'pending'
    and d.revoked_at is null
    and o.attempts < 5
  order by o.created_at
  limit greatest(least(p_limit, 200), 1);
$$;

revoke execute on function public.pending_push_outbox(integer) from public;
grant execute on function public.pending_push_outbox(integer) to service_role;
