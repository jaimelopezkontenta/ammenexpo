\set ON_ERROR_STOP on

-- El programador de colas (20260929074610_queue_scheduler) y el borrado de
-- correo al borrar la cuenta (20260929074704_account_deletion_email_cleanup),
-- con los arreglos de la revisión adversarial R1 (2026-09-29): retención que
-- no reenvía (S1), un solo predicado de «pendiente» (S2), saltarse lo viejo al
-- encender (S3), secretos que faltan (S12), lo que la retención no cubría
-- (S14) y el borrado de lo que quedaba en filas de otros (S5).
--
-- Las secciones que llegan a pedir una llamada HTTP terminan en ROLLBACK: la
-- fila de `net.http_request_queue` se deshace con ellas y el worker de pg_net
-- nunca la ve. Nada de esta suite llama de verdad a una edge function.

\set VERA   '''55555555-5555-5555-5555-555555555555'''
\set OSCAR  '''66666666-6666-6666-6666-666666666666'''
\set PIA    '''77777777-7777-7777-7777-777777777777'''
\set NUEVA  '''88888888-8888-8888-8888-888888888888'''
\set ANTIGUA '''99999999-9999-9999-9999-999999999999'''
\set WALT   '''a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5'''

\set PLAN   '''5c4ed000-0000-0000-0000-0000000000a1'''
\set DAY1   '''5c4ed000-0000-0000-0000-0000000000a2'''
\set DAY2   '''5c4ed000-0000-0000-0000-0000000000a3'''

create or replace function pg_temp.assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice 'PASS  %', label;
  else
    raise exception 'FAIL  %', label;
  end if;
end;
$$;

create or replace function pg_temp.raises(stmt text)
returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end;
$$;


-- ===========================================================================
-- Fixtures
--
-- Óscar tiene un plan y un teléfono; Pía ora por él. Nueva (3 días) y
-- Antigua (100 días) no terminaron el onboarding: candidatas al goteo D2.
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:OSCAR,   'oscar@test.local',   'authenticated', 'authenticated', '{"display_name":"Óscar"}'),
  (:PIA,     'pia@test.local',     'authenticated', 'authenticated', '{"display_name":"Pía"}'),
  (:NUEVA,   'nueva@test.local',   'authenticated', 'authenticated', '{"display_name":"Nueva"}'),
  (:ANTIGUA, 'antigua@test.local', 'authenticated', 'authenticated', '{"display_name":"Antigua"}');

update public.profiles set created_at = now() - interval '3 days' where id = :NUEVA;
update public.profiles set created_at = now() - interval '100 days' where id = :ANTIGUA;
update public.profile_settings set onboarding_answers = null where id in (:NUEVA, :ANTIGUA);

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status)
values (:PLAN, :OSCAR, 'Paz', 3, current_date, 'private', 'active');

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values
  (:DAY1, :PLAN, 1, 'Día uno', 'Privado', current_date),
  (:DAY2, :PLAN, 2, 'Día dos', 'Privado', current_date);

commit;


-- ===========================================================================
-- Los trabajos existen y el interruptor viene apagado
-- ===========================================================================
select pg_temp.assert(
  (select count(*) from cron.job
    where jobname in ('ammen-queue-drains', 'ammen-email-jobs', 'ammen-retention')) = 3,
  'pg_cron has the three scheduler jobs');

select pg_temp.assert(
  (select not enabled from public.scheduler_settings where id),
  'the scheduler ships switched off');

select pg_temp.assert(
  (select functions_url from public.scheduler_settings where id)
    = 'http://kong:8000/functions/v1',
  'locally it points at Kong inside the Docker network');

begin;

insert into public.email_outbox (template, to_email, channel, idempotency_key)
values ('welcome', 'apagado@test.local', 'T', 'scheduler-test-off');

select pg_temp.assert(
  public.run_queue_drains() ->> 'reason' = 'disabled',
  'switched off, the drain does nothing even with mail pending');

select pg_temp.assert(
  (select count(*) from net.http_request_queue where url like '%/send-email') = 0,
  'and no HTTP call is queued');

