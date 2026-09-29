-- Ammen — crons de correo: hábito, digest, drip, win-back, invitaciones.
--
-- Depende de `20260908100000_email_lifecycle.sql`. Cada job pregunta «¿sigue
-- sin X?» y encola con idempotencia; no programa 30 días a ciegas en Resend
-- (cancelar un scheduledId es irreversible).
--
-- El drain (send-email) es otra pieza. Aquí solo se escribe el outbox.
-- pg_cron se intenta al final: si la extensión no está, los jobs se invocan
-- a mano (`npm run email:enqueue`) o desde la Edge Function enqueue-emails.

-- ---------------------------------------------------------------------------
-- Versículo para un usuario concreto (el RPC actual usa auth.uid())
-- ---------------------------------------------------------------------------

create function public.verse_of_the_day_for(p_user uuid)
returns table (
  book_id smallint,
  book_name text,
  chapter smallint,
  verse smallint,
  reference text,
  text text
)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (
    select public.local_today(p_user) as day
  ),
  pick as (
    select d.*
    from public.daily_verses d, today t
    where d.ord = 1 + (
      ((select t.day from today t) - date '2026-01-01')
      % (select count(*) from public.daily_verses)
    )
  )
  select
    p.book_id,
    b.modern_name,
    p.chapter,
    p.verse,
    b.modern_name || ' ' || p.chapter || ':' || p.verse,
    v.text
  from pick p
  join public.bible_books b on b.id = p.book_id
  join public.bible_verses v
    on v.book_id = p.book_id and v.chapter = p.chapter and v.verse = p.verse;
$$;

revoke execute on function public.verse_of_the_day_for(uuid)
  from public, anon, authenticated;
grant execute on function public.verse_of_the_day_for(uuid) to service_role;

create function public.email_local_hour(p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
begin
  select ps.timezone into tz
    from public.profile_settings ps
   where ps.id = p_user;

  if tz is null or btrim(tz) = '' then
    tz := 'UTC';
  end if;

  return extract(hour from (now() at time zone tz))::integer;
exception
  when others then
    return extract(hour from (now() at time zone 'UTC'))::integer;
end;
$$;

revoke execute on function public.email_local_hour(uuid)
  from public, anon, authenticated;
grant execute on function public.email_local_hour(uuid) to service_role;

create function public.email_cadence_hits_today(
  p_cadence public.email_cadence,
  p_user uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dow integer;
  tz text;
begin
  if p_cadence = 'off' then
    return false;
  end if;

  select timezone into tz from public.profile_settings where id = p_user;
  tz := coalesce(nullif(btrim(tz), ''), 'UTC');

  begin
    dow := extract(isodow from (now() at time zone tz))::integer;
  exception when others then
    dow := extract(isodow from (now() at time zone 'UTC'))::integer;
  end;

  if p_cadence = 'daily' then
    return true;
  end if;

  if p_cadence = 'weekdays' then
    return dow between 1 and 5;
  end if;

  -- weekly = domingo
  return dow = 7;
end;
$$;

revoke execute on function public.email_cadence_hits_today(public.email_cadence, uuid)
  from public, anon, authenticated;
grant execute on function public.email_cadence_hits_today(public.email_cadence, uuid)
  to service_role;

create function public.email_opened_app_today(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.last_seen_at is not null
        and public.local_today(p_user)
            = (p.last_seen_at at time zone coalesce(
                 nullif(btrim(s.timezone), ''), 'UTC'
               ))::date
       from public.profiles p
       join public.profile_settings s on s.id = p.id
      where p.id = p_user),
    false
  );
$$;

revoke execute on function public.email_opened_app_today(uuid)
  from public, anon, authenticated;
grant execute on function public.email_opened_app_today(uuid) to service_role;

create function public.email_prayed_today(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pr.streak_last_day = public.local_today(p_user)
       from public.profiles pr
      where pr.id = p_user),
    false
  );
$$;

revoke execute on function public.email_prayed_today(uuid)
  from public, anon, authenticated;
