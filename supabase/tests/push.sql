\set ON_ERROR_STOP on

-- Ammen — B4: dispositivos por instalación, y el outbox que los usa.
--
-- Ver la migración `20260823100000_push_devices_outbox.sql` para el porqué.
-- Este archivo prueba el modelo de datos y las RPC — nunca la entrega real:
-- eso vive en `send-intercession-push`, y el plan es explícito en que un mock
-- no cierra push.

\set ANA  '''11111111-1111-1111-1111-111111111111'''
\set BETO '''22222222-2222-2222-2222-222222222222'''
\set CARLA '''33333333-3333-3333-3333-333333333333'''

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
exception
  when others then
    return true;
end;
$$;

-- ===========================================================================
-- Fixtures
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:ANA,   'ana@test.local',   'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:BETO,  'beto@test.local',  'authenticated', 'authenticated', '{"display_name":"Beto"}'),
  (:CARLA, 'carla@test.local', 'authenticated', 'authenticated', '{"display_name":"Carla"}');

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status)
values ('9051d000-0000-0000-0000-0000000000a1', :ANA, 'Paz', 3, current_date, 'private', 'active');

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values ('9051d000-0000-0000-0000-0000000000a2', '9051d000-0000-0000-0000-0000000000a1',
        1, 'Día uno', 'Privado', current_date);

insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
values ('9051d000-0000-0000-0000-0000000000a1', :BETO, :ANA);

commit;

-- ===========================================================================
-- RDY-10: registrar, rotar, revocar — por dispositivo, no por perfil
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  public.register_push_device('ExponentPushToken[ana-phone]', 'ios'),
  'Ana registers her phone');

select pg_temp.assert(
  public.register_push_device('ExponentPushToken[ana-tablet]', 'android'),
  'and a second device coexists with the first');

select pg_temp.assert(
  (select count(*) from public.push_devices where user_id = :ANA) = 2,
  'two rows, not one token overwritten by the other');

commit;

-- Extraño y anon no pueden leer ni escribir la tabla directamente: todo pasa
-- por las RPC, no por el token en la mano.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.push_devices where user_id = :ANA) = 0,
  'Beto cannot see Ana''s devices through the select policy');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.push_devices (user_id, expo_push_token, platform)
    values ('22222222-2222-2222-2222-222222222222', 'ExponentPushToken[sneaky]', 'ios')
  $q$),
  'and cannot insert into the table directly either — only through the RPC');

commit;

begin;
set local role anon;

select pg_temp.assert(
  pg_temp.raises($q$ select count(*) from public.push_devices $q$),
  'anon has no access to the table at all');

commit;

-- Rotar: el mismo token, permiso re-concedido tras haberse revocado.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  public.revoke_push_device('ExponentPushToken[ana-phone]'),
  'Ana revokes one device (logout)');

select pg_temp.assert(
  (select revoked_at from public.push_devices
    where expo_push_token = 'ExponentPushToken[ana-phone]') is not null,
  'and it is marked revoked, not deleted — the audit trail stays');

select pg_temp.assert(
  public.register_push_device('ExponentPushToken[ana-phone]', 'ios'),
  'logging back in on the same phone re-registers the same token');

select pg_temp.assert(
  (select revoked_at from public.push_devices
    where expo_push_token = 'ExponentPushToken[ana-phone]') is null,
  'and it is live again, same row — not a duplicate');

commit;

-- Cambio de cuenta en el mismo teléfono: el token se reasigna a quien acaba
-- de entrar, nunca se hereda a una sesión que no lo registró.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  public.register_push_device('ExponentPushToken[shared-device]', 'android'),
  'Carla registers a token nobody used before');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  public.register_push_device('ExponentPushToken[shared-device]', 'android'),
  'Beto logs in on the same physical device and registers the same token');

select pg_temp.assert(
  (select count(*) from public.push_devices
    where expo_push_token = 'ExponentPushToken[shared-device]') = 1,
  'one row, reassigned — not two devices for one install');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.push_devices
    where user_id = :CARLA
      and expo_push_token = 'ExponentPushToken[shared-device]') = 0,
  'Carla no longer owns that token — the switch did not leave two owners');