select pg_temp.assert(
  public.run_email_jobs() ->> 'reason' = 'disabled'
    and public.purge_expired_rows() ->> 'reason' = 'disabled',
  'email jobs and retention hang from the same switch');

rollback;


-- ===========================================================================
-- Nadie con sesión puede dispararlo
-- ===========================================================================
select pg_temp.assert(
  not has_function_privilege('authenticated', 'public.run_queue_drains()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.run_queue_drains()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.run_email_jobs()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.purge_expired_rows()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.skip_stale_queue_rows(interval)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.skip_stale_queue_rows(interval)', 'EXECUTE'),
  'the scheduler functions are not callable from a user session');

select pg_temp.assert(
  not has_table_privilege('authenticated', 'public.scheduler_settings', 'SELECT')
    and not has_table_privilege('anon', 'public.scheduler_settings', 'SELECT'),
  'and its settings are not readable from one either');


-- ===========================================================================
-- Encendido: solo llama si hay algo que el claim vaya a coger, y con el
-- secreto de Vault (S2, S12, S14)
-- ===========================================================================
begin;

update public.scheduler_settings set enabled = true where id;

select pg_temp.assert(
  (public.run_queue_drains() -> 'called') = '[]'::jsonb,
  'with nothing pending, no function is called');

insert into public.email_outbox (template, to_email, channel, idempotency_key)
values ('welcome', 'pendiente@test.local', 'T', 'scheduler-test-on');

-- S12: sin el secreto, antes llamaba con la cabecera vacía y decía ok.
select pg_temp.assert(
  public.run_queue_drains()
    = '{"ok": false, "reason": "missing_secret", "missing": ["ammen_email_invoke_secret"], "called": []}'::jsonb,
  'with mail pending but no email secret in Vault, it says missing_secret instead of ok');

select pg_temp.assert(
  (select count(*) from net.http_request_queue where url like '%/send-email') = 0,
  'and it does not call send-email with an empty invoker header');

select vault.create_secret('secreto-de-prueba', 'ammen_email_invoke_secret');

select pg_temp.assert(
  (public.run_queue_drains() -> 'called') = '["send-email"]'::jsonb,
  'with mail pending, it calls send-email and nothing else');

select pg_temp.assert(
  (select headers ->> 'x-ammen-invoker'
     from net.http_request_queue
    where url = 'http://kong:8000/functions/v1/send-email'
    order by id desc limit 1) = 'secreto-de-prueba',
  'the call carries the invoke secret from Vault');

-- S2 en correo: programado para mañana no es trabajo de ahora.
update public.email_outbox set status = 'sent' where idempotency_key = 'scheduler-test-on';

insert into public.email_outbox (template, to_email, channel, idempotency_key, scheduled_for)
values ('welcome', 'manana@test.local', 'T', 'scheduler-test-later', now() + interval '1 day');

select pg_temp.assert(
  (public.run_queue_drains() -> 'called') = '[]'::jsonb,
  'mail scheduled for tomorrow does not wake send-email every minute');

-- S2 en push: una fila pending de un dispositivo revocado nunca se reclama,
-- así que tampoco puede despertar a la función.
insert into public.push_devices (id, user_id, expo_push_token, platform, revoked_at)
values ('5c4ed000-0000-0000-0000-0000000000d1', :OSCAR, 'ExponentPushToken[oscar-old]', 'ios', now());

insert into public.intercessions (id, plan_day_id, intercessor_id)
values ('5c4ed000-0000-0000-0000-0000000000e1', :DAY1, :PIA);

insert into public.push_outbox (intercession_id, device_id)
values ('5c4ed000-0000-0000-0000-0000000000e1', '5c4ed000-0000-0000-0000-0000000000d1');

select pg_temp.assert(
  (public.run_queue_drains() -> 'called') = '[]'::jsonb,
  'a pending push for a revoked device does not wake send-intercession-push (same predicate as the claim)');

-- Un teléfono vivo: ahora sí hay trabajo, pero falta el secreto de push.
insert into public.push_devices (user_id, expo_push_token, platform)
values (:OSCAR, 'ExponentPushToken[oscar-live]', 'android');

