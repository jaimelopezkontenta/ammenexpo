\set ON_ERROR_STOP on

-- The scripture corpus as something people read, not just something the plan
-- generator checks itself against.

\set ANA '''11111111-1111-1111-1111-111111111111'''
\set BETO '''22222222-2222-2222-2222-222222222222'''

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

-- Calls a function and reports whether it raised, without caring what it
-- returned. Used to prove the search cannot be crashed by ordinary typing.
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

-- Reads a query plan and says whether it mentions something. Used to prove the
-- search index is genuinely chosen rather than merely present.
create or replace function pg_temp.plan_mentions(stmt text, needle text)
returns boolean language plpgsql as $$
declare
  line text;
begin
  for line in execute 'explain (costs off) ' || stmt loop
    if line like '%' || needle || '%' then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

begin;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  (:ANA,  'ana-bible@test.local',  'authenticated', 'authenticated', '{"display_name":"Ana"}'),
  (:BETO, 'beto-bible@test.local', 'authenticated', 'authenticated', '{"display_name":"Beto"}');

commit;

-- ===========================================================================
-- chapter_count is materialised, so it has to be provably right
--
-- This is the assertion that makes the column safe. Without it, a future reload
-- of the corpus that forgets the backfill would silently truncate every book.
-- ===========================================================================
begin;

select pg_temp.assert(
  (select count(*) from public.bible_books b
    where b.chapter_count <> (
      select max(v.chapter) from public.bible_verses v where v.book_id = b.id
    )) = 0,
  'no book disagrees with its own verses about how many chapters it has');

select pg_temp.assert(
  (select sum(chapter_count) from public.bible_books) = 1189,
  'the chapter counts add up to the 1189 chapters in the corpus');

select pg_temp.assert(
  (select count(*) from public.bible_books b
    where b.chapter_count <> (
      select count(distinct v.chapter) from public.bible_verses v where v.book_id = b.id
    )) = 0,
  'and no book has a gap in its chapter numbering');

commit;

-- ===========================================================================
-- Search: what it does
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- La eñe no es una n acentuada: la configuración `spanish` la conserva, así
-- que hasta la migración de unaccent `senor` devolvía CERO de los 1.412
-- versículos que dicen "Señor". La palabra más frecuente del corpus, y la que
-- cualquiera escribe sin eñe en un teclado de móvil.
select pg_temp.assert(
  (select count(*) from public.search_bible('senor')) > 0,
  'searching "senor" finds "Señor"');

select pg_temp.assert(
  (select count(*) from public.search_bible('senor'))
    = (select count(*) from public.search_bible('señor')),
  'and finds exactly the same verses as typing the eñe');

select pg_temp.assert(
  (select count(*) from public.search_bible('corazon')) > 0,
  'searching without accents finds something');

-- The reason the index exists at all: nobody types accents on a phone.
select pg_temp.assert(
  exists (select 1 from public.search_bible('corazon') where text like '%corazón%'),
  'and what it finds includes verses written with the accent');

select pg_temp.assert(
  exists (select 1 from public.search_bible('oracion') where text like '%oración%'),
  'the same holds for oración');

select pg_temp.assert(
  (select count(*) from public.search_bible('Zaqueo')) > 0,
  'a rare proper noun is findable');

-- Canonical order, not relevance: a reader expects Génesis before Apocalipsis.
with numbered as (
  select row_number() over () as position, book_id, chapter, verse
  from public.search_bible('misericordia', 30)
)
select pg_temp.assert(
  not exists (
    select 1
    from numbered a
    join numbered b on b.position = a.position + 1
    where (b.book_id, b.chapter, b.verse) < (a.book_id, a.chapter, a.verse)
  ),
  'results come back in canonical order');

select pg_temp.assert(
  (select count(*) from public.search_bible('Dios', 10)) = 10,
  'the limit is respected');

select pg_temp.assert(
  (select distinct total_count from public.search_bible('Zaqueo'))
    = (select count(*) from public.search_bible('Zaqueo', 100)),
  'total_count reports the full match count, not the page size');

commit;

-- ===========================================================================
-- Search: what it deliberately does NOT do
--
-- Pinned as a decision rather than left as an accident. The Spanish stemmer
-- gives amor -> amor and amó -> amo, so they do not meet. Making them meet
-- would mean fuzzy matching, which on 31,102 short verses produces noise.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not exists (select 1 from public.search_bible('amor', 100) where text like '%amó%' and text not like '%amor%'),
  'searching "amor" does not quietly return "amó"');

commit;

-- ===========================================================================
-- Search cannot be crashed by ordinary typing
--
-- This is the whole reason for websearch_to_tsquery: to_tsquery raises a syntax
-- error on every one of these.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not pg_temp.raises($q$ select * from public.search_bible('') $q$),
  'an empty query does not raise');