commit;

-- Borrado de cuenta / "cerrar todo": revoca todas las instalaciones a la vez.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  public.revoke_all_my_push_devices() = 2,
  'revoking everything reports how many were live');

select pg_temp.assert(
  (select count(*) from public.push_devices
    where user_id = :ANA and revoked_at is null) = 0,
  'and none of Ana''s devices remain active');

commit;

-- ===========================================================================
-- RDY-11: el outbox — una entrega intentada por (intercesión, dispositivo)
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Ana necesita un dispositivo activo otra vez para que haya algo que encolar.
select public.register_push_device('ExponentPushToken[ana-active]', 'ios');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into public.intercessions (plan_day_id, intercessor_id)
values ('9051d000-0000-0000-0000-0000000000a2', :BETO)
returning id as beto_intercession_id \gset

commit;

begin;
set local role service_role;

select pg_temp.assert(
  (select count(*) from public.push_outbox
    where intercession_id = :'beto_intercession_id') = 1,
  'one outbox row was enqueued for Ana''s one active device');

select pg_temp.assert(
  (select status from public.push_outbox
    where intercession_id = :'beto_intercession_id') = 'pending',
  'and it starts pending');

select pg_temp.assert(
  (select count(*) from public.pending_push_outbox()
    where intercessor_name = 'Beto') = 1,
  'the sender''s own read finds it, with the names it needs to build the push');

commit;

-- Un segundo dispositivo activo de Ana: la próxima oración debe encolar dos
-- filas, una por dispositivo — la garantía de "una entrega por oración",
-- pero por destino, no una fila global que un `count` ambiguo confundiría.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.register_push_device('ExponentPushToken[ana-second]', 'android');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
values ('9051d000-0000-0000-0000-0000000000a1', :CARLA, :ANA);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.intercessions (plan_day_id, intercessor_id)
values ('9051d000-0000-0000-0000-0000000000a2', :CARLA)
returning id as carla_intercession_id \gset

commit;

begin;
set local role service_role;

select pg_temp.assert(
  (select count(*) from public.push_outbox
    where intercession_id = :'carla_intercession_id') = 2,
  'two active devices, two outbox rows for the same intercession');

commit;

-- Idempotencia: la unicidad (intercesión, dispositivo) es la que hace que
-- reintentar sea "esta misma fila otra vez", nunca "una fila más".
begin;
set local role service_role;

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.push_outbox (intercession_id, device_id)
    select intercession_id, device_id
    from public.push_outbox
    where intercession_id = :'carla_intercession_id'
    limit 1
  $q$),
  'inserting the same (intercession, device) pair again is refused by the unique key');

commit;

-- ===========================================================================
-- Receipts: marcar la entrega, y desactivar un token que el proveedor dice
-- que ya no existe
-- ===========================================================================
begin;
set local role service_role;

select pg_temp.assert(
  pg_temp.raises($q$ select public.mark_push_delivery(gen_random_uuid(), 'queued') $q$),
  'an unknown outcome is refused: only sent/delivered/permanent_failure/retryable_failure are written here');

commit;

begin;
set local role service_role;

select id as outbox_beto_id from public.push_outbox
 where intercession_id = :'beto_intercession_id' \gset

select pg_temp.assert(
  public.mark_push_delivery(:'outbox_beto_id', 'sent', 'receipt-abc'),
  'the sender marks a delivery attempt as sent, with the provider''s receipt id');

select pg_temp.assert(
  (select status from public.push_outbox where id = :'outbox_beto_id') = 'sent'
    and (select receipt_id from public.push_outbox where id = :'outbox_beto_id') = 'receipt-abc'
    and (select sent_at from public.push_outbox where id = :'outbox_beto_id') is not null,
  'and the row records status, receipt and timestamp');

commit;

-- El token inválido: falla con el motivo exacto que el proveedor usa, y el
-- dispositivo entero se desactiva — no solo este intento.
begin;
set local role service_role;

select id as outbox_dead_id, device_id as device_dead_id
  from public.push_outbox
 where intercession_id = :'carla_intercession_id'
 limit 1 \gset

