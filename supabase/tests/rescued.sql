\set ON_ERROR_STOP on

-- Las ocho migraciones rescatadas el 2026-09-29 (supabase/rescue/2026-09-29).
-- Vivieron aplicadas en una base local sin fichero ni test; esta suite es lo
-- que las ata al repo. Una sección por migración, en el orden en que se
-- aplican.

\set ROSA '''e1111111-1111-1111-1111-111111111111'''
\set TEO  '''e2222222-2222-2222-2222-222222222222'''
\set UMA  '''e3333333-3333-3333-3333-333333333333'''
\set VERA '''e4444444-4444-4444-4444-444444444444'''

\set G1 '''eeee0000-0000-0000-0000-000000000001'''
\set G2 '''eeee0000-0000-0000-0000-000000000002'''
\set G3 '''eeee0000-0000-0000-0000-000000000003'''

\set DM   '''eeee1111-0000-0000-0000-000000000001'''
\set P1   '''eeee2222-0000-0000-0000-000000000001'''
\set P2   '''eeee2222-0000-0000-0000-000000000002'''
\set R1   '''eeee3333-0000-0000-0000-000000000001'''
\set R2   '''eeee3333-0000-0000-0000-000000000002'''
\set GP1  '''eeee4444-0000-0000-0000-000000000001'''
\set GP2  '''eeee4444-0000-0000-0000-000000000002'''

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
-- ===========================================================================
begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:ROSA, 'rosa@test.local', 'authenticated', 'authenticated', '{"display_name":"Rosa"}'),
  (:TEO,  'teo@test.local',  'authenticated', 'authenticated', '{"display_name":"Teo"}'),
  (:UMA,  'uma@test.local',  'authenticated', 'authenticated', '{"display_name":"Uma"}'),
  (:VERA, 'vera@test.local', 'authenticated', 'authenticated', '{"display_name":"Vera"}');

update public.profiles set is_staff = true where id = :ROSA;

insert into public.groups (id, owner_id, name, visibility)
values
  (:G1, :UMA, 'Círculo del rescate', 'private'),
  (:G2, :UMA, 'Círculo a medias', 'private'),
  (:G3, :UMA, 'Círculo de los empates', 'private');

insert into public.group_members (group_id, user_id)
values
  (:G1, :UMA), (:G1, :TEO), (:G1, :VERA), (:G1, :ROSA),
  (:G2, :UMA), (:G2, :VERA),
  (:G3, :UMA), (:G3, :VERA)
on conflict do nothing;

commit;

select id as conv_g1 from public.conversations
 where group_id = 'eeee0000-0000-0000-0000-000000000001' \gset


-- ===========================================================================
-- export_personal_collections (fusionada con email_lifecycle)
--
-- El export es un derecho: todo lo que la persona escribió tiene que ir
-- dentro. La versión rescatada añadía cuatro colecciones y la de correo las
-- preferencias y `last_seen_at`; el merge tiene que llevar las dos cosas.
-- ===========================================================================
begin;

insert into public.prayer_list_items (user_id, body) values (:VERA, 'Por mi hermana');
insert into public.bible_notes (user_id, book_id, chapter, verse, body)
values (:VERA, 43, 3, 16, 'El versículo de mi abuela');
insert into public.bible_highlights (user_id, book_id, chapter, verse)
values (:VERA, 43, 3, 17);
insert into public.plus_waitlist (user_id, name, email)
values (:VERA, 'Vera', 'vera@test.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e4444444-4444-4444-4444-444444444444","role":"authenticated"}';

select public.export_my_data() as export \gset

select pg_temp.assert(
  jsonb_array_length((:'export')::jsonb -> 'prayer_list') = 1
    and jsonb_array_length((:'export')::jsonb -> 'bible_notes') = 1
    and jsonb_array_length((:'export')::jsonb -> 'bible_highlights') = 1
    and jsonb_array_length((:'export')::jsonb -> 'plus_waitlist') = 1,
  'export carries the prayer list, notes, highlights and the Plus waitlist');

select pg_temp.assert(
  (:'export')::jsonb ? 'email_preferences'
    and ((:'export')::jsonb -> 'profile') ? 'last_seen_at',
  'export keeps what email_lifecycle added: email preferences and last_seen_at');

select pg_temp.assert(
  (:'export')::jsonb ? 'blocked' and (:'export')::jsonb ? 'following',
  'export keeps the sections that were already there');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e3333333-3333-3333-3333-333333333333","role":"authenticated"}';

select pg_temp.assert(
  jsonb_array_length(public.export_my_data() -> 'bible_notes') = 0,
  'someone else''s export does not see Vera''s notes (owner filter under SECURITY DEFINER)');

commit;


-- ===========================================================================
-- circle_chat_membership
--
-- La marca de lectura (`conversation_members`) no es pertenencia. Quien sale
-- de un círculo conserva su fila de lectura, y esa fila le dejaba seguir
-- leyendo y escribiendo en el chat.
-- ===========================================================================
begin;

insert into public.conversation_members (conversation_id, user_id)
values (:'conv_g1', :TEO)
on conflict do nothing;

insert into public.messages (conversation_id, sender_id, body)
values (:'conv_g1', :UMA, 'Hoy oramos por el viaje de Teo');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.messages where conversation_id = :'conv_g1') = 1,
  'a circle member reads the circle chat');

