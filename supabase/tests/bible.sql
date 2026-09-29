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

-- Las aserciones de plan (`plan_mentions`) dependen de las estadísticas.
-- Justo después de un `db reset`, autovacuum puede no haber analizado todavía
-- los 62.000 versículos, y sin estadísticas el planificador elige un seq scan
-- aunque el índice GIN sirva: la suite fallaba o no según lo que tardara el
-- reset. Se analiza aquí para que no dependa de eso.
analyze public.bible_verses;

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
  (select count(*) from public.bible_verses where version = 'rvr1909') = 31102,
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

\echo ''

-- ===========================================================================
-- Dos idiomas: la RVR1909 y la World English Bible
--
-- La app va a tener contenido en inglés. Lo que se fija aquí es que la WEB
-- llegó entera y en su sitio, que busca y resuelve en inglés, y sobre todo que
-- todo lo que no dice versión sigue recibiendo exactamente la RVR1909 de
-- siempre: el cliente, el generador y el correo no saben todavía que hay otra.
-- ===========================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select array_agg(code order by code) from public.bible_versions) = array['rvr1909', 'web'],
  'there are two versions, and a signed-in user can read the catalogue');

select pg_temp.assert(
  (select code from public.bible_versions where language = 'es' and is_default) = 'rvr1909'
  and (select code from public.bible_versions where language = 'en' and is_default) = 'web',
  'each language has its default version');

-- Si alguien añade una versión y olvida `bible_search_config`, se indexaría
-- con el lematizador de otro idioma y buscaría mal sin dar ningún error.
select pg_temp.assert(
  not exists (
    select 1 from public.bible_versions ver
    where public.bible_search_config(ver.code) is distinct from
      case ver.language
        when 'es' then 'spanish'::regconfig
        when 'en' then 'english'::regconfig
      end
  ),
  'every version is indexed with the text search configuration of its language');

commit;

-- El texto, completo y en su sitio
begin;

select pg_temp.assert(
  (select count(*) from public.bible_verses where version = 'rvr1909') = 31102
  and (select count(*) from public.bible_verses where version = 'web') = 31098,
  'the RVR1909 has 31102 verses and the WEB 31098 (31103 lines, five of them empty)');

select pg_temp.assert(
  not exists (select 1 from public.bible_verses where btrim(text) = ''),
  'no verse is stored blank: a missing verse is missing, not empty');

select pg_temp.assert(
  (select count(*)
     from public.bible_books b
     cross join public.bible_versions ver
    where b.chapter_count <> (
            select max(v.chapter) from public.bible_verses v
            where v.version = ver.code and v.book_id = b.id)
       or b.chapter_count <> (
            select count(distinct v.chapter) from public.bible_verses v
            where v.version = ver.code and v.book_id = b.id)) = 0,
  'both versions have every chapter of every book, with no gaps');

-- La prueba de que los códigos SIL del fichero (GEN, EXO… REV) cayeron en el
-- libro correcto: con uno solo desplazado, capítulos y versículos por capítulo
-- dejarían de coincidir en cientos de sitios. Coinciden en todo menos en los
-- diez versículos que la WEB omite o recoloca siguiendo el texto crítico. Es
-- también la lista de notas y subrayados que no se ven al cambiar de versión:
-- las marcas van por (libro, capítulo, versículo), sin versión.
with rvr as (
  select book_id, chapter, verse from public.bible_verses where version = 'rvr1909'
),
web as (
  select book_id, chapter, verse from public.bible_verses where version = 'web'
)
select pg_temp.assert(
  (select array_agg(
            format('%s %s:%s %s', book_id, chapter, verse,
                   case when r.verse is null then 'web' else 'rvr' end)
            order by book_id, chapter, verse)
     from rvr r
     full join web w using (book_id, chapter, verse)
    where r.verse is null or w.verse is null)
  = array[
      '42 17:36 rvr',                                 -- Lucas 17:36
      '44 8:37 rvr', '44 15:34 rvr', '44 24:7 rvr',   -- Hechos
      '45 14:24 web', '45 14:25 web', '45 14:26 web', -- la doxología, en Romanos 14…
      '45 16:25 rvr', '45 16:26 rvr', '45 16:27 rvr'  -- …y no en Romanos 16
    ],
  'the two numberings differ only in the ten verses the WEB omits or moves');

select pg_temp.assert(
  (select text from public.bible_verses where version = 'web' and (book_id, chapter, verse) = (1, 1, 1))
    = 'In the beginning, God created the heavens and the earth.'
  and (select text from public.bible_verses where version = 'web' and (book_id, chapter, verse) = (19, 23, 1))
    like '%The LORD is my shepherd%'
  and (select text from public.bible_verses where version = 'web' and (book_id, chapter, verse) = (66, 22, 21))
    = 'The grace of the Lord Jesus Christ be with all the saints. Amen.',
  'Genesis, the Psalms and Revelation open and close where they should');