select pg_temp.assert(
  public.mark_push_delivery(:'outbox_dead_id', 'permanent_failure', null, 'DeviceNotRegistered'),
  'the sender marks a dead token as a permanent failure');

select pg_temp.assert(
  (select revoked_at from public.push_devices where id = :'device_dead_id') is not null,
  'and the whole device is revoked, so the next prayer does not retry a dead token');

commit;

begin;
set local role service_role;

select pg_temp.assert(
  (select count(*) from public.pending_push_outbox()
    where outbox_id = :'outbox_dead_id') = 0,
  'a revoked device''s outbox row no longer surfaces as pending work');

commit;

-- ===========================================================================
-- Corrección del ciclo de verificación — retry real: reintentable no es lo
-- mismo que permanente
--
-- Ana todavía tiene un segundo dispositivo activo (el que no era
-- `device_dead_id`): su fila de outbox para la intercesión de Carla sigue
-- `pending`, intacta.
-- ===========================================================================
begin;
set local role service_role;

select id as outbox_retry_id from public.push_outbox
 where intercession_id = :'carla_intercession_id'
   and id <> :'outbox_dead_id' \gset

select pg_temp.assert(
  (select status from public.push_outbox where id = :'outbox_retry_id') = 'pending',
  'the other device''s row is still pending — the dead one did not touch it');

select pg_temp.assert(
  public.mark_push_delivery(:'outbox_retry_id', 'retryable_failure', null, 'MessageRateExceeded'),
  'a rate limit is accepted as a retryable outcome, not forced into failed');

select pg_temp.assert(
  (select status from public.push_outbox where id = :'outbox_retry_id') = 'pending'
    and (select attempts from public.push_outbox where id = :'outbox_retry_id') = 1
    and (select next_attempt_at from public.push_outbox where id = :'outbox_retry_id') > now(),
  'it stays pending, counts the attempt, and is rescheduled in the future — never failed, never "now"');

select pg_temp.assert(
  (select revoked_at from public.push_devices d
    join public.push_outbox o on o.device_id = d.id
    where o.id = :'outbox_retry_id') is null,
  'and the device is not touched at all — a rate limit says nothing about the token');

commit;

-- El tope real: agotar reintentos da por perdido el envío, pero sin la
-- afirmación de que el token está muerto — eso solo lo dice el proveedor.
-- Siete llamadas más (la primera de arriba ya cuenta como el intento 1):
-- llanas, sin `do $$ ... $$`, porque un bloque PL/pgSQL es su propio cuerpo
-- dollar-quoted y psql no sustituye variables `:'var'` dentro de ningún
-- dollar-quote — ni siquiera dentro de `$q$...$q$`, como probó en seco un
-- experimento aparte durante este ciclo de corrección. `format(..., %L, :'v')`
-- es el patrón correcto cuando la sustitución tiene que viajar hasta dentro
-- de un cuerpo SQL citado; aquí, más simple todavía, ocho llamadas sueltas.
begin;
set local role service_role;

select public.mark_push_delivery(:'outbox_retry_id', 'retryable_failure', null, 'transport_error');
select public.mark_push_delivery(:'outbox_retry_id', 'retryable_failure', null, 'transport_error');
select public.mark_push_delivery(:'outbox_retry_id', 'retryable_failure', null, 'transport_error');
select public.mark_push_delivery(:'outbox_retry_id', 'retryable_failure', null, 'transport_error');
select public.mark_push_delivery(:'outbox_retry_id', 'retryable_failure', null, 'transport_error');
select public.mark_push_delivery(:'outbox_retry_id', 'retryable_failure', null, 'transport_error');
select public.mark_push_delivery(:'outbox_retry_id', 'retryable_failure', null, 'transport_error');

select pg_temp.assert(
  (select status from public.push_outbox where id = :'outbox_retry_id') = 'failed',
  'after exhausting the real retry cap it gives up — as failed, not as "confirmed dead"');

select pg_temp.assert(
  (select attempts from public.push_outbox where id = :'outbox_retry_id') = 8,
  'every retry counted, cap included');

select pg_temp.assert(
  (select revoked_at from public.push_devices d
    join public.push_outbox o on o.device_id = d.id
    where o.id = :'outbox_retry_id') is null,
  'and the device stays active — giving up on retries is not a claim that the token is dead');