select pg_temp.assert(
  not pg_temp.raises($q$ select * from public.search_bible('   ') $q$),
  'nor does whitespace');

select pg_temp.assert(
  not pg_temp.raises($q$ select * from public.search_bible(':::') $q$),
  'nor does punctuation');

select pg_temp.assert(
  not pg_temp.raises($q$ select * from public.search_bible('a & | b') $q$),
  'nor do tsquery operators typed as plain text');

select pg_temp.assert(
  not pg_temp.raises($q$ select * from public.search_bible('"sin cerrar') $q$),
  'nor does an unclosed quote');

select pg_temp.assert(
  (select count(*) from public.search_bible('')) = 0
  and (select count(*) from public.search_bible('   ')) = 0
  and (select count(*) from public.search_bible(':::')) = 0,
  'and all of them return nothing rather than everything');

select pg_temp.assert(
  (select count(*) from public.search_bible('de la')) = 0,
  'a query of nothing but stopwords returns nothing');

commit;

-- ===========================================================================
-- The index is actually used
--
-- Deliberately a rare term: with a common word the planner would correctly
-- choose a sequential scan and the assertion would be flaky rather than wrong.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.plan_mentions(
    $q$ select * from public.bible_verses v
        where v.search_vector @@ websearch_to_tsquery('spanish'::regconfig, 'Zaqueo') $q$,
    'bible_verses_search_idx'),
  'a rare term is served by the GIN index, not a sequential scan');

commit;

-- ===========================================================================
-- locate_reference: jump to a reference, or refuse to guess
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select (book_id, chapter, verse) from public.locate_reference('Juan')) = (43::smallint, 1::smallint, 1::smallint),
  'a book alone lands on chapter one, verse one');

select pg_temp.assert(
  (select (book_id, chapter, verse) from public.locate_reference('Juan 3')) = (43::smallint, 3::smallint, 1::smallint),
  'a chapter with no verse lands on its first verse');

select pg_temp.assert(
  (select (book_id, chapter, verse) from public.locate_reference('Juan 3:16')) = (43::smallint, 3::smallint, 16::smallint),
  'a full reference lands exactly');

select pg_temp.assert(
  (select (book_id, chapter, verse) from public.locate_reference('1 Co 13')) = (46::smallint, 13::smallint, 1::smallint),
  'an abbreviation resolves');

select pg_temp.assert(
  (select (book_id, chapter, verse) from public.locate_reference('sal 23')) = (19::smallint, 23::smallint, 1::smallint),
  'lowercase and abbreviated still resolves');

select pg_temp.assert(
  (select count(*) from public.locate_reference('Salmo 151')) = 0,
  'a chapter beyond the end of the book resolves to nothing');

select pg_temp.assert(
  (select count(*) from public.locate_reference('Juan 3:99')) = 0,
  'and so does a verse that does not exist');

select pg_temp.assert(
  (select count(*) from public.locate_reference('Zzz 3')) = 0,
  'an unknown book resolves to nothing');

-- The same ambiguity guard resolve_scripture has: Corintios or Crónicas?
select pg_temp.assert(
  (select count(*) from public.locate_reference('1 C 1')) = 0,
  'an ambiguous prefix refuses to guess');

select pg_temp.assert(
  (select count(*) from public.locate_reference('')) = 0,
  'an empty reference resolves to nothing');

commit;

-- ===========================================================================
-- Who can read scripture
-- ===========================================================================
begin;
set local role service_role;

select pg_temp.assert(
  (select count(*) from public.bible_verses) = 31102,
  'service_role can read scripture, which it could not before');

select pg_temp.assert(
  (select count(*) from public.bible_book_aliases) > 0,
  'including the aliases resolve_scripture needs');

commit;

begin;
set local role anon;

select pg_temp.assert(
  pg_temp.raises($q$ select count(*) from public.bible_verses $q$),
  'anon still cannot read scripture: an account is required');

commit;

-- ===========================================================================
-- The reading position is private
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.profile_settings
   set last_read_book_id = 19, last_read_chapter = 23, last_read_verse = 1,
       last_read_at = now()
 where id = :ANA;

select pg_temp.assert(
  (select last_read_chapter from public.profile_settings where id = :ANA) = 23,
  'Ana can save where she stopped reading');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.profile_settings where id = :ANA) = 0,
  'Beto cannot see what Ana is reading');

update public.profile_settings set last_read_chapter = 1 where id = :ANA;

commit;

begin;

select pg_temp.assert(
  (select last_read_chapter from public.profile_settings where id = :ANA) = 23,
  'and cannot change it either');

