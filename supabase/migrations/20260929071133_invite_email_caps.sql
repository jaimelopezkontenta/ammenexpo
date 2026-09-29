-- Oleada 1a de la auditoría (2026-09-29): puertas antes de encender las colas.
--
-- `enqueue_invite_email` limitaba a un correo por destinatario cada 7 días,
-- pero no por remitente: con la confirmación de email apagada, una cuenta
-- recién creada podía mandar correo con la marca de ammen a cualquier
-- dirección, una detrás de otra. Hoy no sale nada porque nadie drena la cola;
-- el día que se encienda, esto tiene que estar ya.

-- ---------------------------------------------------------------------------
-- Quién invita, en la fila
--
-- `user_id` es el destinatario (y en una invitación no es usuario), así que
-- no había forma de contar por remitente.
-- ---------------------------------------------------------------------------
alter table public.email_outbox
  add column if not exists invited_by uuid
    references public.profiles (id) on delete set null;

create index if not exists email_outbox_invited_by_recent_idx
  on public.email_outbox (invited_by, created_at)
  where invited_by is not null;

create index if not exists email_outbox_invites_recent_idx
  on public.email_outbox (created_at)
  where template in ('invite_app', 'invite_circle', 'invite_plan');

-- ---------------------------------------------------------------------------
-- El nombre, acotado
--
-- Viaja en el asunto y el cuerpo de las invitaciones. Perfil ya limita el
-- campo a 80; la base no limitaba nada. `not valid`: no revalida filas
-- antiguas de un entorno remoto, pero sí todo lo que se escriba desde ya.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_display_name_length;

alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) <= 80) not valid;

-- ---------------------------------------------------------------------------
-- enqueue_invite_email con topes
--
-- - Solo quien terminó el onboarding invita por correo.
-- - Por remitente: 10 al día, o 3 si la cuenta tiene menos de 24 horas. No se
--   bloquea a la cuenta nueva: invitar a los tuyos al llegar es justo el
--   momento que más importa; solo se le pone un techo más bajo.
-- - Global: 200 invitaciones por hora entre todos, para que un abuso no queme
--   la reputación del dominio antes de que alguien lo vea.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_invite_email(
  p_kind text,
  p_to_email text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_to_email, '')));
  v_template text;
  v_who text;
  v_circle text;
  v_plan text;
  v_locale text := 'es';
  v_id uuid;
  v_week text;
  v_since timestamptz;
  v_sender_cap integer;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email');
  end if;

  if p_kind not in ('app', 'circle', 'plan') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  end if;

  if not exists (
    select 1 from public.profile_settings ps
     where ps.id = uid and ps.onboarding_answers is not null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_onboarded');
  end if;

  select locale into v_locale from public.profile_settings where id = uid;
  select display_name, created_at into v_who, v_since
    from public.profiles where id = uid;

  if p_kind = 'app' then
    if not exists (
      select 1 from public.invites i
       where i.code = p_token and i.inviter_id = uid
    ) then
      return jsonb_build_object('ok', false, 'reason', 'not_owner');
    end if;
    v_template := 'invite_app';
  elsif p_kind = 'circle' then
    select g.name into v_circle
      from public.groups g
      join public.group_members m on m.group_id = g.id
     where g.invite_token = p_token
       and m.user_id = uid
       and m.role in ('owner', 'admin');
    if v_circle is null then
      return jsonb_build_object('ok', false, 'reason', 'not_owner');
    end if;
    v_template := 'invite_circle';
  else
    select pl.title into v_plan
      from public.share_links sl
      join public.prayer_plans pl on pl.id = sl.plan_id
     where sl.token = p_token
       and sl.scope = 'plan'
       and sl.revoked_at is null
       and pl.owner_id = uid;
    if v_plan is null then
      return jsonb_build_object('ok', false, 'reason', 'not_owner');
    end if;
    v_template := 'invite_plan';
  end if;

  -- Los topes se cuentan con el remitente serializado: dos pestañas pulsando
  -- a la vez no pueden colarse las dos por debajo del techo.
  perform pg_advisory_xact_lock(hashtextextended('invite_email:' || uid::text, 0));

  -- Tope: 1 mail de «te invitaron» por destinatario cada 7 días.
  if exists (
    select 1 from public.email_outbox o
     where o.to_email = v_email
       and o.template in ('invite_app', 'invite_circle', 'invite_plan')
       and o.status in ('pending', 'sent')
       and o.created_at > now() - interval '7 days'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  v_sender_cap := case
    when v_since > now() - interval '24 hours' then 3
    else 10
  end;

  if (
    select count(*) from public.email_outbox o
     where o.invited_by = uid
       and o.created_at > now() - interval '24 hours'
  ) >= v_sender_cap then
    return jsonb_build_object('ok', false, 'reason', 'sender_rate_limited');
  end if;

  if (
    select count(*) from public.email_outbox o
     where o.template in ('invite_app', 'invite_circle', 'invite_plan')
       and o.created_at > now() - interval '1 hour'
  ) >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'global_rate_limited');
  end if;

  v_week := to_char(now(), 'IYYY-"W"IW');

  v_id := public.enqueue_email(
    v_template,
    v_email,
    null,
    coalesce(v_locale, 'es'),
    'S',
    jsonb_strip_nulls(jsonb_build_object(
      'inviter_name', v_who,
      'circle_name', v_circle,
      'plan_title', v_plan,
      'token', p_token
    )),
    'invite/' || p_kind || '/' || p_token || '/' || v_email || '/' || v_week,
    now()
  );

  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_enqueued');
  end if;

  update public.email_outbox set invited_by = uid where id = v_id;

  return jsonb_build_object('ok', true, 'outbox_id', v_id);
end;
$$;

revoke execute on function public.enqueue_invite_email(text, text, text) from public;
grant execute on function public.enqueue_invite_email(text, text, text) to authenticated;
