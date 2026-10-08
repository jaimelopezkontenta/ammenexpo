-- Kong exige algún JWT en la ruta de funciones; sin él, 401 «Missing
-- authorization header» antes de que la función vea el `x-ammen-invoker`.
--
-- `run_queue_drains()` llamaba a `send-email` / `send-intercession-push` con
-- `Content-Type` e `x-ammen-invoker` pero sin `apikey`: pg_net no espera la
-- respuesta (es asíncrono), así que el 401 de Kong nunca se vio y la cola no
-- se drenaba sin que el programador lo dijera. Lo descubrió el barrido de
-- avatares (20261008075543), que sí probó la cadena completa en local:
-- `run_avatar_cleanup()` devolvía `ok: true` pero el 401 quedaba en
-- `net._http_response` y el huérfano seguía ahí.
--
-- La anon key no es un secreto (la app la lleva incrustada), pero vive en
-- Vault igual que los demás valores de proyecto: es la única forma portable de
-- que la SQL la lea (ni `auth.instances` ni `auth.config` la guardan en local).
-- Si falta, se añade a `missing` y esa cola no se drena, con el WARNING de
-- siempre.

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
  v_api_key text;
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

  v_api_key := null;
  select nullif(ds.decrypted_secret, '') into v_api_key
    from vault.decrypted_secrets ds
   where ds.name = 'ammen_anon_key';

  if v_api_key is null then
    v_missing := array_append(v_missing, 'ammen_anon_key');
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
    elsif v_api_key is not null then
      perform net.http_post(
        url := v_base || '/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', v_api_key,
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
    elsif v_api_key is not null then
      perform net.http_post(
        url := v_base || '/send-intercession-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', v_api_key,
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

revoke execute on function public.run_queue_drains() from public, anon, authenticated;
grant execute on function public.run_queue_drains() to service_role;