insert into public.intercessions (plan_day_id, intercessor_id)
values (:DAY2, :PIA);

select pg_temp.assert(
  public.run_queue_drains()
    = '{"ok": false, "reason": "missing_secret", "missing": ["ammen_push_invoke_secret"], "called": []}'::jsonb,
  'a live push without the push secret is missing_secret too');

select vault.create_secret('secreto-push', 'ammen_push_invoke_secret');

select pg_temp.assert(
  (public.run_queue_drains() -> 'called') = '["send-intercession-push"]'::jsonb,
  'with the push secret, it calls send-intercession-push');

select pg_temp.assert(
  (select headers ->> 'x-ammen-invoker'
     from net.http_request_queue
    where url = 'http://kong:8000/functions/v1/send-intercession-push'
    order by id desc limit 1) = 'secreto-push',
  'and that call carries the push secret, not the email one');

rollback;


-- ===========================================================================
-- run_email_jobs no encola lo que nadie va a poder enviar (S12)
-- ===========================================================================
begin;

update public.scheduler_settings set enabled = true, functions_url = null where id;

select pg_temp.assert(
  public.run_email_jobs() ->> 'reason' = 'no_functions_url',
  'without functions_url, the email jobs refuse to run');

select pg_temp.assert(
  (select count(*) from public.email_outbox where user_id = :NUEVA) = 0,
  'and nothing is enqueued (Nueva would have had her D2)');

update public.scheduler_settings set functions_url = 'http://kong:8000/functions/v1' where id;

select pg_temp.assert(
  public.run_email_jobs() ->> 'reason' = 'missing_secret',
  'without the email secret in Vault, they refuse too');

select pg_temp.assert(
  (select count(*) from public.email_outbox where user_id = :NUEVA) = 0,
  'and still nothing is enqueued');

select vault.create_secret('secreto-de-prueba', 'ammen_email_invoke_secret');

select pg_temp.assert(
  (public.run_email_jobs() ->> 'ok')::boolean,
  'with a URL and the secret, they run');

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where user_id = :NUEVA and template = 'drip_d2') = 1,
  'and Nueva gets her D2');

rollback;


-- ===========================================================================
-- Retención (S1, S14): lo que lleva fecha se borra; lo de por vida se queda
-- en lápida, para que su clave de idempotencia siga impidiendo el reenvío.
-- ===========================================================================
begin;

update public.scheduler_settings set enabled = true where id;

insert into public.email_outbox
  (template, to_email, user_id, channel, payload, idempotency_key, status, created_at, last_error, resend_id)
values
  ('habit',   'viejo@test.local',     :OSCAR, 'P', '{"first_name":"Óscar"}', 'retention-habit-old',   'sent',    now() - interval '100 days', null, 're_1'),
  ('habit',   'fallido@test.local',   :OSCAR, 'P', '{}', 'retention-habit-failed', 'failed', now() - interval '100 days', 'boom', null),
  ('habit',   'reciente@test.local',  :OSCAR, 'P', '{}', 'retention-habit-recent', 'sent',    now() - interval '10 days', null, null),
  ('habit',   'pendiente@test.local', :OSCAR, 'P', '{}', 'retention-habit-pending','pending', now() - interval '100 days', null, null),
  ('invite_app', 'invitada@test.local', null, 'S', '{"inviter_name":"Óscar"}', 'retention-invite-old', 'sent', now() - interval '100 days', null, null),
  ('welcome', 'huerfano@test.local',  null,   'T', '{}', 'retention-welcome-orphan', 'sent',  now() - interval '100 days', null, null),
  ('drip_d2', 'nueva@test.local',     :NUEVA, 'T', '{"first_name":"Nueva"}', 'drip_d2/' || :NUEVA::text, 'sent', now() - interval '100 days', null, 're_2');

insert into public.email_events (svix_id, event_type, payload, created_at)
values
  ('retention-event-old',    'email.delivered', '{}', now() - interval '181 days'),
  ('retention-event-recent', 'email.delivered', '{}', now() - interval '10 days');

