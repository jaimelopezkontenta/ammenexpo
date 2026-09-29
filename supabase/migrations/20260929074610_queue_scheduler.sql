-- Oleada 1b de la auditoría (2026-09-29): las colas por fin se envían.
--
-- Push y correo se encolaban (`push_outbox`, `email_outbox`) y nada los
-- drenaba en ningún entorno: ni pg_cron creado, ni una llamada a las edge
-- functions, ni un cron de CI. Solo `npm run push:drain` / `email:drain` a
-- mano. El `cron.schedule` de 20260908200000_email_jobs.sql solo corría si
-- pg_cron ya existía antes de esa migración, y no existía.
--
-- El programador vive en la base: pg_cron cada minuto llama a
-- `run_queue_drains()`, que solo invoca un drenaje si tiene algo pendiente
-- (un minuto vacío no cuesta una invocación). Todo cuelga de un interruptor,
-- `scheduler_settings.enabled`, **apagado** por defecto: las suites de
-- `db:test` y los e2e no pueden tener un cron moviendo las colas por debajo.
--
-- Configuración por entorno, nunca en una migración:
--   - `scheduler_settings.functions_url` y `enabled` (no son secretos);
--   - los secretos de invocación, en Vault: `ammen_email_invoke_secret` y
--     `ammen_push_invoke_secret` (los mismos valores que AMMEN_*_INVOKE_SECRET
--     de las edge functions).
-- Ver docs/runbooks/staging-web.md.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- La configuración (una sola fila)
-- ---------------------------------------------------------------------------
create table if not exists public.scheduler_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  functions_url text,
  updated_at timestamptz not null default now()
);

-- Sin policies: solo el dueño de la base y service_role la tocan.
alter table public.scheduler_settings enable row level security;
revoke all on public.scheduler_settings from public, anon, authenticated;

insert into public.scheduler_settings (id) values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Drenar lo pendiente
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
       and o.next_attempt_at <= now()
       and (o.leased_until is null or o.leased_until < now())
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
       and o.next_attempt_at <= now()
       and (o.leased_until is null or o.leased_until < now())
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

-- ---------------------------------------------------------------------------
-- Los trabajos de correo (digest, drip, win-back…), con el mismo interruptor
-- ---------------------------------------------------------------------------
create or replace function public.run_email_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select s.enabled from public.scheduler_settings s where s.id), false) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  return jsonb_build_object('ok', true, 'jobs', public.enqueue_all_email_jobs());
end;
$$;

-- ---------------------------------------------------------------------------
-- Retención
--
-- Plazos conservadores, fáciles de cambiar aquí mismo:
--   - correo enviado / omitido / fallido: 90 días;
--   - eventos de Resend: 180 días;
--   - push entregado o fallido: 30 días;
--   - historial de pg_cron: 7 días.
-- `generation_ledger` NO se purga: la cuota de planes cuenta sus filas de por
-- vida. Los avisos tampoco: son el historial que la persona ve.
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_rows()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox integer;
  v_events integer;
  v_push integer;
begin
  if not coalesce((select s.enabled from public.scheduler_settings s where s.id), false) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  delete from public.email_events where created_at < now() - interval '180 days';
  get diagnostics v_events = row_count;

  delete from public.email_outbox
   where status in ('sent', 'skipped', 'failed')
     and created_at < now() - interval '90 days';
  get diagnostics v_outbox = row_count;

  delete from public.push_outbox
   where status <> 'pending'
     and created_at < now() - interval '30 days';
  get diagnostics v_push = row_count;

  delete from cron.job_run_details where end_time < now() - interval '7 days';

  return jsonb_build_object(
    'ok', true,
    'email_outbox', v_outbox,
    'email_events', v_events,
    'push_outbox', v_push
  );
end;
$$;

revoke execute on function public.run_queue_drains() from public, anon, authenticated;
revoke execute on function public.run_email_jobs() from public, anon, authenticated;
revoke execute on function public.purge_expired_rows() from public, anon, authenticated;
grant execute on function public.run_queue_drains() to service_role;
grant execute on function public.run_email_jobs() to service_role;
grant execute on function public.purge_expired_rows() to service_role;

-- ---------------------------------------------------------------------------
-- Los trabajos (idempotente: se vuelven a programar si ya existían)
-- ---------------------------------------------------------------------------
select cron.unschedule(jobid)
  from cron.job
 where jobname in (
   'ammen-email-jobs', 'ammen-email-drain-hint',
   'ammen-queue-drains', 'ammen-retention'
 );

select cron.schedule('ammen-queue-drains', '* * * * *',
  $job$ select public.run_queue_drains(); $job$);

select cron.schedule('ammen-email-jobs', '*/15 * * * *',
  $job$ select public.run_email_jobs(); $job$);

select cron.schedule('ammen-retention', '17 3 * * *',
  $job$ select public.purge_expired_rows(); $job$);