commit;

-- ===========================================================================
-- Corrección del ciclo de verificación — lease: dos invocaciones que se
-- solapan nunca reciben la misma fila
-- ===========================================================================
-- El día 2 es un fixture más, no una prueba del canal de escritura del
-- cliente: desde la ola ledger/cuota/lease el rol `authenticated` ya no escribe
-- `prayer_plan_days` directamente (solo `complete_generation_chunk`, definer),
-- así que se inserta como superuser, igual que el día 1 de arriba.
begin;

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values ('9051d000-0000-0000-0000-0000000000a3', '9051d000-0000-0000-0000-0000000000a1',
        2, 'Día dos', 'Privado', current_date);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into public.intercessions (plan_day_id, intercessor_id)
values ('9051d000-0000-0000-0000-0000000000a3', :BETO)
returning id as beto_day2_id \gset

commit;

begin;
set local role service_role;

select outbox_id as lease_outbox_id from public.claim_push_outbox_batch(10, 120)
 where intercession_id = :'beto_day2_id' \gset

select pg_temp.assert(
  :'lease_outbox_id' is not null,
  'the first invocation claims the fresh outbox row');

select pg_temp.assert(
  (select leased_until from public.push_outbox where id = :'lease_outbox_id') > now(),
  'and the row is leased into the near future');

select pg_temp.assert(
  (select count(*) from public.claim_push_outbox_batch(10, 120)
    where outbox_id = :'lease_outbox_id') = 0,
  'a second, overlapping invocation does not receive the same row — no duplicate send');

select pg_temp.assert(
  (select count(*) from public.pending_push_outbox()
    where outbox_id = :'lease_outbox_id') = 0,
  'and the diagnostic read agrees: a leased row is not "pending work" right now');

commit;

-- Simular que la primera invocación terminó (o murió) y el arriendo caducó:
-- la fila vuelve a ser reclamable, no se queda huérfana para siempre.
begin;
set local role service_role;

update public.push_outbox set leased_until = now() - interval '1 second'
 where id = :'lease_outbox_id';

select pg_temp.assert(
  (select count(*) from public.claim_push_outbox_batch(10, 120)
    where outbox_id = :'lease_outbox_id') = 1,
  'once the lease expires, the row is claimable again — reprogramada, no perdida');

commit;

-- ===========================================================================
-- Corrección del ciclo de verificación — bloqueo: ni se encola ni se
-- entrega si el dueño bloqueó a quien ora
-- ===========================================================================

-- Primero, el caso de selección: una fila que ya existía como `pending`
-- antes del bloqueo deja de ofrecerse en cuanto el bloqueo existe, aunque la
-- fila en sí no se toque.
-- El día 3 es un fixture (superuser), como el día 2: el rol `authenticated`
-- ya no escribe `prayer_plan_days` directamente.
begin;

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values ('9051d000-0000-0000-0000-0000000000a4', '9051d000-0000-0000-0000-0000000000a1',
        3, 'Día tres', 'Privado', current_date);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.intercessions (plan_day_id, intercessor_id)
values ('9051d000-0000-0000-0000-0000000000a4', :CARLA)
returning id as carla_preblock_id \gset

commit;

begin;
set local role service_role;

select pg_temp.assert(
  (select count(*) from public.push_outbox where intercession_id = :'carla_preblock_id') = 1,
  'before any block exists, praying enqueues a push exactly like always');

select pg_temp.assert(
  (select count(*) from public.pending_push_outbox()
    where intercession_id = :'carla_preblock_id') = 1,
  'and it is visible as pending work');

commit;

-- Ana bloquea a Carla. La fila de arriba no se borra ni se toca — deja de
-- ofrecerse, que es lo que importa para "no entregar".
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.blocks (blocker_id, blocked_id) values (:ANA, :CARLA);

commit;

begin;
set local role service_role;

select pg_temp.assert(
  (select count(*) from public.push_outbox where intercession_id = :'carla_preblock_id') = 1,
  'the row still exists — blocking is not a silent delete of history');