select pg_temp.assert(
  pg_temp.raises($q$
    update public.profile_settings set last_read_book_id = 19, last_read_chapter = null
    where id = '11111111-1111-1111-1111-111111111111'
  $q$),
  'a half-set reading position is rejected: it would point nowhere');

commit;

\echo ''

-- ===========================================================================
-- El versículo del día
--
-- Sin plan activo la app no tenía nada que ofrecer. Lo que se fija aquí es que
-- **el mismo día da lo mismo** —es lo que permite hablar de él y lo que hace
-- que no cambie si abres la app dos veces— y que la lista está curada, no
-- sacada al azar de 31.102 versículos.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.verse_of_the_day()) = 1,
  'there is a verse for today');

select pg_temp.assert(
  (select text from public.verse_of_the_day())
    = (select text from public.verse_of_the_day()),
  'and asking twice on the same day gives the same one');

select pg_temp.assert(
  (select length(text) from public.verse_of_the_day()) > 0
  and (select reference from public.verse_of_the_day()) like '% %:%',
  'with its text and a reference that reads like one');

commit;

-- Cada referencia de la lista existe de verdad en la RVR1909. Sin esto, una
-- errata en un número deja a alguien con una tarjeta vacía un día suelto, meses
-- después de haberla escrito.
begin;

select pg_temp.assert(
  not exists (
    select 1 from public.daily_verses d
    where not exists (
      select 1 from public.bible_verses v
      where v.book_id = d.book_id
        and v.chapter = d.chapter
        and v.verse = d.verse
    )
  ),
  'every curated reference resolves against the RVR1909');

select pg_temp.assert(
  (select count(*) from public.daily_verses) >= 50,
  'and there are enough of them that the list does not repeat within a month');

-- El recorrido de la lista es completo antes de repetir: con `mod` sobre los
-- días, cincuenta fechas seguidas dan cincuenta versículos distintos.
select pg_temp.assert(
  (
    select count(distinct 1 + ((d::date - date '2026-01-01') % 50))
    from generate_series(
      timestamp '2026-03-01', timestamp '2026-04-19', interval '1 day'
    ) as d
  ) = 50,
  'and fifty days in a row give fifty different ones');

commit;


-- ===========================================================================
-- La Biblia con rastro
--
-- El lector llevaba desde la Fase 4.10 siendo de solo lectura: se podía buscar,
-- navegar y continuar donde lo dejaste, y no se podía dejar marca de nada.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- La regla 1, para las dos tablas nuevas.
with inserted as (
  insert into public.bible_highlights (user_id, book_id, chapter, verse)
  values ('11111111-1111-1111-1111-111111111111', 43, 3, 16)
  returning verse
)
select pg_temp.assert(
  (select count(*) from inserted) = 1,
  'insert ... returning works on bible_highlights (rule 1)');

with inserted as (
  insert into public.bible_notes (user_id, book_id, chapter, verse, body)
  values ('11111111-1111-1111-1111-111111111111', 43, 3, 16, 'Para acordarme')
  returning id
)
select pg_temp.assert(
  (select count(*) from inserted) = 1,
  'and on bible_notes');

commit;

-- Subrayar dos veces el mismo versículo no duplica: la clave primaria compuesta
-- es lo que hace que poner y quitar sea seguro sin consultar antes de escribir.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.bible_highlights (user_id, book_id, chapter, verse)
    values ('11111111-1111-1111-1111-111111111111', 43, 3, 16)
  $q$),
  'the same verse cannot be highlighted twice');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.bible_notes (user_id, book_id, chapter, verse, body)
    values ('11111111-1111-1111-1111-111111111111', 43, 3, 16, 'Otra')
  $q$),
  'and a verse holds one note, which is edited rather than stacked');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.bible_notes (user_id, book_id, chapter, verse, body)
    values ('11111111-1111-1111-1111-111111111111', 43, 3, 17, '   ')
  $q$),
  'an empty note is refused instead of stored as a blank margin');

commit;

-- Lo que subrayas no lo ve nadie, y lo que escribes al margen menos todavía.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.bible_highlights) = 0
  and (select count(*) from public.bible_notes) = 0,
  'nobody else sees a highlight or a note of yours');

select pg_temp.assert(
  pg_temp.raises($q$
    insert into public.bible_notes (user_id, book_id, chapter, verse, body)
    values ('11111111-1111-1111-1111-111111111111', 43, 3, 18, 'Colada')
  $q$),
  'nor can anybody write in your margin');

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

delete from public.bible_highlights where book_id = 43 and chapter = 3 and verse = 16;

select pg_temp.assert(
  (select count(*) from public.bible_highlights) = 0,
  'and taking a highlight off works');

commit;

\echo '===================================='
\echo ' BIBLE ASSERTIONS PASSED'
\echo '===================================='
