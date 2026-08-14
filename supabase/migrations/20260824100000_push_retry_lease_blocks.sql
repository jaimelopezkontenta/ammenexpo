-- Ammen — B4 corrección: retry real, lease contra duplicados, y bloqueo.
--
-- Ciclo de corrección del verificador lógico sobre `send-intercession-push`
-- y `20260823100000_push_devices_outbox.sql`. Tres defectos reales:
--
-- 1. **`mark_push_delivery` no distinguía permanente de reintentable.**
--    Cualquier ticket de error de Expo —incluido un fallo de transporte del
--    lote entero— se escribía como `failed`, terminal, sin reintento ni
--    backoff. Un `MessageRateExceeded` (reintentable por diseño de la propia
--    API de Expo) se trataba exactamente igual que un `DeviceNotRegistered`
--    (que sí es definitivo). El sender tampoco protegía contra procesar la
--    misma fila dos veces si dos invocaciones se solapaban: `pending_push_outbox`
--    era `stable`, de solo lectura, así que dos llamadas concurrentes podían
--    leer y "enviar" el mismo outbox.
--
-- 2. **Nada comprobaba bloqueos en el momento del envío.** `enqueue_push_outbox`
--    encola en el instante en que se crea la intercesión; si el dueño bloquea
--    a quien oró *después* de ese instante pero *antes* de que el sender
--    procese la cola, la entrega salía igual — bloquear dejaba de significar
--    "no me contactes" para el único canal que sale del propio dispositivo.
--
-- **Lo que este archivo corrige, punto por punto:**
--
-- - `push_outbox` gana `next_attempt_at` (cuándo puede reintentarse) y
--   `leased_until` (quién lo tiene en mano ahora mismo, y hasta cuándo).
-- - `mark_push_delivery` pasa a distinguir cuatro resultados:
--   `sent` (ticket aceptado), `delivered` (receipt confirma entrega),
--   `permanent_failure` (`DeviceNotRegistered` o equivalente: `failed` +
--   revocar el dispositivo, inmediato) y `retryable_failure` (se queda
--   `pending`, sube `attempts`, con backoff exponencial — y si se agota el
--   tope real de reintentos, pasa a `failed` **sin** revocar el
--   dispositivo, porque agotar reintentos no es lo mismo que saber que el
--   token está muerto).
-- - `claim_push_outbox_batch()` sustituye a `pending_push_outbox()` como la
--   forma en que el sender obtiene trabajo: usa `for update skip locked`
--   para arrendar (`leased_until`) las filas que devuelve, así que dos
--   invocaciones solapadas nunca reciben la misma fila. `pending_push_outbox()`
--   se conserva como lectura de solo diagnóstico (sin arrendar nada), y ahora
--   también respeta bloqueo/backoff/lease para que "lo que se vería si se
--   enviara ahora" sea honesto.
-- - Tanto `enqueue_push_outbox()` como las dos funciones de lectura excluyen
--   explícitamente cualquier destino donde el dueño del plan haya bloqueado
--   a quien ora — consultado directamente contra `public.blocks`, no contra
--   `has_blocked()`, porque esa función depende de `auth.uid()` y aquí quien
--   pregunta es el trigger o el sender, no la persona bloqueada ni la que
--   bloquea.

-- ---------------------------------------------------------------------------
-- Columnas nuevas: cuándo puede reintentarse, y quién lo tiene arrendado
-- ---------------------------------------------------------------------------

alter table public.push_outbox
  add column next_attempt_at timestamptz not null default now(),
  add column leased_until timestamptz;

create index push_outbox_claimable_idx
  on public.push_outbox (next_attempt_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Encolar: nunca si el dueño ya bloqueó a quien ora
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_push_outbox()
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
    and d.revoked_at is null
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = new.plan_owner_id
        and b.blocked_id = new.intercessor_id
    );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_push_delivery: permanente vs reintentable, con tope real
-- ---------------------------------------------------------------------------
--
-- Mismo nombre y misma firma de tipos que la versión anterior — sigue siendo
-- `(uuid, text, text, text)` — así que `create or replace` es correcto aquí
-- y no rompe el grant ya emitido en la migración anterior.

