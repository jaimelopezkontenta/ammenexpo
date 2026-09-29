\set ON_ERROR_STOP on

-- El programador de colas (20260929074610_queue_scheduler) y el borrado de
-- correo al borrar la cuenta (20260929074704_account_deletion_email_cleanup).
--
-- Las secciones que llegan a pedir una llamada HTTP terminan en ROLLBACK: la
-- fila de `net.http_request_queue` se deshace con ellas y el worker de pg_net
-- nunca la ve. Nada de esta suite llama de verdad a una edge function.

\set VERA '''55555555-5555-5555-5555-555555555555'''

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
    and not has_function_privilege('authenticated', 'public.purge_expired_rows()', 'EXECUTE'),
  'the scheduler functions are not callable from a user session');

select pg_temp.assert(
  not has_table_privilege('authenticated', 'public.scheduler_settings', 'SELECT')
    and not has_table_privilege('anon', 'public.scheduler_settings', 'SELECT'),
  'and its settings are not readable from one either');


-- ===========================================================================
-- Encendido: solo llama si hay algo, y con el secreto de Vault
-- ===========================================================================
begin;

update public.scheduler_settings set enabled = true where id;

select pg_temp.assert(
  (public.run_queue_drains() -> 'called') = '[]'::jsonb,
  'with nothing pending, no function is called');

select vault.create_secret('secreto-de-prueba', 'ammen_email_invoke_secret');

insert into public.email_outbox (template, to_email, channel, idempotency_key)
values ('welcome', 'pendiente@test.local', 'T', 'scheduler-test-on');

select pg_temp.assert(
  (public.run_queue_drains() -> 'called') = '["send-email"]'::jsonb,
  'with mail pending, it calls send-email and nothing else');

select pg_temp.assert(
  (select headers ->> 'x-ammen-invoker'
     from net.http_request_queue
    where url = 'http://kong:8000/functions/v1/send-email'
    order by id desc limit 1) = 'secreto-de-prueba',
  'the call carries the invoke secret from Vault');

rollback;


-- ===========================================================================
-- Retención: lo viejo se va, lo reciente y lo pendiente se quedan
-- ===========================================================================
begin;

update public.scheduler_settings set enabled = true where id;

insert into public.email_outbox (template, to_email, channel, idempotency_key, status, created_at)
values
  ('welcome', 'viejo@test.local',     'T', 'retention-old',     'sent',    now() - interval '100 days'),
  ('welcome', 'reciente@test.local',  'T', 'retention-recent',  'sent',    now() - interval '10 days'),
  ('welcome', 'pendiente@test.local', 'T', 'retention-pending', 'pending', now() - interval '100 days');

select public.purge_expired_rows();

select pg_temp.assert(
  (select array_agg(idempotency_key order by idempotency_key)
     from public.email_outbox
    where idempotency_key like 'retention-%')
    = array['retention-pending', 'retention-recent'],
  'retention drops sent mail older than 90 days and keeps recent or pending mail');

rollback;


-- ===========================================================================
-- Borrar la cuenta borra su correo (pero no la supresión)
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values (:VERA, 'vera-borrar@test.local', 'authenticated', 'authenticated', '{"display_name":"Vera"}');

insert into public.email_outbox (id, template, to_email, user_id, channel, idempotency_key)
values ('55555555-0000-0000-0000-00000000000e', 'welcome', 'vera-borrar@test.local', :VERA, 'T', 'delete-account-mail');

insert into public.email_events (svix_id, event_type, outbox_id, payload)
values ('msg_delete_account', 'email.delivered', '55555555-0000-0000-0000-00000000000e',
        '{"to": "vera-borrar@test.local"}'::jsonb);

insert into public.email_suppressions (email, reason)
values ('vera-borrar@test.local', 'complaint')
on conflict do nothing;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select public.delete_my_account();

commit;

select pg_temp.assert(
  (select count(*) from public.email_outbox where to_email = 'vera-borrar@test.local') = 0
    and (select count(*) from public.email_events where svix_id = 'msg_delete_account') = 0,
  'deleting the account deletes the mail sent to it and its delivery events');

select pg_temp.assert(
  (select count(*) from public.email_suppressions where email = 'vera-borrar@test.local') = 1,
  'the suppression stays, so a complaint is never mailed again');