-- Push: dos filas ya resueltas (una vieja, una reciente) y una pendiente vieja.
insert into public.push_devices (id, user_id, expo_push_token, platform)
values ('5c4ed000-0000-0000-0000-0000000000d2', :OSCAR, 'ExponentPushToken[oscar-ret]', 'ios');

insert into public.intercessions (id, plan_day_id, intercessor_id)
values ('5c4ed000-0000-0000-0000-0000000000e2', :DAY1, :PIA);

update public.push_outbox
   set status = 'delivered', created_at = now() - interval '31 days'
 where intercession_id = '5c4ed000-0000-0000-0000-0000000000e2';

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('5c4ed000-0000-0000-0000-0000000000f1', 'otro@test.local', 'authenticated', 'authenticated', '{"display_name":"Otro"}'),
       ('5c4ed000-0000-0000-0000-0000000000f2', 'otra@test.local', 'authenticated', 'authenticated', '{"display_name":"Otra"}');

insert into public.intercessions (id, plan_day_id, intercessor_id)
values ('5c4ed000-0000-0000-0000-0000000000e3', :DAY1, '5c4ed000-0000-0000-0000-0000000000f1'),
       ('5c4ed000-0000-0000-0000-0000000000e4', :DAY2, '5c4ed000-0000-0000-0000-0000000000f2');

update public.push_outbox
   set status = 'sent', created_at = now() - interval '5 days'
 where intercession_id = '5c4ed000-0000-0000-0000-0000000000e3';

update public.push_outbox
   set created_at = now() - interval '40 days'
 where intercession_id = '5c4ed000-0000-0000-0000-0000000000e4';

-- pg_cron: una ejecución de hace 8 días y una de hoy. `runid` a mano y
-- negativo: la secuencia de pg_cron no es de postgres, y así no choca.
insert into cron.job_run_details (jobid, runid, username, command, status, start_time, end_time)
values
  (0, -1, current_user, 'retention-test-old',    'succeeded', now() - interval '8 days', now() - interval '8 days'),
  (0, -2, current_user, 'retention-test-recent', 'succeeded', now() - interval '1 hour', now() - interval '1 hour');

select public.purge_expired_rows();

select pg_temp.assert(
  (select array_agg(idempotency_key order by idempotency_key)
     from public.email_outbox
    where idempotency_key like 'retention-%')
    = array['retention-habit-pending', 'retention-habit-recent'],
  'dated mail (a day''s habit, a week''s invite) older than 90 days goes, sent or failed, and so does lifetime mail of a person that no longer exists');

select pg_temp.assert(
  (select to_email = '' and payload = '{}'::jsonb and resend_id is null and status = 'sent'
     from public.email_outbox
    where idempotency_key = 'drip_d2/' || :NUEVA::text),
  'lifetime mail (a drip) older than 90 days stays as a tombstone: no address, no payload, but its key');

select pg_temp.assert(
  (select array_agg(svix_id order by svix_id) from public.email_events
    where svix_id like 'retention-event-%') = array['retention-event-recent'],
  'Resend events older than 180 days go, recent ones stay');

select pg_temp.assert(
  (select count(*) from public.push_outbox
    where intercession_id = '5c4ed000-0000-0000-0000-0000000000e2') = 0
    and (select count(*) from public.push_outbox
          where intercession_id = '5c4ed000-0000-0000-0000-0000000000e3') >= 1
    and (select count(*) from public.push_outbox
          where intercession_id = '5c4ed000-0000-0000-0000-0000000000e4') >= 1,
  'resolved pushes older than 30 days go; recent ones and old pending ones stay');

select pg_temp.assert(
  (select array_agg(command order by command) from cron.job_run_details
    where command like 'retention-test-%') = array['retention-test-recent'],
  'pg_cron history older than 7 days goes');

-- La prueba que importa (S1): con la lápida en su sitio, el goteo no vuelve.
select public.enqueue_drip_emails();

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where user_id = :NUEVA and template = 'drip_d2') = 1
    and (select status from public.email_outbox
          where user_id = :NUEVA and template = 'drip_d2') = 'sent',
  'after retention, the drip is NOT enqueued again (its key survived)');

