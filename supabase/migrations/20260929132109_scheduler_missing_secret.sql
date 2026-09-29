-- Revisión adversarial R1 (2026-09-29), S12: el programador no puede decir
-- «ok» cuando no puede entregar nada.
--
-- Sin el secreto en Vault, `run_queue_drains()` llamaba igual a la función
-- con `x-ammen-invoker` vacío, recibía un 401 (asíncrono: pg_net no espera) y
-- devolvía `ok: true`. Y `run_email_jobs()` seguía encolando correo con
-- `functions_url` vacío: una cola que crece sin que nadie la drene es el
-- atracón del día que alguien la configure (ver skip_stale_queue_rows).
--
-- Ahora las dos se niegan y lo dicen: `missing_secret` (con qué falta) o
-- `no_functions_url`, y un WARNING en el log de Postgres (Dashboard → Logs →
-- Postgres) cada minuto mientras siga mal configurado. Si falta solo uno de
-- los dos secretos, la otra cola sigue drenándose.

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
  v_missing text[] := '{}';
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
    v_secret := null;
    select nullif(ds.decrypted_secret, '') into v_secret
      from vault.decrypted_secrets ds
     where ds.name = 'ammen_email_invoke_secret';

    if v_secret is null then
      v_missing := array_append(v_missing, 'ammen_email_invoke_secret');
    else
      perform net.http_post(
        url := v_base || '/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-ammen-invoker', v_secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      v_called := array_append(v_called, 'send-email');
    end if;
  end if;

  if exists (
    select 1 from public.push_outbox o
     where o.status = 'pending'
       and public.push_outbox_claimable(o)
  ) then
    v_secret := null;
    select nullif(ds.decrypted_secret, '') into v_secret
      from vault.decrypted_secrets ds
     where ds.name = 'ammen_push_invoke_secret';

    if v_secret is null then
      v_missing := array_append(v_missing, 'ammen_push_invoke_secret');
    else
      perform net.http_post(
        url := v_base || '/send-intercession-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-ammen-invoker', v_secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      v_called := array_append(v_called, 'send-intercession-push');
    end if;
  end if;

  if cardinality(v_missing) > 0 then
    raise warning 'run_queue_drains: falta % en Vault; esa cola no se drena',
      array_to_string(v_missing, ', ');
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_secret',
      'missing', to_jsonb(v_missing),
      'called', to_jsonb(v_called)
    );
  end if;

  return jsonb_build_object('ok', true, 'called', to_jsonb(v_called));
end;
$$;

create or replace function public.run_email_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.scheduler_settings;
begin
  select * into v_settings from public.scheduler_settings where id;

  if not found or not v_settings.enabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  if rtrim(coalesce(v_settings.functions_url, ''), '/') = '' then
    raise warning 'run_email_jobs: scheduler_settings.functions_url vacío; no se encola nada';
    return jsonb_build_object('ok', false, 'reason', 'no_functions_url');
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets ds
     where ds.name = 'ammen_email_invoke_secret'
       and coalesce(ds.decrypted_secret, '') <> ''
  ) then
    raise warning 'run_email_jobs: falta ammen_email_invoke_secret en Vault; no se encola nada';
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_secret',
      'missing', jsonb_build_array('ammen_email_invoke_secret')
    );
  end if;

  return jsonb_build_object('ok', true, 'jobs', public.enqueue_all_email_jobs());
end;
$$;

revoke execute on function public.run_queue_drains() from public, anon, authenticated;
revoke execute on function public.run_email_jobs() from public, anon, authenticated;
grant execute on function public.run_queue_drains() to service_role;
grant execute on function public.run_email_jobs() to service_role;
