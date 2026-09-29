-- Revisión adversarial R1 (2026-09-29), S7: los permisos de las funciones no
-- pueden depender de cómo nació cada entorno.
--
-- Las migraciones cierran cada función con `revoke execute ... from public` y
-- abren lo justo con `grant`. En local basta: una función nueva solo es
-- ejecutable por PUBLIC y el revoke la cierra. Pero un proyecto de Supabase
-- creado con los privilegios por defecto antiguos concede EXECUTE
-- DIRECTAMENTE a anon, authenticated y service_role sobre cada función nueva
-- de `public`, y `revoke ... from public` no toca esas concesiones: en un
-- staging así, anon podría llamar a `claim_push_outbox_batch` (tokens push),
-- `ensure_follow` o `email_address_for`, que en local están cerradas.
--
-- Esta migración deja el catálogo igual en todos los entornos:
--   1. Nadie ejecuta sin sesión más que la lista de abajo (`v_anon`).
--   2. Lo que solo es de colas, correo o administración (`v_service_only`)
--      tampoco con sesión de usuario.
--   3. Lo demás conserva exactamente quién podía llamarlo: si authenticated o
--      service_role solo llegaban por PUBLIC, al quitárselo a PUBLIC se les
--      concede explícito. Los triggers no necesitan EXECUTE para dispararse,
--      así que solo se cierran.
--   4. Las funciones que cree `postgres` en `public` a partir de ahora ya no
--      reciben nada directo para los roles de la API, como en local: cada
--      migración concede lo que haga falta (y revoca PUBLIC, ver abajo).
--
-- Es idempotente: volver a correrla no cambia nada. La comprobación contra
-- staging después del `db push` está en docs/runbooks/staging-web.md, y
-- supabase/tests/rls.sql vigila el catálogo local.

do $$
declare
  -- Lo que se llama sin sesión: las vistas previas de un enlace compartido y
  -- la página de preferencias de correo por token (app/(public)/**,
  -- core/email). `plan_today` la evalúan policies que también mira anon.
  v_anon constant text[] := array[
    'email_prefs_by_token',
    'get_circle_invite_preview',
    'get_invite_preview',
    'get_shared_plan_preview',
    'plan_today',
    'reactivate_email_cadence_by_token',
    'unsubscribe_email_one_click',
    'update_email_prefs_by_token'
  ];
  -- Colas, correo y administración: service_role o solo otras funciones
  -- SECURITY DEFINER. Devuelven tokens push o direcciones, firman tokens de
  -- baja, nombran staff o mueven las colas.
  v_service_only constant text[] := array[
    'admin_set_flag',
    'admin_set_staff',
    'avatar_url_is_valid',
    'claim_email_outbox_batch',
    'claim_push_outbox_batch',
    'clear_foreign_avatar_urls',
    'email_address_for',
    'email_apply_sunset',
    'email_cadence_hits_today',
    'email_channel_allowed',
    'email_habit_payload',
    'email_hmac_secret',
    'email_local_hour',
    'email_non_t_taken_today',
    'email_opened_app_today',
    'email_outbox_claimable',
    'email_prayed_today',
    'email_refresh_pause_growth',
    'enqueue_all_email_jobs',
    'enqueue_digest_emails',
    'enqueue_drip_emails',
    'enqueue_email',
    'enqueue_habit_emails',
    'enqueue_invite_used',
    'enqueue_winback_emails',
    'ensure_follow',
    'issue_email_prefs_token',
    'mark_email_delivery',
    'mark_push_delivery',
    'pending_push_outbox',
    'purge_expired_rows',
    'push_outbox_claimable',
    'record_email_event',
    'run_email_jobs',
    'run_queue_drains',
    'skip_stale_queue_rows',
    'verify_email_prefs_token',
    'verse_of_the_day_for'
  ];
  f record;
  v_auth boolean;
  v_service boolean;
begin
  for f in
    select p.oid,
           p.oid::regprocedure as sig,
           p.proname::text as name,
           p.prorettype = 'trigger'::regtype as is_trigger
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind in ('f', 'p')
       and not exists (
         select 1 from pg_depend d
          where d.classid = 'pg_proc'::regclass
            and d.objid = p.oid
            and d.deptype = 'e'
       )
  loop
    if f.name = any (v_anon) then
      continue;
    end if;

    v_auth := has_function_privilege('authenticated', f.oid, 'EXECUTE');
    v_service := has_function_privilege('service_role', f.oid, 'EXECUTE');

    execute format('revoke execute on routine %s from public, anon', f.sig);

    if f.name = any (v_service_only) then
      execute format('revoke execute on routine %s from authenticated', f.sig);
    elsif not f.is_trigger
      and v_auth
      and not has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      execute format('grant execute on routine %s to authenticated', f.sig);
    end if;

    if not f.is_trigger
      and v_service
      and not has_function_privilege('service_role', f.oid, 'EXECUTE') then
      execute format('grant execute on routine %s to service_role', f.sig);
    end if;
  end loop;
end;
$$;

-- Los proyectos antiguos añadían los roles de la API en el valor por defecto
-- de `public` (per-schema); aquí se quitan, y `public` queda como en local.
--
-- PUBLIC no se toca: viene del valor por defecto GLOBAL, que un per-schema no
-- puede quitar, y quitarlo en el global cerraría también las funciones que
-- `postgres` crea en `pg_temp` —los helpers `pg_temp.assert` de todas las
-- suites, que se llaman con `set role authenticated`—. Contra PUBLIC sigue
-- valiendo la regla de siempre: cada función nueva lleva su
-- `revoke ... from public`, y rls.sql falla si alguna se lo salta.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
