-- Barrido de privilegios, ronda 2 (2026-09-30): de tus ajustes, el cliente
-- escribe lo que eliges tú; los términos, el onboarding y el push, el servidor.
--
-- `20260730100400_grants` concedía `update` de tabla entera sobre
-- `profile_settings`, y la policy solo pide que la fila sea tuya. Con eso,
-- desde la API:
--
--   - Se «aceptaban» los términos sin pasar por `accept_terms` y con la fecha
--     que uno quisiera (`terms_accepted_at = '2020-01-01'`): justo el dato que
--     se enseña si alguien reclama qué aceptó y cuándo.
--   - Se reescribían las respuestas del onboarding, que acaban en el prompt de
--     la generación y en los correos (`email_habit_payload`, el goteo).
--   - Se apuntaba `expo_push_token` al token de otro dispositivo. Hoy ya nadie
--     lo lee —el push sale de `push_devices`, que se registra por
--     `register_push_device`—, pero la columna sigue ahí.
--
-- Lo que queda es lo que la app escribe directamente (core/profile, core/bible,
-- core/plans, core/auth): las horas del recordatorio, la zona horaria, el
-- idioma, la posición de lectura, el plan activo (`validate_active_plan` ya
-- exige que sea tuyo), los tokens que se guardaron antes de tener cuenta (que
-- `complete_onboarding` canjea como TÚ, así que no abren nada que el canje
-- directo no abra) y por dónde llegó la cuenta.
--
-- Las respuestas del onboarding las escribe `complete_onboarding` y el token
-- de push `register_push_device`, las dos SECURITY DEFINER: este GRANT no les
-- afecta. `accept_terms` era SECURITY INVOKER —dependía justo del permiso que
-- aquí se cierra—, así que pasa a DEFINER con la misma regla de siempre (la
-- fecha es `now()` del servidor, la fila es la de `auth.uid()`) y además
-- exige una versión con la forma de `TERMS_VERSION` (`AAAA-MM-DD`, que
-- `core/legal/documents.test.ts` fija en el cliente).
--
-- Idempotente: revocar el privilegio de tabla quita también el de columnas, y
-- la función se reemplaza.

revoke update on public.profile_settings from authenticated;
grant update (
  locale,
  timezone,
  reminder_hours,
  last_read_book_id,
  last_read_chapter,
  last_read_verse,
  last_read_at,
  active_plan_id,
  pending_share_token,
  pending_invite_code,
  signup_source
) on public.profile_settings to authenticated;

create or replace function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'a version is required';
  end if;

  update public.profile_settings
     set terms_version = p_version,
         terms_accepted_at = now()
   where id = v_user;

  -- Sin fila de ajustes no hay nada que aceptar: callarlo dejaría a alguien
  -- dando al botón sin que pase nada.
  if not found then
    raise exception 'profile settings missing';
  end if;
end;
$$;

revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