select pg_temp.assert(
  (select count(*) from public.email_outbox where user_id = :ANTIGUA) = 0,
  'and an account older than two weeks never starts a drip at all');

rollback;


-- ===========================================================================
-- Encender sin vaciar meses de cola: skip_stale_queue_rows (S3)
-- ===========================================================================
begin;

insert into public.email_outbox (template, to_email, channel, idempotency_key, created_at, scheduled_for, leased_until)
values
  ('welcome', 'vieja@test.local',   'T', 'stale-old',     now() - interval '30 days', now() - interval '30 days', null),
  ('welcome', 'hoy@test.local',     'T', 'stale-recent',  now() - interval '1 hour',  now() - interval '1 hour',  null),
  ('welcome', 'futura@test.local',  'T', 'stale-future',  now() - interval '30 days', now() + interval '1 day',   null),
  ('welcome', 'enviando@test.local','T', 'stale-leased',  now() - interval '30 days', now() - interval '30 days', now() + interval '1 minute');

insert into public.push_devices (user_id, expo_push_token, platform)
values (:OSCAR, 'ExponentPushToken[oscar-stale]', 'ios');

insert into public.intercessions (id, plan_day_id, intercessor_id)
values ('5c4ed000-0000-0000-0000-0000000000e5', :DAY1, :PIA);

update public.push_outbox set created_at = now() - interval '30 days'
 where intercession_id = '5c4ed000-0000-0000-0000-0000000000e5';

select pg_temp.assert(
  pg_temp.raises($q$ select public.skip_stale_queue_rows(interval '0') $q$)
    and pg_temp.raises($q$ select public.skip_stale_queue_rows(null) $q$),
  'skip_stale_queue_rows refuses a zero or missing threshold');

select pg_temp.assert(
  (public.skip_stale_queue_rows(interval '2 days') ->> 'email_outbox')::integer = 1,
  'it skips exactly the one stale email');

select pg_temp.assert(
  (select array_agg(idempotency_key || ':' || status || ':' || coalesce(last_error, '') order by idempotency_key)
     from public.email_outbox where idempotency_key like 'stale-%')
    = array['stale-future:pending:', 'stale-leased:pending:', 'stale-old:skipped:stale', 'stale-recent:pending:'],
  'old pending mail is skipped as stale; recent, future-scheduled and in-flight mail is left alone');

select pg_temp.assert(
  (select bool_and(status = 'skipped' and last_error = 'stale') from public.push_outbox
    where intercession_id = '5c4ed000-0000-0000-0000-0000000000e5'),
  'and so is an old pending push');

rollback;


-- ===========================================================================
-- Borrar la cuenta borra su correo (pero no la supresión), y lo suyo que
-- quedaba en filas de otros (S5)
--
-- Vera invitó a alguien por correo, recibió una invitación antes de tener
-- cuenta, oró por Walt, sale en su resumen del día y en su bienvenida, y Walt
-- recibió un «tu invitación se usó» con su nombre.
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:VERA, 'vera-borrar@test.local', 'authenticated', 'authenticated', '{"display_name":"Vera"}'),
  (:WALT, 'walt@test.local',        'authenticated', 'authenticated', '{"display_name":"Walt"}');

update public.profiles set created_at = now() - interval '2 days' where id = :VERA;
update public.profile_settings set onboarding_answers = '{}'::jsonb where id = :VERA;
update public.profile_settings set locale = 'en' where id = :WALT;

insert into public.groups (owner_id, name, visibility)
values (:VERA, 'Círculo de Vera', 'private');

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status)
values ('5c4ed000-0000-0000-0000-0000000000b1', :WALT, 'Plan de Walt', 3, current_date, 'private', 'active');

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values ('5c4ed000-0000-0000-0000-0000000000b2', '5c4ed000-0000-0000-0000-0000000000b1',
        1, 'Día uno', 'Privado', current_date);

insert into public.intercessions (plan_day_id, intercessor_id)
values ('5c4ed000-0000-0000-0000-0000000000b2', :VERA);