grant execute on function public.email_prayed_today(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Payload de hábito: versículo + día de plan, nunca el cuerpo de la oración
-- ---------------------------------------------------------------------------

create function public.email_habit_payload(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ref text;
  v_text text;
  v_first text;
  v_gender text;
  v_day integer;
  v_title text;
  v_streak_risk boolean := false;
  v_yesterday date;
begin
  select v.reference, v.text
    into v_ref, v_text
    from public.verse_of_the_day_for(p_user) v;

  select split_part(btrim(pr.display_name), ' ', 1),
         s.onboarding_answers ->> 'gender'
    into v_first, v_gender
    from public.profiles pr
    join public.profile_settings s on s.id = pr.id
   where pr.id = p_user;

  select d.day_number, pl.title
    into v_day, v_title
    from public.profile_settings s
    join public.prayer_plans pl on pl.id = s.active_plan_id
    join public.prayer_plan_days d on d.plan_id = pl.id
   where s.id = p_user
     and pl.status = 'active'
     and d.unlock_date = public.local_today(p_user)
     and not exists (
       select 1 from public.prayer_logs l
        where l.user_id = p_user and l.plan_day_id = d.id
     )
   order by d.day_number
   limit 1;

  v_yesterday := public.local_today(p_user) - 1;
  select exists (
    select 1 from public.profiles pr
     where pr.id = p_user
       and pr.streak_last_day = v_yesterday
       and pr.streak_count > 0
  ) into v_streak_risk;

  return jsonb_strip_nulls(jsonb_build_object(
    'first_name', nullif(v_first, ''),
    'gender', v_gender,
    'verse_ref', v_ref,
    'verse_text', v_text,
    'plan_day', v_day,
    'plan_title', v_title,
    'streak_at_risk', v_streak_risk
  ));
end;
$$;

revoke execute on function public.email_habit_payload(uuid)
  from public, anon, authenticated;
grant execute on function public.email_habit_payload(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Ola C — hábito diario
-- ---------------------------------------------------------------------------

create function public.enqueue_habit_emails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
  v_hour integer;
  v_target integer;
  v_today date;
begin
  for r in
    select
      p.id as user_id,
      e.cadence,
      s.locale,
      s.reminder_hours,
      public.email_address_for(p.id) as email
    from public.email_preferences e
    join public.profiles p on p.id = e.user_id
    join public.profile_settings s on s.id = p.id
    where e.cadence <> 'off'
      and public.email_cadence_hits_today(e.cadence, p.id)
  loop
    if r.email is null then
      continue;
    end if;

    if public.email_prayed_today(r.user_id)
       or public.email_opened_app_today(r.user_id) then
      continue;
    end if;

    v_hour := public.email_local_hour(r.user_id);
    v_target := coalesce(r.reminder_hours[1], 8);
    if v_hour <> v_target then
      continue;
    end if;

    v_today := public.local_today(r.user_id);

    if public.enqueue_email(
      'habit',
      r.email,
      r.user_id,
      r.locale,
      'P',
      public.email_habit_payload(r.user_id),
      'habit/' || r.user_id::text || '/' || v_today::text,
      now()
    ) is not null then
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

revoke execute on function public.enqueue_habit_emails()
  from public, anon, authenticated;
grant execute on function public.enqueue_habit_emails() to service_role;

-- ---------------------------------------------------------------------------
-- Ola D — digest social (~20:00 local)
-- ---------------------------------------------------------------------------

create function public.enqueue_digest_emails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
  v_today date;
  v_names text[];
  v_count integer;
  v_joins integer;
  v_first text;
begin
  for r in
    select
      p.id as user_id,
      s.locale,
      public.email_address_for(p.id) as email,
      split_part(btrim(p.display_name), ' ', 1) as first_name
    from public.email_preferences e
    join public.profiles p on p.id = e.user_id
    join public.profile_settings s on s.id = p.id
    where e.social
  loop
    if r.email is null then
      continue;
    end if;

    if public.email_local_hour(r.user_id) <> 20 then
      continue;
    end if;

    v_today := public.local_today(r.user_id);

    -- Ya vio avisos hoy: el digest no aporta.
    if exists (
      select 1 from public.notifications n2
       where n2.user_id = r.user_id
         and n2.read_at is not null
         and (n2.read_at at time zone coalesce(
           (select timezone from public.profile_settings where id = r.user_id),
           'UTC'
         ))::date = v_today
    ) then
      continue;
    end if;

    select coalesce(array_agg(distinct pr.display_name), array[]::text[]),
           count(distinct i.intercessor_id)
      into v_names, v_count
      from public.intercessions i
      join public.profiles pr on pr.id = i.intercessor_id
     where i.plan_owner_id = r.user_id
       and public.local_today(r.user_id)
           = (i.created_at at time zone coalesce(
                (select timezone from public.profile_settings where id = r.user_id),
                'UTC'
              ))::date
       and not exists (
         select 1 from public.blocks b
          where b.blocker_id = r.user_id and b.blocked_id = i.intercessor_id
       );

    select count(*) into v_joins
      from public.group_members m
      join public.groups g on g.id = m.group_id
     where g.owner_id = r.user_id
       and m.user_id <> r.user_id
       and m.role = 'member'
       and (m.joined_at at time zone coalesce(
              (select timezone from public.profile_settings where id = r.user_id),
              'UTC'
            ))::date = v_today;

    if coalesce(v_count, 0) = 0 and coalesce(v_joins, 0) = 0 then
      continue;
    end if;

    v_first := nullif(r.first_name, '');

    if public.enqueue_email(
      'digest_social',
      r.email,
      r.user_id,
      r.locale,
      'S',
      jsonb_strip_nulls(jsonb_build_object(
        'first_name', v_first,
        'names', to_jsonb(v_names),
        'count', v_count,
        'joins', v_joins
      )),
      'digest/' || r.user_id::text || '/' || v_today::text,
      now()
    ) is not null then
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

revoke execute on function public.enqueue_digest_emails()
  from public, anon, authenticated;
grant execute on function public.enqueue_digest_emails() to service_role;

-- ---------------------------------------------------------------------------
-- Ola D — drip condicional D1 / D2 / D3 / D7
-- ---------------------------------------------------------------------------

create function public.enqueue_drip_emails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
  v_age integer;
  v_prayed integer;
  v_circles integer;
  v_follows integer;
  v_plans integer;
  v_onboarded boolean;
begin
  for r in
    select
      p.id as user_id,
      p.created_at,
      s.locale,
      s.onboarding_answers,
      e.cadence,
      public.email_address_for(p.id) as email,
      split_part(btrim(p.display_name), ' ', 1) as first_name
    from public.profiles p
    join public.profile_settings s on s.id = p.id
    left join public.email_preferences e on e.user_id = p.id
  loop
    if r.email is null then
      continue;
    end if;

    v_age := (now()::date - r.created_at::date);
    v_onboarded := r.onboarding_answers is not null;

    select count(*) into v_prayed
      from public.prayer_logs l where l.user_id = r.user_id;

    -- D2: cuenta + términos, sin complete_onboarding. Canal T.
    if v_age >= 2 and not v_onboarded then
      if public.enqueue_email(
        'drip_d2',
        r.email,
        r.user_id,
        r.locale,
        'T',
        jsonb_build_object('first_name', nullif(r.first_name, '')),
        'drip_d2/' || r.user_id::text,
        now()
      ) is not null then
        n := n + 1;
      end if;
      continue;
    end if;

    if not v_onboarded then
      continue;
    end if;

    -- D1: no ha marcado ningún día.
    if v_age >= 1 and v_prayed = 0 then
      if public.enqueue_email(
        'drip_d1',
        r.email,
        r.user_id,
        r.locale,
        'P',
        jsonb_build_object('first_name', nullif(r.first_name, '')),
        'drip_d1/' || r.user_id::text,
        now()
      ) is not null then
        n := n + 1;
      end if;
    end if;

    -- D3: tiene plan, 0 días orados.
    select count(*) into v_plans
      from public.prayer_plans pl
     where pl.owner_id = r.user_id
       and pl.status in ('active', 'generating');

    if v_age >= 3 and v_plans > 0 and v_prayed = 0 then
      if public.enqueue_email(
        'drip_d3',
        r.email,
        r.user_id,
        r.locale,
        'P',
        jsonb_build_object('first_name', nullif(r.first_name, '')),
        'drip_d3/' || r.user_id::text,
        now()
      ) is not null then
        n := n + 1;
      end if;
    end if;

    -- D7: 0 círculos y 0 follows. (Cuota de planes no usada: no empujar Plus.)
    select count(*) into v_circles
      from public.group_members m where m.user_id = r.user_id;
    select count(*) into v_follows
      from public.follows f where f.follower_id = r.user_id;

    if v_age >= 7 and v_circles = 0 and v_follows = 0 then
      if public.enqueue_email(
        'drip_d7',
        r.email,
        r.user_id,
        r.locale,
        'G',
        jsonb_build_object('first_name', nullif(r.first_name, '')),
        'drip_d7/' || r.user_id::text,
        now()
      ) is not null then
        n := n + 1;
      end if;
    end if;
  end loop;

  return n;
end;
$$;

revoke execute on function public.enqueue_drip_emails()
  from public, anon, authenticated;
grant execute on function public.enqueue_drip_emails() to service_role;

-- ---------------------------------------------------------------------------
-- Ola E — win-back D3 / D7 / D14 / D30 + sunset + higiene 90d
-- ---------------------------------------------------------------------------

create function public.enqueue_winback_emails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
  v_idle integer;
  v_template text;
  v_channel text := 'G';
  v_payload jsonb;
begin
  for r in
    select
      p.id as user_id,
      p.last_seen_at,
      s.locale,
      e.nudge,
      e.cadence,
      public.email_address_for(p.id) as email,
      split_part(btrim(p.display_name), ' ', 1) as first_name
    from public.email_preferences e
    join public.profiles p on p.id = e.user_id
    join public.profile_settings s on s.id = p.id
    where e.nudge
      and p.last_seen_at is not null
  loop
    if r.email is null then
      continue;
    end if;

    -- 90 días: recortar campañas, no reenganchar.
    if r.last_seen_at < now() - interval '90 days' then
      continue;
    end if;

    v_idle := (public.local_today(r.user_id)
               - (r.last_seen_at at time zone coalesce(
                    (select timezone from public.profile_settings where id = r.user_id),
                    'UTC'
                  ))::date);

    v_template := null;
    if v_idle = 30 then
      v_template := 'winback_d30';
    elsif v_idle = 14 then
      v_template := 'winback_d14';
    elsif v_idle = 7 then
      v_template := 'winback_d7';
    elsif v_idle = 3 then
      v_template := 'winback_d3';
    end if;

    if v_template is null then
      continue;
    end if;

    v_payload := jsonb_build_object('first_name', nullif(r.first_name, ''));

    if v_template = 'winback_d3' then
      v_payload := v_payload || public.email_habit_payload(r.user_id);
    end if;

    if public.enqueue_email(
      v_template,
      r.email,
      r.user_id,
      r.locale,
      v_channel,
      v_payload,
      v_template || '/' || r.user_id::text,
      now()
    ) is not null then
      n := n + 1;
    end if;

    if v_template = 'winback_d30' then
      update public.email_preferences
         set previous_cadence = cadence,
             sunset_at = now()
       where user_id = r.user_id
         and sunset_at is null;
    end if;
  end loop;

  return n;
end;
$$;

revoke execute on function public.enqueue_winback_emails()
  from public, anon, authenticated;
grant execute on function public.enqueue_winback_emails() to service_role;

-- Si el D30 salió hace ≥7 días y no hubo open/click, apagar cadence y nudge.
create function public.email_apply_sunset()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
begin
  update public.email_preferences e
     set cadence = 'off',
         nudge = false
   where e.sunset_at is not null
     and e.sunset_at < now() - interval '7 days'
     and e.nudge
     and not exists (
       select 1
       from public.email_outbox o
       join public.email_events ev on ev.outbox_id = o.id
       where o.user_id = e.user_id
         and o.template = 'winback_d30'
         and ev.event_type in ('email.opened', 'email.clicked')
     );

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.email_apply_sunset()
  from public, anon, authenticated;
grant execute on function public.email_apply_sunset() to service_role;

-- Bounce > 2% o complaint > 0.05% en 24h → pausar P/G.
create function public.email_refresh_pause_growth()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  sent numeric;
  bounced numeric;
  complained numeric;
  pause boolean := false;
begin
  select count(*) filter (where status = 'sent')::numeric
    into sent
    from public.email_outbox
   where sent_at > now() - interval '24 hours';

  if sent >= 20 then
    select count(*) filter (where event_type = 'email.bounced')::numeric,
           count(*) filter (where event_type = 'email.complained')::numeric
      into bounced, complained
      from public.email_events
     where created_at > now() - interval '24 hours';

    pause := (bounced / sent) > 0.02 or (complained / sent) > 0.0005;
  end if;

  update public.email_runtime set pause_growth = pause, updated_at = now();
  return pause;
end;
$$;

revoke execute on function public.email_refresh_pause_growth()
  from public, anon, authenticated;
grant execute on function public.email_refresh_pause_growth() to service_role;

create function public.enqueue_all_email_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  winback integer;
  habit integer;
  drip integer;
  digest integer;
  sunset integer;
begin
  perform public.email_refresh_pause_growth();
  -- Prioridad: sunset/win-back > hábito > drip > digest.
  sunset := public.email_apply_sunset();
  winback := public.enqueue_winback_emails();
  habit := public.enqueue_habit_emails();
  drip := public.enqueue_drip_emails();
  digest := public.enqueue_digest_emails();

  return jsonb_build_object(
    'winback', winback,
    'habit', habit,
    'drip', drip,
    'digest', digest,
    'sunset', sunset
  );
end;
$$;

revoke execute on function public.enqueue_all_email_jobs()
  from public, anon, authenticated;
grant execute on function public.enqueue_all_email_jobs() to service_role;

-- ---------------------------------------------------------------------------
-- Ola B — invitaciones salientes + «tu invitación se usó»
-- ---------------------------------------------------------------------------

create function public.enqueue_invite_email(
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

  select locale into v_locale from public.profile_settings where id = uid;
  select display_name into v_who from public.profiles where id = uid;

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

  return jsonb_build_object('ok', true, 'outbox_id', v_id);
end;
$$;

revoke execute on function public.enqueue_invite_email(text, text, text) from public;
grant execute on function public.enqueue_invite_email(text, text, text) to authenticated;

create function public.enqueue_invite_used(
  p_inviter uuid,
  p_redeemer uuid,
  p_context text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_who text;
  v_locale text;
  v_email text;
begin
  if p_inviter is null or p_redeemer is null or p_inviter = p_redeemer then
    return;
  end if;

  v_email := public.email_address_for(p_inviter);
  if v_email is null then
    return;
  end if;

  select display_name into v_who from public.profiles where id = p_redeemer;
  select locale into v_locale from public.profile_settings where id = p_inviter;

  perform public.enqueue_email(
    'invite_used',
    v_email,
    p_inviter,
    coalesce(v_locale, 'es'),
    'T',
    jsonb_build_object(
      'redeemer_name', v_who,
      'context', p_context
    ),
    'invite_used/' || p_inviter::text || '/' || p_redeemer::text,
    now()
  );
end;
$$;

revoke execute on function public.enqueue_invite_used(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.enqueue_invite_used(uuid, uuid, text)
  to service_role;

create or replace function public.redeem_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  current_user_id uuid := (select auth.uid());
  first_accept boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into inv
    from public.invites i
   where i.code = p_code;

  if inv is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if inv.inviter_id = current_user_id then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  if inv.accepted_by is null then
    update public.invites
       set accepted_by = current_user_id,
           accepted_at = now()
     where id = inv.id;
    first_accept := true;
  end if;

  perform public.ensure_follow(current_user_id, inv.inviter_id);

  if first_accept then
    perform public.enqueue_invite_used(inv.inviter_id, current_user_id, 'app');
  end if;

  return jsonb_build_object('ok', true, 'inviter_id', inv.inviter_id);
end;
$$;

create or replace function public.redeem_share_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.share_links;
  plan_owner uuid;
  circle_id uuid;
  circle_owner uuid;
  current_user_id uuid := (select auth.uid());
  already boolean;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into link
    from public.share_links sl
   where sl.token = p_token
     and sl.revoked_at is null
     and (sl.expires_at is null or sl.expires_at > now());

  if link is null then
    select g.id, g.owner_id into circle_id, circle_owner
      from public.groups g
     where g.invite_token = p_token;

    if circle_id is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
    end if;

    select exists (
      select 1 from public.group_members m
       where m.group_id = circle_id and m.user_id = current_user_id
    ) into already;

    insert into public.group_members (group_id, user_id, role)
    values (circle_id, current_user_id, 'member')
    on conflict (group_id, user_id) do nothing;

    if not already then
      perform public.enqueue_invite_used(circle_owner, current_user_id, 'circle');
    end if;

    return jsonb_build_object('ok', true, 'scope', 'circle',
                              'circle_id', circle_id);
  end if;

  if link.scope = 'plan' then
    select p.owner_id into plan_owner
      from public.prayer_plans p
     where p.id = link.plan_id;

    if plan_owner is null then
      return jsonb_build_object('ok', false, 'reason', 'plan_missing');
    end if;

    if plan_owner = current_user_id then
      return jsonb_build_object('ok', true, 'scope', 'plan',
                                'plan_id', link.plan_id, 'self', true);
    end if;

    select exists (
      select 1 from public.plan_shares s
       where s.plan_id = link.plan_id and s.shared_with_user_id = current_user_id
    ) into already;

    insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
    values (link.plan_id, current_user_id, plan_owner)
    on conflict do nothing;

    perform public.ensure_follow(current_user_id, plan_owner);

    if not already then
      perform public.enqueue_invite_used(plan_owner, current_user_id, 'plan');
    end if;

    return jsonb_build_object('ok', true, 'scope', 'plan',
                              'plan_id', link.plan_id);
  else
    insert into public.group_members (group_id, user_id, role)
    values (link.group_id, current_user_id, 'member')
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('ok', true, 'scope', 'group',
                              'group_id', link.group_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- pg_cron, si el host lo tiene. Si no, enqueue-emails / email:enqueue.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname in ('ammen-email-jobs', 'ammen-email-drain-hint');

    perform cron.schedule(
      'ammen-email-jobs',
      '*/15 * * * *',
      $job$ select public.enqueue_all_email_jobs(); $job$
    );
  end if;
exception
  when others then
    raise notice 'pg_cron not available: %', sqlerrm;
end;
$$;
