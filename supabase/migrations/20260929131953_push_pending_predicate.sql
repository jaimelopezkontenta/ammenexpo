-- Revisión adversarial R1 (2026-09-29), S2: «¿hay algo pendiente?» y «dame lo
-- pendiente» tienen que ser la misma pregunta.
--
-- `run_queue_drains()` llamaba a `send-intercession-push` si había filas
-- `pending` con el reintento vencido, pero `claim_push_outbox_batch()` además
-- descarta las de un dispositivo revocado o un intercesor bloqueado. Una sola
-- fila así —y revocar al cerrar sesión las produce a diario— hacía que cada
-- minuto se invocara la función para no reclamar nada, para siempre. En
-- correo, igual con `scheduled_for` en el futuro.
--
-- Ahora el predicado es uno, en una función por cola, y lo usan el drenaje,
-- el claim y la lectura de diagnóstico. Y lo que ya nunca va a salir deja de
-- estar `pending`: revocar un dispositivo (logout, «cerrar todo» o el
-- `DeviceNotRegistered` de Expo) y bloquear a quien ora marcan `skipped` lo
-- que tenían encolado. Volver a registrar el mismo token no lo resucita: un
-- aviso de hace días ya no es un aviso.

-- ---------------------------------------------------------------------------
-- Los predicados
--
-- Reciben la fila entera para que el claim pueda seguir con
-- `for update skip locked` sobre la tabla. No son SECURITY DEFINER: solo las
-- llaman funciones que ya lo son.
-- ---------------------------------------------------------------------------
create or replace function public.push_outbox_claimable(p_row public.push_outbox)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_row.status = 'pending'
     and p_row.next_attempt_at <= now()
     and (p_row.leased_until is null or p_row.leased_until < now())
     and exists (
       select 1 from public.push_devices d
        where d.id = p_row.device_id
          and d.revoked_at is null
     )
     and exists (
       select 1 from public.intercessions i
        where i.id = p_row.intercession_id
          and not exists (
            select 1 from public.blocks b
             where b.blocker_id = i.plan_owner_id
               and b.blocked_id = i.intercessor_id
          )
     );
$$;

create or replace function public.email_outbox_claimable(p_row public.email_outbox)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_row.status = 'pending'
     and p_row.scheduled_for <= now()
     and p_row.next_attempt_at <= now()
     and (p_row.leased_until is null or p_row.leased_until < now());
$$;

revoke execute on function public.push_outbox_claimable(public.push_outbox)
  from public, anon, authenticated;
revoke execute on function public.email_outbox_claimable(public.email_outbox)
  from public, anon, authenticated;
grant execute on function public.push_outbox_claimable(public.push_outbox) to service_role;
grant execute on function public.email_outbox_claimable(public.email_outbox) to service_role;

