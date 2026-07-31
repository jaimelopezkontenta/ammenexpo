-- Ammen — el onboarding, y el botón que decía que sí sin hacer nada.
--
-- **El fallo.** `complete_onboarding` actualizaba `profile_settings` con un
-- `where id = current_user_id` y **no miraba cuántas filas había tocado**, para
-- terminar con `return jsonb_build_object('ok', true, ...)`. Si esa fila no
-- existe, actualiza cero filas y contesta que todo fue bien.
--
-- Del lado del cliente, `bienvenida.tsx` no navega por su cuenta: lo único que
-- saca a alguien de esa pantalla es que `hasOnboarded` pase a true, que se
-- calcula como `Boolean(settings?.onboarding_answers)`. Sin fila, eso es false
-- para siempre. Pulsas "Crear mi plan", el botón gira, para, y no pasa nada:
-- sin error en pantalla y sin una línea en consola.
--
-- `handle_new_user()` crea la fila de settings en el mismo trigger que la de
-- `profiles`, así que toda cuenta real tiene la suya. Que falte solo significa
-- una cosa: la sesión apunta a un usuario que ya no existe. Eso merece un
-- error, no un onboarding sin salida.

-- ---------------------------------------------------------------------------
-- Varias horas de oración al día
-- ---------------------------------------------------------------------------

-- Se reemplaza la columna en vez de añadir una segunda: dos columnas para el
-- mismo dato es la deriva que este proyecto ya ha pagado dos veces (el chat con
-- dos censos, la hora guardada a la vez como número y como clave). Nada lee
-- `reminder_hour` hoy más que la propia pantalla del perfil — el push todavía
-- no existe — así que migrarla no rompe ningún consumidor.
alter table public.profile_settings
  add column reminder_hours smallint[] not null default array[8]::smallint[];

update public.profile_settings
   set reminder_hours = array[reminder_hour]::smallint[];

-- Las 24 horas escritas a mano: un CHECK no admite subconsultas, así que
-- `array(select generate_series(0, 23))` no vale aquí.
alter table public.profile_settings
  add constraint profile_settings_reminder_hours_valid
  check (
    -- `coalesce`, no `array_length` a secas: para un array vacío devuelve NULL,
    -- y un CHECK que da NULL se considera satisfecho. Sin esto, "ninguna hora"
    -- pasaba la comprobación.
    coalesce(array_length(reminder_hours, 1), 0) between 1 and 3
    and reminder_hours <@ array[
      0,1,2,3,4,5,6,7,8,9,10,11,
      12,13,14,15,16,17,18,19,20,21,22,23
    ]::smallint[]
  );

alter table public.profile_settings drop column reminder_hour;

-- El GRANT es de tabla entera (`grant select, update on public.profile_settings
-- to authenticated`), así que la columna nueva queda cubierta sin tocarlo.

-- ---------------------------------------------------------------------------
-- complete_onboarding
-- ---------------------------------------------------------------------------

-- La firma forma parte del nombre de la función, así que cambiar el parámetro
-- obliga a soltarla, recrearla y **volver a emitir los dos grant**.
drop function public.complete_onboarding(text, jsonb, text, smallint, text);

create function public.complete_onboarding(
  p_display_name text,
  p_answers jsonb,
  p_timezone text default 'UTC',
  p_reminder_hours smallint[] default array[8]::smallint[],
  p_locale text default 'es'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  settings public.profile_settings;
  redeemed jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_reminder_hours is null or array_length(p_reminder_hours, 1) is null then
    raise exception 'at least one reminder hour is required';
  end if;

  update public.profiles
     set display_name = coalesce(nullif(btrim(p_display_name), ''), display_name)
   where id = current_user_id;

  update public.profile_settings
     set onboarding_answers = p_answers,
         timezone = coalesce(nullif(btrim(p_timezone), ''), timezone),
         reminder_hours = p_reminder_hours,
         locale = coalesce(nullif(btrim(p_locale), ''), locale)
   where id = current_user_id
  returning * into settings;

  -- La guarda que faltaba. Es la misma lección que `useUpdateProfile` ya había
  -- aprendido en el cliente —"A row count of zero is how RLS refuses an update:
  -- no error, no rows"— aplicada donde de verdad hacía daño: aquí el silencio
  -- no dejaba una pantalla desactualizada, encerraba a la persona en el
  -- onboarding sin decirle nada.
  if not found then
    raise exception 'profile settings missing for %', current_user_id;
  end if;

  if settings.pending_share_token is not null then
    redeemed := redeemed || jsonb_build_object(
      'share', public.redeem_share_token(settings.pending_share_token));
  end if;

  if settings.pending_invite_code is not null then
    redeemed := redeemed || jsonb_build_object(
      'invite', public.redeem_invite_code(settings.pending_invite_code));
  end if;

  update public.profile_settings
     set pending_share_token = null,
         pending_invite_code = null
   where id = current_user_id;

  return jsonb_build_object('ok', true, 'redeemed', redeemed);
end;
$$;

revoke execute on function
  public.complete_onboarding(text, jsonb, text, smallint[], text) from public;
grant execute on function
  public.complete_onboarding(text, jsonb, text, smallint[], text)
  to authenticated;