-- R1 S2: y deja de estar `pending`. Si siguiera así, el drenaje la vería
-- como trabajo cada minuto sin que el claim la cogiera nunca.
select pg_temp.assert(
  (select bool_and(status = 'skipped' and last_error = 'blocked')
     from public.push_outbox where intercession_id = :'carla_preblock_id'),
  'but it is marked skipped (blocked), so it stops looking like pending work');

select pg_temp.assert(
  (select count(*) from public.pending_push_outbox()
    where intercession_id = :'carla_preblock_id') = 0,
  'but it no longer surfaces as pending work once the owner has blocked the intercessor');

select pg_temp.assert(
  (select count(*) from public.claim_push_outbox_batch(50, 120)
    where intercession_id = :'carla_preblock_id') = 0,
  'and the sender cannot claim/lease it either — never delivered after a block');

commit;

-- Segundo caso, el de encolar: con el bloqueo ya en pie, una nueva oración de
-- la misma persona bloqueada no crea ninguna fila de outbox en absoluto.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.intercessions (plan_day_id, intercessor_id)
values ('9051d000-0000-0000-0000-0000000000a3', :CARLA)
returning id as carla_postblock_id \gset

commit;

begin;
set local role service_role;

select pg_temp.assert(
  (select count(*) from public.push_outbox where intercession_id = :'carla_postblock_id') = 0,
  'once blocked, a fresh prayer from Carla never gets a push outbox row at all');

commit;

-- Y quien no está bloqueado sigue funcionando con normalidad: el bloqueo es
-- específico de esa pareja dueño/intercesor, no un interruptor global.
begin;
set local role service_role;

select pg_temp.assert(
  (select count(*) from public.push_outbox where intercession_id = :'beto_day2_id') >= 1,
  'meanwhile Beto, who was never blocked, still has his push outbox row');

commit;

-- ===========================================================================
-- Corrección del ciclo de verificación — resolver el tap en el servidor,
-- nunca confiar en el payload
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select authorized from public.resolve_push_notification(:'lease_outbox_id')) = true
    and (select intercessor_name from public.resolve_push_notification(:'lease_outbox_id')) = 'Beto',
  'the real owner opening their own notification gets authorized, with who prayed');

commit;

-- Quien no es el dueño de la fila no puede usarla para nada, ni para
-- confirmar que existe: misma respuesta que un id que no existe en absoluto.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select authorized from public.resolve_push_notification(:'lease_outbox_id')) = false,
  'Beto himself — the intercessor, not the owner — is not authorized to resolve his own push to Ana');

select pg_temp.assert(
  (select authorized from public.resolve_push_notification(gen_random_uuid())) = false,
  'and a made-up outbox id is refused exactly the same way — no distinguishable error to probe with');

commit;

-- El bloqueo también cierra el tap, no solo la selección de trabajo: la
-- fila de Carla, ya bloqueada más arriba, tampoco autoriza a Ana a abrirla.
begin;
set local role service_role;

select id as carla_preblock_outbox_id from public.push_outbox
 where intercession_id = :'carla_preblock_id' \gset

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select authorized from public.resolve_push_notification(:'carla_preblock_outbox_id')) = false,
  'a notification about someone the owner has since blocked is never authorized either, even for the owner');

commit;

-- Sin sesión, ni intentarlo: la función no está concedida a `anon`.
begin;
set local role anon;

select pg_temp.assert(
  pg_temp.raises(format($q$ select * from public.resolve_push_notification(%L) $q$, :'lease_outbox_id')),
  'anon cannot call this at all — not even to get a polite "false"');

commit;

-- ===========================================================================
-- Revisión R1 (S2): lo que ya no va a salir deja de estar pendiente
--
-- Revocar un dispositivo —al cerrar sesión, o porque Expo dice que el token
-- está muerto— dejaba sus filas `pending` para siempre: el claim las ignora
-- y el drenaje las veía como trabajo cada minuto.
-- ===========================================================================
begin;

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status)
values ('9051d000-0000-0000-0000-0000000000b1', :ANA, 'Calma', 3, current_date, 'private', 'active');