-- ---------------------------------------------------------------------------
-- Los claims, con el predicado
--
-- `o.status = 'pending'` se repite fuera solo para que el planificador use el
-- índice parcial; la regla es la función.
-- ---------------------------------------------------------------------------
create or replace function public.claim_push_outbox_batch(
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
    where o.status = 'pending'
      and public.push_outbox_claimable(o)
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
    and public.push_outbox_claimable(o)
  order by o.created_at
  limit greatest(least(p_limit, 200), 1);
$$;

create or replace function public.claim_email_outbox_batch(
  p_limit integer default 50,
  p_lease_seconds integer default 120
)
returns table (
  outbox_id uuid,
  template text,
  locale text,
  to_email text,
  user_id uuid,
  channel text,
  payload jsonb,
  idempotency_key text,
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
    from public.email_outbox o
    where o.status = 'pending'
      and public.email_outbox_claimable(o)
    order by o.created_at
    limit greatest(least(p_limit, 200), 1)
    for update of o skip locked
  ),
  leased as (
    update public.email_outbox o
       set leased_until = now() + (greatest(p_lease_seconds, 1) || ' seconds')::interval
      from claimable c
     where o.id = c.id
    returning o.id, o.template, o.locale, o.to_email, o.user_id,
              o.channel, o.payload, o.idempotency_key, o.attempts
  )
  select
    l.id,
    l.template,
    l.locale,
    l.to_email,
    l.user_id,
    l.channel,
    l.payload,
    l.idempotency_key,
    l.attempts
  from leased l;
end;
$$;

revoke execute on function public.claim_push_outbox_batch(integer, integer)
  from public, anon, authenticated;
revoke execute on function public.pending_push_outbox(integer)
  from public, anon, authenticated;
revoke execute on function public.claim_email_outbox_batch(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_push_outbox_batch(integer, integer) to service_role;
grant execute on function public.pending_push_outbox(integer) to service_role;
grant execute on function public.claim_email_outbox_batch(integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- El drenaje pregunta lo mismo que el claim
-- ---------------------------------------------------------------------------
create or replace function public.run_queue_drains()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.scheduler_settings;
  v_base text;
  v_secret text;
  v_called text[] := '{}';
begin
  select * into v_settings from public.scheduler_settings where id;

  if not found or not v_settings.enabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  v_base := rtrim(coalesce(v_settings.functions_url, ''), '/');
  if v_base = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_functions_url');
  end if;

  if exists (
    select 1 from public.email_outbox o
     where o.status = 'pending'
       and public.email_outbox_claimable(o)
  ) then
    select ds.decrypted_secret into v_secret
      from vault.decrypted_secrets ds
     where ds.name = 'ammen_email_invoke_secret';

    perform net.http_post(
      url := v_base || '/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-ammen-invoker', coalesce(v_secret, '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    v_called := array_append(v_called, 'send-email');
  end if;

  if exists (
    select 1 from public.push_outbox o
     where o.status = 'pending'
       and public.push_outbox_claimable(o)
  ) then
    select ds.decrypted_secret into v_secret
      from vault.decrypted_secrets ds
     where ds.name = 'ammen_push_invoke_secret';

    perform net.http_post(
      url := v_base || '/send-intercession-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-ammen-invoker', coalesce(v_secret, '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    v_called := array_append(v_called, 'send-intercession-push');
  end if;

  return jsonb_build_object('ok', true, 'called', to_jsonb(v_called));
end;
$$;

revoke execute on function public.run_queue_drains() from public, anon, authenticated;
grant execute on function public.run_queue_drains() to service_role;

-- ---------------------------------------------------------------------------
-- Lo que ya no va a salir deja de estar pendiente
-- ---------------------------------------------------------------------------
create or replace function public.skip_push_for_revoked_device()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_outbox
     set status = 'skipped',
         last_error = 'device_revoked',
         leased_until = null
   where device_id = new.id
     and status = 'pending';

  return null;
end;
$$;

drop trigger if exists push_devices_skip_pending on public.push_devices;
create trigger push_devices_skip_pending
  after update of revoked_at on public.push_devices
  for each row
  when (old.revoked_at is null and new.revoked_at is not null)
  execute function public.skip_push_for_revoked_device();

-- Mismo sentido que el claim: el dueño del plan bloquea a quien oró.
create or replace function public.skip_push_for_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_outbox o
     set status = 'skipped',
         last_error = 'blocked',
         leased_until = null
    from public.intercessions i
   where i.id = o.intercession_id
     and i.plan_owner_id = new.blocker_id
     and i.intercessor_id = new.blocked_id
     and o.status = 'pending';

  return null;
end;
$$;

drop trigger if exists blocks_skip_pending_push on public.blocks;
create trigger blocks_skip_pending_push
  after insert on public.blocks
  for each row execute function public.skip_push_for_block();

revoke execute on function public.skip_push_for_revoked_device() from public, anon, authenticated;
revoke execute on function public.skip_push_for_block() from public, anon, authenticated;

-- Lo que ya estaba atascado en la cola.
update public.push_outbox o
   set status = 'skipped',
       last_error = 'device_revoked',
       leased_until = null
  from public.push_devices d
 where d.id = o.device_id
   and d.revoked_at is not null
   and o.status = 'pending';

update public.push_outbox o
   set status = 'skipped',
       last_error = 'blocked',
       leased_until = null
  from public.intercessions i
 where i.id = o.intercession_id
   and o.status = 'pending'
   and exists (
     select 1 from public.blocks b
      where b.blocker_id = i.plan_owner_id
        and b.blocked_id = i.intercessor_id
   );
