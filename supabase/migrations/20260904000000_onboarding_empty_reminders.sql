-- Ammen — onboarding puede terminar sin horas de recordatorio.
--
-- El hint de producto ya dice que hoy no se envían avisos. Forzar al menos
-- una hora era deshonesto: la preferencia se guardaba como si fuera a
-- disparar algo. Un array vacío es "no me avises", no un error.
--
-- No activa recordatorios. Solo deja persistir la ausencia.

alter table public.profile_settings
  drop constraint profile_settings_reminder_hours_valid;

alter table public.profile_settings
  add constraint profile_settings_reminder_hours_valid
  check (
    coalesce(array_length(reminder_hours, 1), 0) between 0 and 3
    and reminder_hours <@ array[
      0,1,2,3,4,5,6,7,8,9,10,11,
      12,13,14,15,16,17,18,19,20,21,22,23
    ]::smallint[]
  );

create or replace function public.complete_onboarding(
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
  v_reminder_hours smallint[] := coalesce(p_reminder_hours, array[]::smallint[]);
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  update public.profiles
     set display_name = coalesce(nullif(btrim(p_display_name), ''), display_name)
   where id = current_user_id;

  update public.profile_settings
     set onboarding_answers = p_answers,
         timezone = coalesce(nullif(btrim(p_timezone), ''), timezone),
         reminder_hours = v_reminder_hours,
         locale = coalesce(nullif(btrim(p_locale), ''), locale)
   where id = current_user_id
  returning * into settings;

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
