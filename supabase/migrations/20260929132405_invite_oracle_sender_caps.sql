-- Revisión adversarial R1 (2026-09-29), S6: invitar por correo no puede
-- servir para preguntar «¿alguien ha invitado ya a esta dirección?».
--
-- `enqueue_invite_email` miraba el tope por destinatario (uno cada 7 días,
-- entre todos los remitentes) ANTES que el de remitente, y respondía
-- `rate_limited` sin gastar cupo: cualquier cuenta con onboarding podía
-- sondear direcciones sin límite y saber si otra persona de Ammen acababa de
-- invitarlas. El dedupe de la misma invitación en la misma semana
-- (`not_enqueued`) también se notaba.
--
-- Ahora:
--   1. Primero los topes que hablan de quien invita (10 al día, 3 el primer
--      día) y el global (200 por hora): esos sí se pueden decir.
--   2. Lo que depende de lo que hicieron otros responde `ok` igual que un
--      envío de verdad, sin `outbox_id`. Si a la dirección ya se le escribió
--      esta semana, se guarda una fila `skipped` (`recipient_recent`) a nombre
--      de quien invita: gasta su cupo como un envío, para que tampoco se
--      pueda deducir contando cuántos «ok» caben en un día.
--
-- El techo real, con la confirmación de email apagada en staging: el tope por
-- remitente se esquiva creando cuentas, así que lo que manda es el global,
-- 200/hora = 4.800 correos al día como mucho, y nunca más de uno por
-- destinatario a la semana. Un tope por dominio frenaría a la vez a todo
-- gmail.com; se deja documentado en el runbook en vez de añadirlo.

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
  v_key text;
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

  -- 1. Lo que depende solo de quien invita, o de todos a la vez.
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

  v_key := 'invite/' || p_kind || '/' || p_token || '/' || v_email
           || '/' || to_char(now(), 'IYYY-"W"IW');

  -- 2. Lo que depende de otros: la misma respuesta que un envío.
  if exists (
    select 1 from public.email_outbox o
     where o.to_email = v_email
       and o.template in ('invite_app', 'invite_circle', 'invite_plan')
       and o.status in ('pending', 'sent')
       and o.created_at > now() - interval '7 days'
  ) then
    insert into public.email_outbox (
      template, locale, to_email, user_id, channel, payload,
      idempotency_key, status, last_error, invited_by
    ) values (
      v_template, case when coalesce(v_locale, 'es') like 'en%' then 'en' else 'es' end,
      v_email, null, 'S', '{}'::jsonb,
      v_key, 'skipped', 'recipient_recent', uid
    )
    on conflict (idempotency_key) do nothing;

    return jsonb_build_object('ok', true);
  end if;

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
    v_key,
    now()
  );

  if v_id is not null then
    update public.email_outbox set invited_by = uid where id = v_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.enqueue_invite_email(text, text, text) from public, anon;
grant execute on function public.enqueue_invite_email(text, text, text) to authenticated;
