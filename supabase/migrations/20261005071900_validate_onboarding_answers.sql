-- Barrido de seguridad (2026-10-05): `complete_onboarding` guardaba `p_answers`
-- tal cual llegaba, sin mirar ni la forma ni el tamaño.
--
-- Ese jsonb acaba en dos sitios que confían en él: el prompt del generador
-- (`generate-prayer-plan`, que filtra lo que reconoce) y los correos
-- (`gender` en `copy.ts` y en el payload de bienvenida). Un objeto gigante o
-- con claves inventadas no rompe nada hoy, pero es superficie abierta: un
-- cliente a mano puede guardar megabytes por cuenta o colar claves que un
-- consumidor futuro lea sin filtrar.
--
-- La validación es de forma y tamaño, no de catálogo: qué claves, qué tipos
-- y cuánto ocupa. La pertenencia al catálogo (qué `topics` existen) ya la
-- filtran `sanitizeOnboardingAnswers` en la lectura y el prompt en la
-- generación; duplicar las listas aquí sería una tercera copia que derivaría
-- (ver `core/onboarding/options.ts`).
--
-- Lo que la app manda (`app/(onboarding)/bienvenida.tsx`) cabe de sobra:
-- `seasons`, `topics`, `gender`, `custom_topic` (máx 200 en cliente),
-- `reminder_keys` y el `season` singular heredado. Falla cerrado con
-- excepción, como el resto de la función.
--
-- Idempotente: `create or replace` en la función y en la validadora; la firma
-- no cambia, así que no hay que reemitir grants.

create or replace function public.validate_onboarding_answers(p_answers jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  allowed text[] := array[
    'seasons', 'season', 'topics', 'custom_topic', 'gender', 'reminder_keys'
  ];
  key text;
  value jsonb;
  element jsonb;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'onboarding answers must be a JSON object';
  end if;

  if pg_column_size(p_answers) > 8192 then
    raise exception 'onboarding answers exceed 8 KiB';
  end if;

  for key, value in
    select * from jsonb_each(p_answers)
  loop
    -- Un nulo JSON es lo mismo que ausente: la app manda
    -- `custom_topic: null` cuando no hay texto libre.
    if jsonb_typeof(value) = 'null' then
      continue;
    end if;

    if not (key = any (allowed)) then
      raise exception 'unknown onboarding answer key: %', key;
    end if;

    case key
      when 'custom_topic' then
        if jsonb_typeof(value) <> 'string' then
          raise exception 'custom_topic must be text or null';
        end if;
        if char_length(value #>> '{}') > 500 then
          raise exception 'custom_topic exceeds 500 characters';
        end if;
      when 'gender' then
        if jsonb_typeof(value) <> 'string' then
          raise exception 'gender must be text or null';
        end if;
        if char_length(value #>> '{}') > 32 then
          raise exception 'gender exceeds 32 characters';
        end if;
      when 'season' then
        -- La forma de una sola temporada, anterior al multiselect: se sigue
        -- leyendo (`OnboardingAnswers.season`), así que se sigue aceptando.
        if jsonb_typeof(value) <> 'string' then
          raise exception 'season must be text or null';
        end if;
        if char_length(value #>> '{}') > 64 then
          raise exception 'season exceeds 64 characters';
        end if;
      else
        -- 'seasons', 'topics', 'reminder_keys': arrays de claves o nulo.
        if jsonb_typeof(value) <> 'array' then
          raise exception '% must be an array or null', key;
        end if;
        if jsonb_array_length(value) > 32 then
          raise exception '% exceeds 32 entries', key;
        end if;
        for element in
          select * from jsonb_array_elements(value)
        loop
          if jsonb_typeof(element) <> 'string' then
            raise exception '% entries must be text', key;
          end if;
          if char_length(element #>> '{}') > 64 then
            raise exception '% entries exceed 64 characters', key;
          end if;
        end loop;
    end case;
  end loop;
end;
$$;

revoke execute on function public.validate_onboarding_answers(jsonb)
  from public, anon, authenticated;

create or replace function public.complete_onboarding(
  p_display_name text,
  p_answers jsonb,
  p_timezone text default 'UTC',
  p_reminder_hours smallint[] default array[8]::smallint[],
  p_locale text default 'es',
  p_email_cadence public.email_cadence default null
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
  v_pending_share text;
  v_pending_invite text;
  v_first text;
  v_locale text;
  v_payload jsonb := '{}'::jsonb;
  v_circle text;
  v_who text;
  v_plan text;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  -- Antes de escribir nada: lo que no tiene forma válida no se guarda.
  perform public.validate_onboarding_answers(p_answers);

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

  v_pending_share := settings.pending_share_token;
  v_pending_invite := settings.pending_invite_code;

  if p_email_cadence is not null then
    insert into public.email_preferences (user_id, cadence)
    values (current_user_id, p_email_cadence)
    on conflict (user_id) do update
      set cadence = excluded.cadence;
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

  v_first := split_part(btrim(coalesce(p_display_name, '')), ' ', 1);
  v_locale := coalesce(nullif(btrim(p_locale), ''), 'es');

  v_payload := jsonb_build_object(
    'first_name', nullif(v_first, ''),
    'gender', p_answers ->> 'gender'
  );

  if v_pending_invite is not null then
    select pr.display_name into v_who
      from public.invites i
      join public.profiles pr on pr.id = i.inviter_id
     where i.code = v_pending_invite;
    if v_who is not null then
      v_payload := v_payload || jsonb_build_object('inviter_name', v_who);
    end if;
  end if;

  if v_pending_share is not null then
    select g.name, pr.display_name
      into v_circle, v_who
      from public.groups g
      join public.profiles pr on pr.id = g.owner_id
     where g.invite_token = v_pending_share;
    if v_circle is not null then
      v_payload := v_payload || jsonb_build_object(
        'circle_name', v_circle,
        'inviter_name', v_who
      );
    else
      select pl.title, pr.display_name
        into v_plan, v_who
        from public.share_links sl
        join public.prayer_plans pl on pl.id = sl.plan_id
        join public.profiles pr on pr.id = pl.owner_id
       where sl.token = v_pending_share
         and sl.scope = 'plan';
      if v_plan is not null then
        v_payload := v_payload || jsonb_build_object(
          'plan_title', v_plan,
          'inviter_name', v_who
        );
      end if;
    end if;
  end if;

  perform public.enqueue_email(
    'welcome',
    public.email_address_for(current_user_id),
    current_user_id,
    v_locale,
    'T',
    v_payload,
    'welcome/' || current_user_id::text,
    now()
  );

  return jsonb_build_object('ok', true, 'redeemed', redeemed);
end;
$$;