create or replace function public.mark_push_delivery(
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
  v_attempts integer;
  -- Tope real: a partir de este número de intentos, un reintentable deja de
  -- reintentarse y se da por perdido — pero sin la connotación de "token
  -- muerto", que solo la afirma el proveedor, nunca el conteo de intentos.
  v_max_attempts constant integer := 8;
begin
  if p_status not in ('sent', 'delivered', 'permanent_failure', 'retryable_failure') then
    raise exception 'mark_push_delivery requires a known outcome (sent, delivered, permanent_failure, retryable_failure)';
  end if;

  if p_status = 'sent' then
    update public.push_outbox
       set status = 'sent',
           sent_at = now(),
           receipt_id = coalesce(p_receipt_id, receipt_id),
           last_error = null,
           leased_until = null
     where id = p_outbox_id
       and status = 'pending'
    returning device_id into v_device_id;

    return v_device_id is not null;
  end if;

  if p_status = 'delivered' then
    update public.push_outbox
       set status = 'delivered',
           delivered_at = now(),
           receipt_id = coalesce(p_receipt_id, receipt_id),
           leased_until = null
     where id = p_outbox_id
       and status = 'sent'
    returning device_id into v_device_id;

    return v_device_id is not null;
  end if;

  if p_status = 'permanent_failure' then
    update public.push_outbox
       set status = 'failed',
           attempts = attempts + 1,
           last_error = coalesce(p_error, 'permanent_failure'),
           leased_until = null
     where id = p_outbox_id
       and status in ('pending', 'sent')
    returning device_id into v_device_id;

    if v_device_id is null then
      return false;
    end if;

    -- El motivo de por qué esto es lo único que revoca: un `DeviceNotRegistered`
    -- (o equivalente) lo dice el proveedor sobre el token en sí, no sobre este
    -- envío — el token está muerto para cualquier fila futura, no solo esta.
    update public.push_devices
       set revoked_at = now()
     where id = v_device_id
       and revoked_at is null;

    return true;
  end if;

  -- retryable_failure: transporte, rate limit, error genérico del proveedor —
  -- cualquier cosa que no afirme que el token ya no existe.
  select attempts into v_attempts
    from public.push_outbox
   where id = p_outbox_id
     and status = 'pending';

  if v_attempts is null then
    return false;
  end if;

  if v_attempts + 1 >= v_max_attempts then
    -- Tope agotado: se da por perdido, pero como `failed` sin revocar nada —
    -- agotar reintentos no es la misma afirmación que "el token no existe".
    update public.push_outbox
       set status = 'failed',
           attempts = attempts + 1,
           last_error = coalesce(p_error, 'retry_limit_exceeded'),
           leased_until = null
     where id = p_outbox_id;

    return true;
  end if;

  -- Backoff exponencial con techo, en segundos: 2, 4, 8, 16, 32, 60, 60, ...
  update public.push_outbox
     set attempts = attempts + 1,
         last_error = p_error,
         next_attempt_at = now() + (least(power(2, attempts + 1), 60) * interval '1 second'),
         leased_until = null
   where id = p_outbox_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_push_outbox_batch: lo que el sender llama para trabajar, con lease
-- ---------------------------------------------------------------------------
--
-- `for update skip locked` es la garantía de "nunca duplicados" cuando dos
-- invocaciones se solapan: la segunda simplemente no ve las filas que la
-- primera ya está teniendo en mano, en vez de leerlas también y mandarlas
-- otra vez. El arriendo (`leased_until`) cubre el caso más raro pero real de
-- que la primera invocación muera a media entrega sin soltar el lock —
-- pasado ese plazo, la fila vuelve a ser reclamable.

create function public.claim_push_outbox_batch(
  p_limit integer default 50,
  p_lease_seconds integer default 120
)
returns table (
  outbox_id uuid,
  intercession_id uuid,
  expo_push_token text,
  owner_id uuid,
  owner_name text,
  intercessor_name text,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with claimable as (
    select o.id
    from public.push_outbox o
    join public.push_devices d on d.id = o.device_id
    join public.intercessions i on i.id = o.intercession_id
    where o.status = 'pending'
      and o.next_attempt_at <= now()
      and (o.leased_until is null or o.leased_until < now())
      and d.revoked_at is null
      and not exists (
        select 1 from public.blocks b
        where b.blocker_id = i.plan_owner_id
          and b.blocked_id = i.intercessor_id
      )
    order by o.created_at
    limit greatest(least(p_limit, 200), 1)
    for update of o skip locked
  ),
  leased as (
    update public.push_outbox o
       set leased_until = now() + (greatest(p_lease_seconds, 1) || ' seconds')::interval
      from claimable c
     where o.id = c.id
    returning o.id, o.intercession_id, o.device_id, o.attempts
  )
  select
    l.id,
    l.intercession_id,
    d.expo_push_token,
    i.plan_owner_id,
    pr.display_name,
    ipr.display_name,
    l.attempts
  from leased l
  join public.push_devices d on d.id = l.device_id
  join public.intercessions i on i.id = l.intercession_id
  join public.profiles pr on pr.id = i.plan_owner_id
  join public.profiles ipr on ipr.id = i.intercessor_id;
end;
$$;

revoke execute on function public.claim_push_outbox_batch(integer, integer) from public;
grant execute on function public.claim_push_outbox_batch(integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- pending_push_outbox: se conserva como lectura de diagnóstico, no de envío
-- ---------------------------------------------------------------------------
--
-- No arrienda nada — sigue siendo `stable`. Ahora sí refleja backoff, lease y
-- bloqueo, para que "qué hay pendiente de verdad" no mienta sobre lo que
-- `claim_push_outbox_batch()` está reteniendo o que un bloqueo ya excluyó.

create or replace function public.pending_push_outbox(p_limit integer default 50)
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
    i.plan_owner_id,
    pr.display_name,
    ipr.display_name,
    o.attempts
  from public.push_outbox o
  join public.push_devices d on d.id = o.device_id
  join public.intercessions i on i.id = o.intercession_id
  join public.profiles pr on pr.id = i.plan_owner_id
  join public.profiles ipr on ipr.id = i.intercessor_id
  where o.status = 'pending'
    and o.next_attempt_at <= now()
    and (o.leased_until is null or o.leased_until < now())
    and d.revoked_at is null
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = i.plan_owner_id
        and b.blocked_id = i.intercessor_id
    )
  order by o.created_at
  limit greatest(least(p_limit, 200), 1);
$$;