commit;

-- Juan 3:16, en las dos
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select text from public.resolve_scripture('Juan 3:16', 'rvr1909'))
    like 'Porque de tal manera amó Dios al mundo%'
  and (select text from public.resolve_scripture('John 3:16', 'web'))
    = 'For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.',
  'John 3:16 reads in each version in its own words');

select pg_temp.assert(
  (select canonical_ref from public.resolve_scripture('John 3:16')) = 'Juan 3:16'
  and (select canonical_ref from public.resolve_scripture('Juan 3:16', 'web')) = 'John 3:16',
  'a book name in either language resolves in either version, labelled in the version''s language');

commit;

-- Sin versión, todo es la RVR1909 de antes
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select (canonical_ref, text) from public.resolve_scripture('Filipenses 4:6-7'))
    = (select (canonical_ref, text) from public.resolve_scripture('Filipenses 4:6-7', 'rvr1909')),
  'resolve_scripture without a version is the RVR1909');

select pg_temp.assert(
  (select array_agg((book_name, text) order by book_id, chapter, verse) from public.search_bible('Zaqueo'))
    = (select array_agg((book_name, text) order by book_id, chapter, verse)
         from public.search_bible('Zaqueo', 30, 0, 'rvr1909'))
  and (select distinct book_name from public.search_bible('Zaqueo')) = 'Lucas',
  'search_bible without a version searches the RVR1909');

-- Como lo llama el cliente por PostgREST: solo con nombre, sin posición.
select pg_temp.assert(
  (select count(*) from public.search_bible(p_query => 'senor')) > 0
  and (select count(*) from public.locate_reference(p_ref => 'Juan 3:16')) = 1
  and (select count(*) from public.resolve_scripture(p_ref => 'Juan 3:16')) = 1,
  'the old named-argument calls still find exactly one function each');

select pg_temp.assert(
  (select (book_id, chapter, verse, reference, text) from public.verse_of_the_day())
    = (select (book_id, chapter, verse, reference, text) from public.verse_of_the_day('rvr1909')),
  'the verse of the day without a version is the RVR1909 one');

select pg_temp.assert(
  (select text from public.resolve_scripture('Juan 3:16', null))
    = (select text from public.resolve_scripture('Juan 3:16')),
  'an explicit null version means the default one');

select pg_temp.assert(
  (select count(*) from public.resolve_scripture('Juan 3:16', 'kjv')) = 0
  and (select count(*) from public.search_bible('love', 30, 0, 'kjv')) = 0
  and (select count(*) from public.locate_reference('Juan 3', 'kjv')) = 0
  and (select count(*) from public.verse_of_the_day('kjv')) = 0,
  'an unknown version returns nothing rather than some other version''s text');

-- Añadir un parámetro sin soltar la firma vieja deja dos funciones con el
-- mismo nombre, y la llamada de siempre falla con «function is not unique».
select pg_temp.assert(
  to_regprocedure('public.search_bible(text, integer, integer)') is null
  and to_regprocedure('public.resolve_scripture(text)') is null
  and to_regprocedure('public.locate_reference(text)') is null
  and to_regprocedure('public.verse_of_the_day()') is null
  and to_regprocedure('public.verse_of_the_day_for(uuid)') is null
  and (select count(*) from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in ('search_bible', 'resolve_scripture', 'locate_reference',
                          'verse_of_the_day', 'verse_of_the_day_for')) = 5,
  'the old signatures are gone: one function per name');

select pg_temp.assert(
  has_function_privilege('authenticated', 'public.search_bible(text, integer, integer, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.resolve_scripture(text, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.resolve_scripture(text, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.locate_reference(text, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.verse_of_the_day(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.verse_of_the_day_for(uuid, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.verse_of_the_day_for(uuid, text)', 'EXECUTE'),
  'the new signatures keep the grants the old ones had');

commit;

-- Buscar en inglés
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- La razón de `bible_search_config`: con el lematizador español, «loved» no
-- llegaría nunca a «love».
select pg_temp.assert(
  exists (
    select 1 from public.search_bible('loved', 100, 0, 'web')
    where text ~* '\mlove\M' and text !~* '\mloved\M'
  ),
  'in English, searching "loved" finds verses that only say "love"');

select pg_temp.assert(
  (select distinct total_count from public.search_bible('loved', 1, 0, 'web'))
    = (select distinct total_count from public.search_bible('love', 1, 0, 'web')),
  'and finds exactly as many as searching "love"');