insert into public.email_outbox (id, template, to_email, user_id, channel, idempotency_key)
values ('55555555-0000-0000-0000-00000000000e', 'welcome', 'vera-borrar@test.local', :VERA, 'T', 'delete-account-mail');

insert into public.email_outbox (template, to_email, user_id, channel, payload, idempotency_key, invited_by)
values
  ('invite_app', 'vera-borrar@test.local', null, 'S', '{"inviter_name":"Walt"}',
   'invite/app/walt-code/vera-borrar@test.local/2026-W38', :WALT),
  ('digest_social', 'walt@test.local', :WALT, 'S', '{"names":["Vera","Otro"],"count":2}',
   'digest/' || :WALT::text || '/2026-09-28', null),
  ('welcome', 'walt@test.local', :WALT, 'T', '{"inviter_name":"Vera","circle_name":"Círculo de Vera","first_name":"Walt"}',
   'welcome/' || :WALT::text, null),
  ('invite_used', 'walt@test.local', :WALT, 'T', '{"redeemer_name":"Vera","context":"app"}',
   'invite_used/' || :WALT::text || '/' || :VERA::text, null);

insert into public.email_events (svix_id, event_type, outbox_id, payload)
values ('msg_delete_account', 'email.delivered', '55555555-0000-0000-0000-00000000000e',
        '{"to": "vera-borrar@test.local"}'::jsonb);

insert into public.email_suppressions (email, reason)
values ('vera-borrar@test.local', 'complaint')
on conflict do nothing;

commit;

select invite_token as vera_token from public.groups
 where owner_id = '55555555-5555-5555-5555-555555555555' \gset

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select pg_temp.assert(
  (public.enqueue_invite_email('circle', 'amigo-de-vera@test.local', :'vera_token') ->> 'ok')::boolean,
  'fixture: Vera invites a friend by email (still pending when she leaves)');

select public.delete_my_account();

commit;

select pg_temp.assert(
  (select count(*) from public.email_outbox where to_email = 'vera-borrar@test.local') = 0
    and (select count(*) from public.email_events where svix_id = 'msg_delete_account') = 0,
  'deleting the account deletes the mail sent to it, the invitations it received, and their delivery events');

select pg_temp.assert(
  (select count(*) from public.email_outbox where to_email = 'amigo-de-vera@test.local') = 0,
  'and the invitations it sent: a third party''s address, never mailed after the sender is gone');

select pg_temp.assert(
  (select count(*) from public.email_outbox where template = 'invite_used'
    and idempotency_key = 'invite_used/' || :WALT::text || '/' || :VERA::text) = 0,
  'and the «your invitation was used» that named it');

select pg_temp.assert(
  (select payload -> 'names' from public.email_outbox
    where idempotency_key = 'digest/' || :WALT::text || '/2026-09-28') = '["Otro"]'::jsonb,
  'Walt''s social digest stays, without her name');

select pg_temp.assert(
  (select not (payload ? 'inviter_name') and not (payload ? 'circle_name')
          and payload ->> 'first_name' = 'Walt'
     from public.email_outbox where idempotency_key = 'welcome/' || :WALT::text),
  'Walt''s welcome stays, without who invited him or to which circle');

select pg_temp.assert(
  (select payload ->> 'intercessor_name' = 'Someone' and not (payload ? 'intercessor_id')
     from public.notifications where user_id = :WALT and type = 'intercession'),
  'Walt''s notification stays in his history with a neutral name, in his language, and no link to her');

select pg_temp.assert(
  (select count(*) from public.email_outbox
    where payload::text like '%Vera%' or to_email like '%vera%') = 0
    and (select count(*) from public.notifications where payload::text like '%Vera%') = 0,
  'nothing in the queues or anyone''s notifications still carries her name or address');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.my_notifications_page()) = 1,
  'and Walt still sees it in his notifications list');

commit;

select pg_temp.assert(
  (select count(*) from public.email_suppressions where email = 'vera-borrar@test.local') = 1,
  'the suppression stays, so a complaint is never mailed again');
