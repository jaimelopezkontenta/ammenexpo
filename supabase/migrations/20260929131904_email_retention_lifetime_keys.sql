-- Revisión adversarial R1 (2026-09-29), S1: la retención reenviaba correos
-- «de por vida».
--
-- `purge_expired_rows()` borraba a los 90 días toda fila enviada u omitida de
-- `email_outbox`. Con la fila se iba su `idempotency_key`, y muchas claves no
-- llevan fecha: `drip_d2/<id>`, `welcome/<id>`, `winback_d7/<id>`… Los goteos
-- vuelven a preguntar cada 15 minutos «¿sigue sin X?», así que a los 90 días
-- el mismo correo salía otra vez, y otra a los 180. El D2 además va por canal
-- transaccional: sin baja posible.
--
-- Dos defensas, cada una suficiente por sí sola:
--
-- 1. La retención ya no borra lo que tiene clave de por vida: lo deja en
--    lápida (sin dirección, sin payload, sin error ni id de Resend; quedan id,
--    persona, plantilla, estado, clave y fechas). Borrar del todo solo se
--    borra cuando la persona ya no existe (`user_id` nulo) o con
--    `delete_my_account`. Lo que se borra es lo que lleva fecha o semana en la
--    clave, y por eso no puede repetirse: el hábito y el digest de un día, la
--    invitación de una semana.
-- 2. Los goteos exigen una cuenta de como mucho 14 días. Un goteo es la
--    primera semana de alguien, no un recordatorio perpetuo; y así encender
--    el programador en un entorno con cuentas de agosto no les manda a todas
--    su «día 2».

-- ---------------------------------------------------------------------------
-- Retención
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_rows()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Solo estas plantillas llevan fecha o semana en la clave. Todo lo demás se
  -- trata como de por vida: una plantilla nueva que nadie añada aquí se queda
  -- en lápida (ocupa un poco) en vez de volver a enviarse (molesta a alguien).
  v_dated constant text[] := array[
    'habit', 'digest_social', 'invite_app', 'invite_circle', 'invite_plan'
  ];
  v_outbox integer;
  v_scrubbed integer;
  v_events integer;
  v_push integer;
  v_cron integer;
begin
  if not coalesce((select s.enabled from public.scheduler_settings s where s.id), false) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  delete from public.email_events where created_at < now() - interval '180 days';
  get diagnostics v_events = row_count;

  delete from public.email_outbox o
   where o.status in ('sent', 'skipped', 'failed')
     and o.created_at < now() - interval '90 days'
     and (o.template = any (v_dated) or o.user_id is null);
  get diagnostics v_outbox = row_count;

  update public.email_outbox o
     set to_email = '',
         payload = '{}'::jsonb,
         last_error = null,
         resend_id = null
   where o.status in ('sent', 'skipped', 'failed')
     and o.created_at < now() - interval '90 days'
     and not (o.template = any (v_dated))
     and o.user_id is not null
     and (o.to_email <> '' or o.payload <> '{}'::jsonb
          or o.last_error is not null or o.resend_id is not null);
  get diagnostics v_scrubbed = row_count;

  delete from public.push_outbox
   where status <> 'pending'
     and created_at < now() - interval '30 days';
  get diagnostics v_push = row_count;

  delete from cron.job_run_details where end_time < now() - interval '7 days';
  get diagnostics v_cron = row_count;

  return jsonb_build_object(
    'ok', true,
    'email_outbox', v_outbox,
    'email_outbox_scrubbed', v_scrubbed,
    'email_events', v_events,
    'push_outbox', v_push,
    'cron_runs', v_cron
  );
end;
$$;

revoke execute on function public.purge_expired_rows() from public, anon, authenticated;
grant execute on function public.purge_expired_rows() to service_role;

-- ---------------------------------------------------------------------------
-- Goteo: solo en las dos primeras semanas de la cuenta
--
-- Igual que en 20260908200000_email_jobs.sql salvo el filtro de edad.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_drip_emails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- D7 es el último escalón: una semana de margen detrás de él cubre un
  -- programador parado unos días sin convertir el goteo en correo perpetuo.
  v_max_age constant integer := 14;
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
    where (now()::date - p.created_at::date) <= v_max_age
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

revoke execute on function public.enqueue_drip_emails() from public, anon, authenticated;
grant execute on function public.enqueue_drip_emails() to service_role;