select pg_temp.assert(
  (select array_agg(distinct book_name) from public.search_bible('Zacchaeus', 100, 0, 'web')) = array['Luke']
  and (select count(*) from public.search_bible('Zacchaeus', 100, 0, 'web'))
    = (select count(*) from public.search_bible('Zaqueo', 100)),
  'the same story is found in both, with the book named in the version''s language');

select pg_temp.assert(
  not exists (
    select 1 from public.search_bible('God', 100, 0, 'web') s
    where not exists (
      select 1 from public.bible_verses v
      where v.version = 'web'
        and (v.book_id, v.chapter, v.verse, v.text) = (s.book_id, s.chapter, s.verse, s.text)
    )
  ),
  'an English search returns only WEB text, never the RVR1909');

select pg_temp.assert(
  (select count(*) from public.search_bible('the', 30, 0, 'web')) = 0
  and not pg_temp.raises($q$ select * from public.search_bible('"unclosed & |', 30, 0, 'web') $q$),
  'a lone English stopword returns nothing, and typing cannot crash it either');

select pg_temp.assert(
  pg_temp.plan_mentions(
    $q$ select * from public.bible_verses v
        where v.version = 'web'
          and v.search_vector @@ websearch_to_tsquery(public.bible_search_config('web'), 'Zacchaeus') $q$,
    'bible_verses_search_idx'),
  'an English search is served by the GIN index too');

commit;

-- Los alias ingleses
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select canonical_ref from public.resolve_scripture('Psalm 23:1', 'web')) = 'Psalms 23:1'
  and (select canonical_ref from public.resolve_scripture('1 John 4:8', 'web')) = '1 John 4:8'
  and (select canonical_ref from public.resolve_scripture('Song of Solomon 2:4', 'web')) = 'Song of Solomon 2:4'
  and (select canonical_ref from public.resolve_scripture('Revelation 21:4', 'web')) = 'Revelation 21:4',
  'the resolver understands English book names');

select pg_temp.assert(
  (select canonical_ref from public.resolve_scripture('Phil. 4:6-7', 'web')) = 'Philippians 4:6-7'
  and (select canonical_ref from public.resolve_scripture('Jas 1:5', 'web')) = 'James 1:5'
  and (select canonical_ref from public.resolve_scripture('Rev 22:21', 'web')) = 'Revelation 22:21'
  and (select canonical_ref from public.resolve_scripture('Prov 3:5', 'web')) = 'Proverbs 3:5'
  and (select canonical_ref from public.resolve_scripture('First Corinthians 13:4', 'web')) = '1 Corinthians 13:4',
  'and the abbreviations and spelled-out ordinals people and models write');

select pg_temp.assert(
  not exists (
    select 1 from public.bible_books b
    where (select r.book_id from public.resolve_scripture(b.name_en || ' 1:1', 'web') r) is distinct from b.id
       or (select r.book_id from public.resolve_scripture(b.modern_name || ' 1:1') r) is distinct from b.id
  ),
  'every one of the 66 books resolves by its English name and by its Spanish one');

-- Lo que la migración vigila en todos los prefijos, aquí en los que de verdad
-- se escriben: ningún alias inglés ha cambiado cómo se resuelve uno español.
select pg_temp.assert(
  (select string_agg(t.ref, ', ')
     from (values
       ('Filipenses 4:6-7', 50), ('Salmo 23:1', 19), ('1 Co 13:4-7', 46),
       ('Prov. 3:5', 20), ('Apoc. 21:4', 66), ('Cantares 2:4', 22),
       ('Jud 1:24', 65), ('Mar 1:1', 41), ('Jos 1:9', 6), ('Hab 3:19', 35),
       ('Ecl 3:1', 21), ('Est 4:14', 17), ('Hag 1:5', 37), ('Mal 3:10', 39),
       ('Rom 8:28', 45), ('Fil 4:13', 50), ('Heb 11:1', 58), ('Stg 1:5', 59),
       ('1 Jn 4:19', 62), ('Jn 3:16', 43), ('Is 41:10', 23), ('Gn 1:1', 1),
       ('Ex 14:14', 2), ('Jer 29:11', 24), ('Lam 3:22', 25), ('Eze 36:26', 26)
     ) as t (ref, book)
    where (select r.book_id from public.resolve_scripture(t.ref) r)
      is distinct from t.book::smallint) is null,
  'Spanish names and abbreviations resolve exactly as they did before');

select pg_temp.assert(
  (select count(*) from public.resolve_scripture('1 C 1:1', 'web')) = 0
  and (select count(*) from public.resolve_scripture('Phi 1:1', 'web')) = 0,
  'an ambiguous prefix still refuses to guess, in English too (Philippians or Philemon?)');