commit;

delete from public.group_members where group_id = :G1 and user_id = :TEO;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.messages where conversation_id = :'conv_g1') = 0,
  'after leaving, the leftover read marker no longer opens the chat');

select pg_temp.assert(
  pg_temp.raises(format(
    'insert into public.messages (conversation_id, sender_id, body) values (%L, %L, %L)',
    :'conv_g1', :TEO, 'sigo aquí')),
  'after leaving, sending to the circle chat is refused');

commit;

-- Una conversación sin círculo sigue funcionando con la pertenencia explícita.
begin;

insert into public.conversations (id, group_id, created_by) values (:DM, null, :UMA);
insert into public.conversation_members (conversation_id, user_id)
values (:DM, :UMA), (:DM, :TEO);
insert into public.messages (conversation_id, sender_id, body)
values (:DM, :UMA, 'Un mensaje fuera de los círculos');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.messages where conversation_id = :DM) = 1,
  'a conversation without a circle still honours explicit membership');

commit;


-- ===========================================================================
-- visible_comment_counts
--
-- El contador guardado cuenta todo, también lo oculto, lo retenido y lo de
-- gente bloqueada. El feed tiene que enseñar el número que la persona puede
-- abrir y leer, no uno que le promete comentarios que no verá.
-- ===========================================================================
begin;

insert into public.posts (id, author_id, group_id, body)
values (:P1, :UMA, :G1, 'Oramos por la operación de mi madre');

insert into public.comments (post_id, author_id, body, hidden_at)
values
  (:P1, :UMA,  'Gracias a todos', null),
  (:P1, :UMA,  'Este lo ocultó un admin', now()),
  (:P1, :ROSA, 'Contad conmigo', null);

insert into public.blocks (blocker_id, blocked_id) values (:VERA, :ROSA);

set local role authenticated;
set local request.jwt.claims = '{"sub":"e4444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  (select comment_count from public.prayer_feed(:G1) where id = :P1) = 1,
  'the feed counts only the comments this viewer can read (not hidden, not blocked)');

commit;


-- ===========================================================================
-- reservation_owner_date
--
-- El plan tiene que empezar en el día del calendario de su dueño, el mismo
-- que usa el desbloqueo de días. Con UTC, alguien en Kiritimati (UTC+14)
-- reservaba un plan que empezaba «ayer» o «mañana» según la hora.
-- ===========================================================================
begin;

update public.profile_settings set timezone = 'Pacific/Kiritimati' where id = :VERA;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e4444444-4444-4444-4444-444444444444","role":"authenticated"}';

select plan_id as vera_plan
  from public.reserve_generation(gen_random_uuid(), 'personal', 7::smallint) \gset

select pg_temp.assert(
  (select start_date from public.prayer_plans where id = :'vera_plan')
    = public.local_today(:VERA),
  'a reserved plan starts on the owner''s local day');

commit;


-- ===========================================================================
-- circle_plan_completion
--
-- Un plan de círculo termina cuando están todos sus días y el último ya se
-- desbloqueó antes de hoy. Hasta entonces sigue vivo aunque falte poco.
-- ===========================================================================
begin;

insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, group_id, status)
values
  (:GP1, :UMA, 'Plan que ya acabó', 3, public.local_today(:UMA) - 5, 'group', :G1, 'active'),
  (:GP2, :UMA, 'Plan que acaba hoy', 3, public.local_today(:UMA) - 2, 'group', :G2, 'active');

insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body, unlock_date)
select plan_id, n, 'Día ' || n, 'Señor, acompáñanos.', start_date + (n - 1)
  from (values (:GP1::uuid), (:GP2::uuid)) v(plan_id)
  join public.prayer_plans p on p.id = v.plan_id
  cross join generate_series(1, 3) n;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e4444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  (select finished from public.circle_plan(:G1)) is true,
  'a circle plan whose last day unlocked before today is finished');

select pg_temp.assert(
  (select finished from public.circle_plan(:G2)) is false,
  'a circle plan whose last day unlocks today is not finished yet');

select pg_temp.assert(
  (select day_number from public.circle_plan(:G1)) = 3,
  'a finished circle plan still shows its last day to read');

commit;


-- ===========================================================================
-- reported_content_moderation
--
-- El staff oculta lo reportado a partir del reporte, no de un id cualquiera,
-- y queda escrito quién lo hizo.
-- ===========================================================================
begin;

