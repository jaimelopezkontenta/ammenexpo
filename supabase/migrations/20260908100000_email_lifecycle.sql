-- Ammen — correo como canal de producto (ola A).
--
-- El aviso diario hoy es nativo y no corre en web; las invitaciones solo
-- viajan por la hoja de compartir; no hay last_seen_at para reenganchar.
-- Este archivo construye el buzón, las preferencias que la persona ve, el
-- heartbeat y las RPC de envío — el mismo patrón que push_outbox
-- (claim/lease/retry), no un motor de journeys en Resend.
--
-- **Qué se construye.** Tablas, suppressions, last_seen_at, cadencia, el
-- helper que encola con idempotencia, el claim con lease, la baja por token
-- firmado, bienvenida al terminar el onboarding y el mail de waitlist.
-- **Qué se deja para el siguiente archivo.** Los crons de hábito, digest,
-- drip y win-back: necesitan este modelo, no al revés.
--
-- El sender vive en `supabase/functions/send-email/`. La clave de Resend
-- nunca entra aquí ni en el cliente Expo.

-- ---------------------------------------------------------------------------
-- last_seen_at — sin esto el win-back es ciego
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'Heartbeat desde la app (throttled). Lo escribe heartbeat_last_seen(), nunca el cliente a pelo.';

-- Cuentas ya existentes: no reenganchar a todo el mundo el día 1. Quien no
-- ha abierto desde que existía last_seen se trata como vista ahora.
update public.profiles
   set last_seen_at = coalesce(updated_at, created_at, now())
 where last_seen_at is null;

-- ---------------------------------------------------------------------------
-- email_preferences — lo que la persona elige, no canales de ingeniería
-- ---------------------------------------------------------------------------

create type public.email_cadence as enum ('daily', 'weekdays', 'weekly', 'off');

create table public.email_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  cadence public.email_cadence not null default 'daily',
  social boolean not null default true,
  nudge boolean not null default true,
  -- Lo que había antes del sunset D30, para reactivar con un toque.
  previous_cadence public.email_cadence,
  sunset_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger email_preferences_set_updated_at
  before update on public.email_preferences
  for each row execute function public.set_updated_at();

alter table public.email_preferences enable row level security;

revoke all on public.email_preferences from anon, authenticated, service_role;
grant select, update, insert on public.email_preferences to authenticated;
grant all on public.email_preferences to service_role;

create policy "tu cadencia es tuya"
  on public.email_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "editas tu cadencia"
  on public.email_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "creas tu cadencia"
  on public.email_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Cuentas viejas: cadence off (warm-up: no blast). Altas nuevas: daily, y el
-- onboarding lo pisa a off en nativo.
insert into public.email_preferences (user_id, cadence)
select p.id, 'off'::public.email_cadence
from public.profiles p
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- email_runtime — secreto HMAC y cortacircuitos, nunca al cliente
-- ---------------------------------------------------------------------------