insert into public.prayer_plan_days (id, plan_id, day_number, title, prayer_body, unlock_date)
values
  ('9051d000-0000-0000-0000-0000000000b2', '9051d000-0000-0000-0000-0000000000b1', 1, 'Uno', 'Privado', current_date),
  ('9051d000-0000-0000-0000-0000000000b3', '9051d000-0000-0000-0000-0000000000b1', 2, 'Dos', 'Privado', current_date);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.register_push_device('ExponentPushToken[ana-r1-logout]', 'ios');
select public.register_push_device('ExponentPushToken[ana-r1-dead]', 'android');

commit;

-- Beto ora dos días: dos filas por cada dispositivo vivo de Ana.
begin;

insert into public.intercessions (plan_day_id, intercessor_id)
values ('9051d000-0000-0000-0000-0000000000b2', :BETO),
       ('9051d000-0000-0000-0000-0000000000b3', :BETO);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.revoke_push_device('ExponentPushToken[ana-r1-logout]');

commit;

select pg_temp.assert(
  (select count(*) from public.push_outbox o
     join public.push_devices d on d.id = o.device_id
    where d.expo_push_token = 'ExponentPushToken[ana-r1-logout]') = 2
    and (select bool_and(o.status = 'skipped' and o.last_error = 'device_revoked')
           from public.push_outbox o
           join public.push_devices d on d.id = o.device_id
          where d.expo_push_token = 'ExponentPushToken[ana-r1-logout]'),
  'logging out a device marks what it had queued as skipped (device_revoked)');

select pg_temp.assert(
  (select bool_and(o.status = 'pending')
     from public.push_outbox o
     join public.push_devices d on d.id = o.device_id
    where d.expo_push_token = 'ExponentPushToken[ana-r1-dead]'),
  'and leaves the other device''s rows pending');

-- Un DeviceNotRegistered sobre una fila revoca el dispositivo: la otra fila
-- del mismo dispositivo tampoco saldrá nunca.
begin;
set local role service_role;

select o.id as r1_dead_first
  from public.push_outbox o
  join public.push_devices d on d.id = o.device_id
 where d.expo_push_token = 'ExponentPushToken[ana-r1-dead]'
 order by o.created_at, o.id
 limit 1 \gset

select public.mark_push_delivery(:'r1_dead_first', 'permanent_failure', null, 'DeviceNotRegistered');

commit;

select pg_temp.assert(
  (select status from public.push_outbox where id = :'r1_dead_first') = 'failed'
    and (select bool_and(o.status = 'skipped' and o.last_error = 'device_revoked')
           from public.push_outbox o
           join public.push_devices d on d.id = o.device_id
          where d.expo_push_token = 'ExponentPushToken[ana-r1-dead]'
            and o.id <> :'r1_dead_first'),
  'a dead token fails its own row and skips the rest of what that device had queued');

-- Volver a registrar el token no resucita avisos viejos.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.register_push_device('ExponentPushToken[ana-r1-logout]', 'ios');

commit;

select pg_temp.assert(
  (select count(*) from public.push_outbox o
     join public.push_devices d on d.id = o.device_id
    where d.expo_push_token = 'ExponentPushToken[ana-r1-logout]'
      and o.status = 'pending') = 0,
  'registering the same token again does not bring stale notifications back');

-- Y el drenaje, el claim y la lectura de diagnóstico usan el mismo predicado.
select pg_temp.assert(
  (select count(*) from public.push_outbox o
     join public.push_devices d on d.id = o.device_id
     join public.intercessions i on i.id = o.intercession_id
    where o.status = 'pending'
      and (d.revoked_at is not null
           or exists (select 1 from public.blocks b
                       where b.blocker_id = i.plan_owner_id
                         and b.blocked_id = i.intercessor_id))) = 0,
  'after all of that, nothing is left pending for a revoked device or a blocked pair');

select pg_temp.assert(
  (select count(*) from public.pending_push_outbox(200))
    = (select count(*) from public.push_outbox o
        where o.status = 'pending' and public.push_outbox_claimable(o)),
  'pending_push_outbox shows exactly what push_outbox_claimable accepts');

\echo '===================================='
\echo ' PUSH ASSERTIONS PASSED'
\echo '===================================='