insert into public.posts (id, author_id, group_id, body)
values (:P2, :UMA, :G1, 'Un post que alguien reportó');

insert into public.reports (id, reporter_id, target_type, target_id, reason, status)
values
  (:R1, :VERA, 'post', :P2, 'spam', 'open'),
  (:R2, :VERA, 'post', :P1, 'spam', 'dismissed');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e4444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  public.hide_reported_content(:R1) is false,
  'someone who is not staff cannot hide reported content');

commit;

select pg_temp.assert(
  (select hidden_at from public.posts where id = :P2) is null,
  'the refused attempt left the post untouched');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  public.hide_reported_content(:R1) is true,
  'staff hides the content of an open report');

select pg_temp.assert(
  public.hide_reported_content(:R2) is false,
  'a report that is no longer open hides nothing');

commit;

select pg_temp.assert(
  (select hidden_at is not null and hidden_by = :ROSA from public.posts where id = :P2),
  'the hidden post records the staff member who hid it');

select pg_temp.assert(
  (select hidden_at from public.posts where id = :P1) is null,
  'the dismissed report did not hide its post');


-- ===========================================================================
-- open_crisis_queue
--
-- La cola de crisis tiene que enseñar todo lo abierto, de lo más antiguo a lo
-- más nuevo. La RPC original paraba en 30 y su cursor de solo timestamp
-- perdía filas empatadas.
-- ===========================================================================
begin;

insert into public.crisis_escalations (target_type, target_id, author_id, created_at)
select 'post', gen_random_uuid(), :UMA, timestamptz '2026-09-01 10:00:00+00'
  from generate_series(1, 20);

insert into public.crisis_escalations (target_type, target_id, author_id, created_at)
select 'post', gen_random_uuid(), :UMA, timestamptz '2026-09-01 10:00:00+00' + n * interval '1 minute'
  from generate_series(1, 15) n;

insert into public.crisis_escalations (target_type, target_id, author_id, created_at, acknowledged_at, acknowledged_by)
select 'post', gen_random_uuid(), :UMA, timestamptz '2026-08-01 10:00:00+00', now(), :ROSA
  from generate_series(1, 3);

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  r record;
  v_last record;
  v_seen uuid[] := '{}';
  n1 integer := 0;
  n2 integer := 0;
begin
  for r in select * from public.open_crisis_queue(null, null, 30) loop
    v_seen := v_seen || r.id;
    n1 := n1 + 1;
    v_last := r;
  end loop;

  for r in select * from public.open_crisis_queue(v_last.created_at, v_last.id, 30) loop
    if r.id = any(v_seen) then
      raise exception 'FAIL  crisis queue repeated a row across pages';
    end if;
    v_seen := v_seen || r.id;
    n2 := n2 + 1;
  end loop;

  perform pg_temp.assert(n1 = 30 and n2 = 5,
    'the crisis queue walks all 35 open escalations in two pages, ties included');
end;
$$;

select pg_temp.assert(
  (select bool_and(acknowledged_at is null) from public.open_crisis_queue(null, null, 50)),
  'acknowledged escalations stay out of the open queue');

select pg_temp.assert(
  pg_temp.raises($q$select * from public.open_crisis_queue(now(), null, 30)$q$),
  'half a cursor is refused');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e4444444-4444-4444-4444-444444444444","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.open_crisis_queue(null, null, 50)) = 0,
  'someone who is not staff sees an empty crisis queue');

commit;


-- ===========================================================================
-- stable_list_pagination
--
-- Los feeds paginaban solo por `created_at`: tres posts en el mismo instante y
-- una página que cortara entre ellos perdían o repetían uno. El cursor
-- compuesto (created_at, id) no.
-- ===========================================================================
begin;

insert into public.posts (author_id, group_id, body, created_at)
select :UMA, :G3, 'Petición empatada ' || n, timestamptz '2026-09-10 08:00:00+00'
  from generate_series(1, 3) n;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e4444444-4444-4444-4444-444444444444","role":"authenticated"}';

do $$
declare
  r record;
  v_last record;
  v_seen uuid[] := '{}';
  n1 integer := 0;
  n2 integer := 0;
begin
  for r in select * from public.prayer_feed_page('eeee0000-0000-0000-0000-000000000003', null, 2, null) loop
    v_seen := v_seen || r.id;
    n1 := n1 + 1;
    v_last := r;
  end loop;

  for r in select * from public.prayer_feed_page('eeee0000-0000-0000-0000-000000000003', v_last.created_at, 2, v_last.id) loop
    if r.id = any(v_seen) then
      raise exception 'FAIL  prayer_feed_page repeated a row across pages';
    end if;
    v_seen := v_seen || r.id;
    n2 := n2 + 1;
  end loop;

  perform pg_temp.assert(n1 = 2 and n2 = 1,
    'prayer_feed_page walks three posts with the same timestamp without losing one');
end;
$$;

commit;