create table public.email_runtime (
  id boolean primary key default true check (id),
  hmac_secret text not null,
  pause_growth boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.email_runtime enable row level security;
revoke all on public.email_runtime from anon, authenticated, service_role;
grant select, update on public.email_runtime to service_role;

insert into public.email_runtime (hmac_secret)
values (encode(extensions.gen_random_bytes(32), 'hex'));

create function public.email_hmac_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select hmac_secret from public.email_runtime where id;
$$;

revoke execute on function public.email_hmac_secret() from public, anon, authenticated;
grant execute on function public.email_hmac_secret() to service_role;

-- ---------------------------------------------------------------------------
-- email_suppressions — bounce / complaint: no volver a encolar
-- ---------------------------------------------------------------------------

create table public.email_suppressions (
  email text primary key,
  reason text not null check (reason in ('bounce', 'complaint', 'manual')),
  created_at timestamptz not null default now()
);

alter table public.email_suppressions enable row level security;
revoke all on public.email_suppressions from anon, authenticated, service_role;
grant select, insert, update on public.email_suppressions to service_role;

-- ---------------------------------------------------------------------------
-- email_outbox — espejo de push_outbox: una fila, un envío, reintentar es
-- tocar esta fila, no crear otra.
-- ---------------------------------------------------------------------------

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  template text not null
    check (template in (
      'welcome', 'waitlist', 'habit',
      'invite_app', 'invite_circle', 'invite_plan', 'invite_used',
      'digest_social',
      'drip_d1', 'drip_d2', 'drip_d3', 'drip_d7',
      'winback_d3', 'winback_d7', 'winback_d14', 'winback_d30'
    )),
  locale text not null default 'es',
  to_email text not null,
  user_id uuid references public.profiles (id) on delete set null,
  channel text not null check (channel in ('T', 'P', 'S', 'G')),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  resend_id text,
  next_attempt_at timestamptz not null default now(),
  leased_until timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index email_outbox_claimable_idx
  on public.email_outbox (next_attempt_at)
  where status = 'pending';

create index email_outbox_user_day_idx
  on public.email_outbox (user_id, created_at)
  where channel <> 'T';

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated, service_role;
grant select, insert, update on public.email_outbox to service_role;

-- La oración en 1ª persona no viaja por correo. El versículo (dominio público)
-- sí; el cuerpo del plan, no.
create function public.email_outbox_forbid_prayer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payload ?| array[
    'prayer_body', 'prayer_text', 'daily_action', 'interpretation', 'note'
  ] then
    raise exception 'email payload must not contain first-person prayer text';
  end if;
  return new;
end;
$$;

create trigger email_outbox_forbid_prayer
  before insert or update of payload on public.email_outbox
  for each row execute function public.email_outbox_forbid_prayer();

-- ---------------------------------------------------------------------------
-- email_events — webhooks Resend, deduplicados por svix-id
-- ---------------------------------------------------------------------------

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null unique,
  event_type text not null,
  resend_id text,
  outbox_id uuid references public.email_outbox (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.email_events enable row level security;
revoke all on public.email_events from anon, authenticated, service_role;
grant select, insert on public.email_events to service_role;

-- ---------------------------------------------------------------------------
-- Token firmado de preferencias (baja sin sesión, RFC 8058)
-- ---------------------------------------------------------------------------

create function public.issue_email_prefs_token(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  secret text := public.email_hmac_secret();
  uid text := replace(p_user::text, '-', '');
begin
  if p_user is null or secret is null then
    return null;
  end if;
  return uid || '.' || encode(
    extensions.hmac(uid, secret, 'sha256'),
    'hex'
  );
end;
$$;

revoke execute on function public.issue_email_prefs_token(uuid)
  from public, anon, authenticated;
grant execute on function public.issue_email_prefs_token(uuid) to service_role;

-- El dueño puede pedir el suyo: el pie del mail y la pantalla /correo lo
-- construyen igual. No revela el secreto; solo el token de esa cuenta.
create function public.issue_my_email_prefs_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.issue_email_prefs_token((select auth.uid()));
$$;

revoke execute on function public.issue_my_email_prefs_token() from public;
grant execute on function public.issue_my_email_prefs_token() to authenticated;

create function public.verify_email_prefs_token(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  secret text := public.email_hmac_secret();
  uid_hex text;
  sig text;
  expected text;
  user_id uuid;
begin
  if p_token is null or position('.' in p_token) = 0 then
    return null;
  end if;

  uid_hex := split_part(p_token, '.', 1);
  sig := split_part(p_token, '.', 2);

  if char_length(uid_hex) <> 32 or char_length(sig) < 32 then
    return null;
  end if;

  expected := encode(extensions.hmac(uid_hex, secret, 'sha256'), 'hex');
  if expected is distinct from sig then
    return null;
  end if;

  begin
    user_id := (
      substr(uid_hex, 1, 8) || '-' ||
      substr(uid_hex, 9, 4) || '-' ||
      substr(uid_hex, 13, 4) || '-' ||
      substr(uid_hex, 17, 4) || '-' ||
      substr(uid_hex, 21, 12)
    )::uuid;
  exception when others then
    return null;
  end;

  if not exists (select 1 from public.profiles p where p.id = user_id) then
    return null;
  end if;

  return user_id;
end;
$$;

revoke execute on function public.verify_email_prefs_token(text)
  from public, anon, authenticated;
grant execute on function public.verify_email_prefs_token(text) to service_role;

-- ---------------------------------------------------------------------------
-- enqueue_email — el único sitio que escribe pending
-- ---------------------------------------------------------------------------

create function public.email_channel_allowed(
  p_user_id uuid,
  p_channel text,
  p_template text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  prefs public.email_preferences;
begin
  if p_channel = 'T' then
    return true;
  end if;

  -- D2: onboarding incompleto, aún no eligió cadencia. Cuenta, no hábito.
  if p_template = 'drip_d2' then
    return true;
  end if;

  if p_user_id is null then
    -- Invitación a quien aún no tiene cuenta: no hay prefs que consultar.
    return p_template in ('invite_app', 'invite_circle', 'invite_plan');
  end if;

  select * into prefs
    from public.email_preferences
   where user_id = p_user_id;

  if not found then
    return false;
  end if;

  if p_channel = 'P' and prefs.cadence = 'off' then
    return false;
  end if;

  if p_channel = 'S' and not prefs.social then
    return false;
  end if;

  if p_channel = 'G' and not prefs.nudge then
    return false;
  end if;

  return true;
end;
$$;

revoke execute on function public.email_channel_allowed(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.email_channel_allowed(uuid, text, text)
  to service_role;

create function public.email_non_t_taken_today(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date;
begin
  if p_user_id is null then
    return false;
  end if;

  today := public.local_today(p_user_id);

  return exists (
    select 1
    from public.email_outbox o
    join public.profile_settings s on s.id = p_user_id
    where o.user_id = p_user_id
      and o.channel <> 'T'
      and o.status in ('pending', 'sent')
      and (
        coalesce(o.sent_at, o.scheduled_for)
        at time zone coalesce(nullif(btrim(s.timezone), ''), 'UTC')
      )::date = today
  );
end;
$$;

revoke execute on function public.email_non_t_taken_today(uuid)
  from public, anon, authenticated;
grant execute on function public.email_non_t_taken_today(uuid) to service_role;

create function public.enqueue_email(
  p_template text,
  p_to_email text,
  p_user_id uuid,
  p_locale text,
  p_channel text,
  p_payload jsonb,
  p_idempotency_key text,
  p_scheduled_for timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_to_email, '')));
  v_id uuid;
  v_locale text := case when coalesce(p_locale, 'es') like 'en%' then 'en' else 'es' end;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return null;
  end if;

  if exists (
    select 1 from public.email_suppressions s where s.email = v_email
  ) then
    insert into public.email_outbox (
      template, locale, to_email, user_id, channel, payload,
      idempotency_key, scheduled_for, status, last_error
    ) values (
      p_template, v_locale, v_email, p_user_id, p_channel,
      coalesce(p_payload, '{}'::jsonb), p_idempotency_key,
      p_scheduled_for, 'skipped', 'suppressed'
    )
    on conflict (idempotency_key) do nothing
    returning id into v_id;
    return v_id;
  end if;

  if not public.email_channel_allowed(p_user_id, p_channel, p_template) then
    insert into public.email_outbox (
      template, locale, to_email, user_id, channel, payload,
      idempotency_key, scheduled_for, status, last_error
    ) values (
      p_template, v_locale, v_email, p_user_id, p_channel,
      coalesce(p_payload, '{}'::jsonb), p_idempotency_key,
      p_scheduled_for, 'skipped', 'channel_off'
    )
    on conflict (idempotency_key) do nothing
    returning id into v_id;
    return v_id;
  end if;

  if p_channel <> 'T'
     and p_user_id is not null
     and public.email_non_t_taken_today(p_user_id) then
    insert into public.email_outbox (
      template, locale, to_email, user_id, channel, payload,
      idempotency_key, scheduled_for, status, last_error
    ) values (
      p_template, v_locale, v_email, p_user_id, p_channel,
      coalesce(p_payload, '{}'::jsonb), p_idempotency_key,
      p_scheduled_for, 'skipped', 'daily_cap'
    )
    on conflict (idempotency_key) do nothing
    returning id into v_id;
    return v_id;
  end if;

  if p_channel in ('P', 'G')
     and exists (select 1 from public.email_runtime r where r.pause_growth) then
    insert into public.email_outbox (
      template, locale, to_email, user_id, channel, payload,
      idempotency_key, scheduled_for, status, last_error
    ) values (
      p_template, v_locale, v_email, p_user_id, p_channel,
      coalesce(p_payload, '{}'::jsonb), p_idempotency_key,
      p_scheduled_for, 'skipped', 'pause_growth'
    )
    on conflict (idempotency_key) do nothing
    returning id into v_id;
    return v_id;
  end if;

  insert into public.email_outbox (
    template, locale, to_email, user_id, channel, payload,
    idempotency_key, scheduled_for, status
  ) values (
    p_template, v_locale, v_email, p_user_id, p_channel,
    coalesce(p_payload, '{}'::jsonb), p_idempotency_key,
    coalesce(p_scheduled_for, now()), 'pending'
  )
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.enqueue_email(text, text, uuid, text, text, jsonb, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_email(text, text, uuid, text, text, jsonb, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- claim + mark — el mismo lease que push
-- ---------------------------------------------------------------------------

create function public.claim_email_outbox_batch(
  p_limit integer default 50,
  p_lease_seconds integer default 120
)
returns table (
  outbox_id uuid,
  template text,
  locale text,
  to_email text,
  user_id uuid,
  channel text,
  payload jsonb,
  idempotency_key text,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with claimable as (
    select o.id
    from public.email_outbox o
    where o.status = 'pending'
      and o.scheduled_for <= now()
      and o.next_attempt_at <= now()
      and (o.leased_until is null or o.leased_until < now())
    order by o.created_at
    limit greatest(least(p_limit, 200), 1)
    for update of o skip locked
  ),
  leased as (
    update public.email_outbox o
       set leased_until = now() + (greatest(p_lease_seconds, 1) || ' seconds')::interval
      from claimable c
     where o.id = c.id
    returning o.id, o.template, o.locale, o.to_email, o.user_id,
              o.channel, o.payload, o.idempotency_key, o.attempts
  )
  select
    l.id,
    l.template,
    l.locale,
    l.to_email,
    l.user_id,
    l.channel,
    l.payload,
    l.idempotency_key,
    l.attempts
  from leased l;
end;
$$;

revoke execute on function public.claim_email_outbox_batch(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_email_outbox_batch(integer, integer)
  to service_role;

create function public.mark_email_delivery(
  p_outbox_id uuid,
  p_status text,
  p_resend_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_max_attempts constant integer := 8;
begin
  if p_status not in ('sent', 'permanent_failure', 'retryable_failure', 'skipped') then
    raise exception 'mark_email_delivery requires a known outcome';
  end if;

  if p_status = 'sent' then
    update public.email_outbox
       set status = 'sent',
           sent_at = now(),
           resend_id = coalesce(p_resend_id, resend_id),
           last_error = null,
           leased_until = null
     where id = p_outbox_id
       and status = 'pending';
    return found;
  end if;

  if p_status = 'skipped' then
    update public.email_outbox
       set status = 'skipped',
           last_error = coalesce(p_error, 'skipped'),
           leased_until = null
     where id = p_outbox_id
       and status = 'pending';
    return found;
  end if;

  if p_status = 'permanent_failure' then
    update public.email_outbox
       set status = 'failed',
           attempts = attempts + 1,
           last_error = coalesce(p_error, 'permanent_failure'),
           leased_until = null
     where id = p_outbox_id
       and status = 'pending';
    return found;
  end if;

  select attempts into v_attempts
    from public.email_outbox
   where id = p_outbox_id
     and status = 'pending';

  if v_attempts is null then
    return false;
  end if;

  if v_attempts + 1 >= v_max_attempts then
    update public.email_outbox
       set status = 'failed',
           attempts = attempts + 1,
           last_error = coalesce(p_error, 'retry_limit_exceeded'),
           leased_until = null
     where id = p_outbox_id;
    return true;
  end if;

  update public.email_outbox
     set attempts = attempts + 1,
         last_error = p_error,
         next_attempt_at = now() + (least(power(2, attempts + 1), 60) * interval '1 second'),
         leased_until = null
   where id = p_outbox_id;

  return true;
end;
$$;

revoke execute on function public.mark_email_delivery(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_email_delivery(uuid, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Webhook: persistir evento + suppressions
-- ---------------------------------------------------------------------------

create function public.record_email_event(
  p_svix_id text,
  p_event_type text,
  p_resend_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox uuid;
  v_email text;
begin
  if p_svix_id is null or btrim(p_svix_id) = '' then
    return false;
  end if;

  insert into public.email_events (svix_id, event_type, resend_id, payload)
  values (btrim(p_svix_id), p_event_type, p_resend_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (svix_id) do nothing;

  if not found then
    return false;
  end if;

  if p_resend_id is not null then
    select o.id into v_outbox
      from public.email_outbox o
     where o.resend_id = p_resend_id
     limit 1;

    if v_outbox is not null then
      update public.email_events
         set outbox_id = v_outbox
       where svix_id = btrim(p_svix_id);
    end if;
  end if;

  v_email := lower(btrim(coalesce(
    p_payload #>> '{data,to,0}',
    p_payload #>> '{data,to}'
  )));

  if p_event_type in ('email.bounced', 'email.complained') and v_email like '%@%' then
    insert into public.email_suppressions (email, reason)
    values (
      v_email,
      case when p_event_type = 'email.complained' then 'complaint' else 'bounce' end
    )
    on conflict (email) do nothing;
  end if;

  return true;
end;
$$;

revoke execute on function public.record_email_event(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_email_event(text, text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Heartbeat
-- ---------------------------------------------------------------------------

create function public.heartbeat_last_seen()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  update public.profiles
     set last_seen_at = now()
   where id = uid
     and (last_seen_at is null or last_seen_at < now() - interval '50 minutes');

  return true;
end;
$$;

revoke execute on function public.heartbeat_last_seen() from public;
grant execute on function public.heartbeat_last_seen() to authenticated;

-- ---------------------------------------------------------------------------
-- Preferencias por token (anon) y one-click
-- ---------------------------------------------------------------------------

create function public.email_prefs_by_token(p_token text)
returns table (
  cadence public.email_cadence,
  social boolean,
  nudge boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.verify_email_prefs_token(p_token);
begin
  if uid is null then
    return;
  end if;

  return query
  select p.cadence, p.social, p.nudge
    from public.email_preferences p
   where p.user_id = uid;
end;
$$;

revoke execute on function public.email_prefs_by_token(text) from public;
grant execute on function public.email_prefs_by_token(text) to anon, authenticated;

create function public.update_email_prefs_by_token(
  p_token text,
  p_cadence public.email_cadence default null,
  p_social boolean default null,
  p_nudge boolean default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.verify_email_prefs_token(p_token);
begin
  if uid is null then
    return false;
  end if;

  update public.email_preferences
     set cadence = coalesce(p_cadence, cadence),
         social = coalesce(p_social, social),
         nudge = coalesce(p_nudge, nudge),
         sunset_at = case
           when p_cadence is not null and p_cadence <> 'off' then null
           else sunset_at
         end
   where user_id = uid;

  return found;
end;
$$;

revoke execute on function public.update_email_prefs_by_token(text, public.email_cadence, boolean, boolean)
  from public;
grant execute on function public.update_email_prefs_by_token(text, public.email_cadence, boolean, boolean)
  to anon, authenticated;

-- One-click (RFC 8058): un POST pone cadence=off y deja social/nudge.
create function public.unsubscribe_email_one_click(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.update_email_prefs_by_token(p_token, 'off', null, null);
$$;

revoke execute on function public.unsubscribe_email_one_click(text) from public;
grant execute on function public.unsubscribe_email_one_click(text)
  to anon, authenticated, service_role;

create function public.reactivate_email_cadence_by_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.verify_email_prefs_token(p_token);
  prev public.email_cadence;
begin
  if uid is null then
    return false;
  end if;

  select coalesce(previous_cadence, 'daily') into prev
    from public.email_preferences
   where user_id = uid;

  update public.email_preferences
     set cadence = case when prev = 'off' then 'daily' else prev end,
         nudge = true,
         sunset_at = null
   where user_id = uid;

  return found;
end;
$$;

revoke execute on function public.reactivate_email_cadence_by_token(text) from public;
grant execute on function public.reactivate_email_cadence_by_token(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Alta: fila de preferencias con cada cuenta
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, last_seen_at)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    now()
  );

  insert into public.profile_settings (id) values (new.id);

  insert into public.email_preferences (user_id, cadence)
  values (new.id, 'daily')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Correo del destinatario (auth.users), solo DEFINER
-- ---------------------------------------------------------------------------

create function public.email_address_for(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
    from auth.users u
   where u.id = p_user;
$$;

revoke execute on function public.email_address_for(uuid)
  from public, anon, authenticated;
grant execute on function public.email_address_for(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Bienvenida al completar onboarding (no al signUp crudo)
-- ---------------------------------------------------------------------------

drop function public.complete_onboarding(text, jsonb, text, smallint[], text);

create function public.complete_onboarding(
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

revoke execute on function
  public.complete_onboarding(text, jsonb, text, smallint[], text, public.email_cadence)
  from public;
grant execute on function
  public.complete_onboarding(text, jsonb, text, smallint[], text, public.email_cadence)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Waitlist: un mail al apuntarse
-- ---------------------------------------------------------------------------

create function public.enqueue_waitlist_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text;
  v_first text;
begin
  select locale into v_locale
    from public.profile_settings
   where id = new.user_id;

  v_first := split_part(btrim(new.name), ' ', 1);

  perform public.enqueue_email(
    'waitlist',
    new.email,
    new.user_id,
    coalesce(v_locale, 'es'),
    'T',
    jsonb_build_object('first_name', nullif(v_first, '')),
    'waitlist/' || new.user_id::text,
    now()
  );

  return new;
end;
$$;

create trigger plus_waitlist_enqueue_email
  after insert on public.plus_waitlist
  for each row execute function public.enqueue_waitlist_email();

-- ---------------------------------------------------------------------------
-- Export: incluir cadencia
-- ---------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'about_this_file',
      'Este fichero contiene tus datos de Ammen. Guárdalo con cuidado: '
      || 'incluye lo que escribiste, incluidas las peticiones que publicaste '
      || 'de forma anónima.',

    'profile', (
      select to_jsonb(x) from (
        select p.display_name, p.avatar_url, p.streak_count, p.streak_last_day,
               p.created_at, p.last_seen_at
        from public.profiles p where p.id = (select auth.uid())
      ) x
    ),

    'settings', (
      select to_jsonb(x) from (
        select s.timezone, s.locale, s.reminder_hours, s.onboarding_answers,
               s.terms_version, s.terms_accepted_at
        from public.profile_settings s where s.id = (select auth.uid())
      ) x
    ),

    'email_preferences', (
      select to_jsonb(x) from (
        select e.cadence, e.social, e.nudge, e.updated_at
        from public.email_preferences e where e.user_id = (select auth.uid())
      ) x
    ),

    'plans', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pl.title, pl.theme, pl.duration_days, pl.start_date,
               pl.visibility, pl.status, pl.created_at,
               (
                 select coalesce(jsonb_agg(to_jsonb(d) order by d.day_number), '[]'::jsonb)
                 from (
                   select day_number, title, scripture_ref, scripture_text,
                          interpretation, daily_action, prayer_body, unlock_date
                   from public.prayer_plan_days
                   where plan_id = pl.id
                 ) d
               ) as days
        from public.prayer_plans pl
        where pl.owner_id = (select auth.uid())
      ) x
    ),

    'days_i_prayed', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select d.day_number, pl.title as plan_title, l.note, l.completed_at
        from public.prayer_logs l
        join public.prayer_plan_days d on d.id = l.plan_day_id
        join public.prayer_plans pl on pl.id = d.plan_id
        where l.user_id = (select auth.uid())
        order by l.completed_at
      ) x
    ),

    'prayer_requests', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select po.body, po.is_anonymous, po.prayer_count, po.answered_at,
               po.held_at, po.created_at
        from public.posts po
        where po.author_id = (select auth.uid())
        order by po.created_at
      ) x
    ),

    'comments', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select c.body, c.held_at, c.created_at
        from public.comments c
        where c.author_id = (select auth.uid())
        order by c.created_at
      ) x
    ),

    'testimonies', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select t.body, t.visibility, t.created_at
        from public.testimonies t
        where t.user_id = (select auth.uid())
        order by t.created_at
      ) x
    ),

    'prayers_received', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pr.display_name as from_person, i.message, i.created_at
        from public.intercessions i
        join public.profiles pr on pr.id = i.intercessor_id
        where i.plan_owner_id = (select auth.uid())
        order by i.created_at
      ) x
    ),

    'prayers_given', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pr.display_name as for_person, i.message, i.created_at
        from public.intercessions i
        join public.profiles pr on pr.id = i.plan_owner_id
        where i.intercessor_id = (select auth.uid())
        order by i.created_at
      ) x
    ),

    'circles', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select g.name, m.role, m.joined_at
        from public.group_members m
        join public.groups g on g.id = m.group_id
        where m.user_id = (select auth.uid())
      ) x
    ),

    'following', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pr.display_name, f.created_at
        from public.follows f
        join public.profiles pr on pr.id = f.followee_id
        where f.follower_id = (select auth.uid())
      ) x
    ),

    'blocked', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pr.display_name, b.created_at
        from public.blocks b
        join public.profiles pr on pr.id = b.blocked_id
        where b.blocker_id = (select auth.uid())
      ) x
    )
  );
$$;