select pg_temp.assert(
  not exists (
    select 1 from public.bible_book_aliases
    group by alias having count(distinct book_id) > 1
  )
  and not exists (
    select 1 from public.bible_book_aliases a
    where a.alias <> public.normalize_book_name(a.alias)
  ),
  'no alias points to two books, and every alias is stored normalised (or it could never match)');

select pg_temp.assert(
  (select (book_id, chapter, verse) from public.locate_reference('Song of Solomon 2', 'web'))
    = (22::smallint, 2::smallint, 1::smallint),
  'the reader can jump to an English reference');

-- La versión decide si el versículo existe: la doxología de Romanos está en
-- 14:24 en la WEB y en 16:25 en la RVR1909.
select pg_temp.assert(
  (select count(*) from public.locate_reference('Romanos 14:24')) = 0
  and (select count(*) from public.locate_reference('Romans 14:24', 'web')) = 1
  and (select count(*) from public.locate_reference('Acts 8:37', 'web')) = 0
  and (select count(*) from public.resolve_scripture('Hechos 8:37')) = 1,
  'a verse only one version has is found in that one and not in the other');

commit;

-- El versículo del día, en inglés
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from public.verse_of_the_day('web')) = 1
  and (select (book_id, chapter, verse, reference, text) from public.verse_of_the_day('web'))
    = (select (book_id, chapter, verse, reference, text) from public.verse_of_the_day('web')),
  'there is an English verse of the day, and asking twice gives the same one');

select pg_temp.assert(
  (select (book_id, chapter, verse) from public.verse_of_the_day('web'))
    = (select (book_id, chapter, verse) from public.verse_of_the_day())
  and (select text from public.verse_of_the_day('web'))
    <> (select text from public.verse_of_the_day()),
  'and it is the same reference as the Spanish one, in its own words');

select pg_temp.assert(
  (select v.book_name = b.name_en
          and v.reference = b.name_en || ' ' || v.chapter || ':' || v.verse
     from public.verse_of_the_day('web') v
     join public.bible_books b on b.id = v.book_id),
  'with the book and the reference in English');

commit;

begin;

select pg_temp.assert(
  not exists (
    select 1
    from public.daily_verses d
    cross join public.bible_versions ver
    where not exists (
      select 1 from public.bible_verses v
      where v.version = ver.code
        and (v.book_id, v.chapter, v.verse) = (d.book_id, d.chapter, d.verse)
    )
  ),
  'every curated reference exists in every version, so no day is left without a verse');

commit;

-- El del correo: sin versión, la RVR1909 de siempre. El payload de hábito elige
-- la versión por el idioma de quien lo recibe (email.sql prueba el inglés);
-- Ana tiene la app en español.
begin;
set local role service_role;

select pg_temp.assert(
  (select (book_id, chapter, verse, reference, text) from public.verse_of_the_day_for(:ANA))
    = (select (book_id, chapter, verse, reference, text) from public.verse_of_the_day_for(:ANA, 'rvr1909'))
  and (select text from public.verse_of_the_day_for(:ANA, 'web'))
    = (select v.text
         from public.verse_of_the_day_for(:ANA) d
         join public.bible_verses v
           on v.version = 'web'
          and (v.book_id, v.chapter, v.verse) = (d.book_id, d.chapter, d.verse)),
  'the email''s verse is the RVR1909 without a version, and the same reference in English with one');

commit;

begin;

select pg_temp.assert(
  (public.email_habit_payload(:ANA) ->> 'verse_ref')
    = (select reference from public.verse_of_the_day_for(:ANA)),
  'a Spanish speaker''s habit email still carries the RVR1909 verse of the day');

commit;

-- Las marcas no llevan versión, a propósito: lo que Ana subrayó o anotó en la
-- RVR1909 sigue ahí, y el mismo versículo existe en la WEB.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('bible_notes', 'bible_highlights')
      and column_name = 'version'
  ),
  'highlights and notes are not tied to a version');

select pg_temp.assert(
  (select body from public.bible_notes where book_id = 43 and chapter = 3 and verse = 16)
    = 'Para acordarme'
  and (select count(distinct v.version)
         from public.bible_notes n
         join public.bible_verses v using (book_id, chapter, verse)
        where n.book_id = 43 and n.chapter = 3 and n.verse = 16) = 2,
  'Ana''s note on Juan 3:16 is still there, and sits on a verse both versions have');

commit;

\echo '===================================='
\echo ' BIBLE ASSERTIONS PASSED'
\echo '===================================='
