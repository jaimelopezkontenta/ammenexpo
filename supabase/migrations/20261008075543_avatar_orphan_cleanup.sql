-- El programador del barrido de avatares huérfanos.
--
-- Los huérfanos nacen de dos grietas que la app no puede cerrar sola:
--   1. Borrarse borra `auth.users`, y si el cliente no alcanzó a borrar la
--      foto (o era una app vieja que no la borraba), el fichero queda en
--      Storage para siempre.
--   2. Cambiar de foto con otra extensión (png → jpg) hace un upsert sobre la
--      otra ruta y deja la vieja sin referencia.
--
-- SQL no puede hacer la limpieza: el trigger `storage.protect_delete` prohíbe
-- borrar de `storage.objects`, y aunque se levantara con el GUC
-- `storage.allow_delete_query`, en la versión de Supabase que se usa el
-- borrado de la fila deja el fichero físico en el disco (verificado sobre el
-- stack local: fila borrada, 9 bytes siguen ahí). Por eso esta función no
-- borra nada: llama por pg_net a la edge function `cleanup-avatars`, que con
-- el rol de servicio lista, decide y borra por la API de Storage.
--
-- Mismo contrato que `run_queue_drains()`: puerta en `scheduler_settings`,
-- `no_functions_url` y `missing_secret` como respuestas (no como silencios),
-- y el secreto en Vault, nunca en el fichero.
--
-- La decisión de qué es huérfano vive en la edge function
-- (`supabase/functions/cleanup-avatars/orphans.ts`, pura y con tests de
-- Vitest): duplicarla aquí en SQL sería mantener dos definiciones de la misma
-- palabra.

create or replace function public.run_avatar_cleanup()
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

  v_secret := null;
  select nullif(ds.decrypted_secret, '') into v_secret
    from vault.decrypted_secrets ds
   where ds.name = 'ammen_avatar_cleanup_invoke_secret';

  -- Kong exige algún JWT en la ruta de funciones (sin él, 401 «Missing
  -- authorization header» antes de que la función vea el invoker), así que la
  -- llamada lleva la anon key. No es un secreto (la app la lleva incrustada),
  -- pero vive en Vault igual que los demás valores de proyecto: es la única
  -- forma portable de que la SQL la lea.
  v_api_key := null;
  select nullif(ds.decrypted_secret, '') into v_api_key
    from vault.decrypted_secrets ds
   where ds.name = 'ammen_anon_key';

  if v_secret is null then
    v_missing := array_append(v_missing, 'ammen_avatar_cleanup_invoke_secret');
  end if;
  if v_api_key is null then
    v_missing := array_append(v_missing, 'ammen_anon_key');
  end if;
  if cardinality(v_missing) > 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_secret',
      'missing', to_jsonb(v_missing)
    );
  end if;

  perform net.http_post(
    url := v_base || '/cleanup-avatars',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_api_key,
      'x-ammen-invoker', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );

  return jsonb_build_object('ok', true, 'called', 'cleanup-avatars');
end;
$$;

-- La función lee `profiles` con el rol de servicio para saber qué fichero
-- referencia cada usuario; sin el grant explícito, 42501 (verificado en local).
grant select on public.profiles to service_role;

revoke execute on function public.run_avatar_cleanup() from public, anon, authenticated;
grant execute on function public.run_avatar_cleanup() to service_role;

-- Idempotente como los demás: se vuelve a programar si ya existía.
-- Las 03:47, después de `ammen-retention` (03:17): si el día de mañana la
-- retención toca avatares, que el barrido vea el resultado, no el anterior.
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'ammen-avatar-cleanup';

select cron.schedule('ammen-avatar-cleanup', '47 3 * * *',
  $job$ select public.run_avatar_cleanup(); $job$);
