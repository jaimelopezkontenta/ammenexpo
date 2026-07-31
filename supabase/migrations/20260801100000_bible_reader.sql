-- Ammen — turning the scripture corpus into something people can read.
--
-- The 31,102 verses have been here since the plan generator was built, where
-- they serve only to prove that a reference the model produced actually exists.
-- Nobody can read them. This adds the three things a reader needs that the data
-- does not already provide.

-- ---------------------------------------------------------------------------
-- 1. Chapter counts
--
-- max(chapter) per book is a sequential scan of 31,102 rows to produce 66
-- numbers that cannot change: bible_verses is loaded by migration and no
-- runtime code path writes to it. Materialising it lets the book index and the
-- chapter grid share one 66-row query.
--
-- No trigger, because there is no insert to keep in sync — the integrity
-- assertion in supabase/tests/bible.sql is the guard instead, and it fires if
-- the corpus is ever reloaded without a backfill.
--
-- No GRANT change either: grants are table-level and cover new columns. This is
-- the one place the usual "new thing needs a grant" rule does not apply.
-- ---------------------------------------------------------------------------

alter table public.bible_books add column chapter_count smallint;

update public.bible_books b
   set chapter_count = (
     select max(v.chapter) from public.bible_verses v where v.book_id = b.id
   );

alter table public.bible_books
  alter column chapter_count set not null,
  add constraint bible_books_chapter_count_positive check (chapter_count > 0);

-- ---------------------------------------------------------------------------
-- 2. Search
--
-- The two-argument to_tsvector is IMMUTABLE (the one-argument form is only
-- STABLE, because it reads default_text_search_config), which is what allows a
-- generated column.
--
-- No custom text search configuration and no unaccent dictionary: Postgres's
-- built-in 'spanish' config already folds accents while stemming — Jehová
-- becomes jehov, Espíritu becomes espiritu, corazón becomes corazon. So typing
-- "corazon" on a phone keyboard finds "corazón" with nothing extra, and we
-- avoid the "if you ALTER the configuration you must REINDEX" trap.
--
-- A stored generated column rather than an expression index, because PostgREST
-- builds an index-usable predicate against a tsvector column, whereas
-- `text @@ tsquery` would apply the default configuration and miss the index.
-- ---------------------------------------------------------------------------

alter table public.bible_verses
  add column search_vector tsvector
  generated always as (to_tsvector('spanish'::regconfig, text)) stored;

create index bible_verses_search_idx
  on public.bible_verses using gin (search_vector);

create function public.search_bible(
  p_query text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  book_id smallint,
  book_name text,
  chapter smallint,
  verse smallint,
  text text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    -- websearch_to_tsquery rather than to_tsquery: the latter raises a syntax
    -- error on '&', ':', or an unclosed quote — that is, on ordinary typing.
    -- This one never throws, and gives quoted phrases and OR for free.
    select websearch_to_tsquery('spanish'::regconfig, coalesce(p_query, '')) as ts
  )
  select
    v.book_id,
    b.modern_name,
    v.chapter,
    v.verse,
    v.text,
    count(*) over () as total_count
  from public.bible_verses v
  join public.bible_books b on b.id = v.book_id
  cross join q
  -- An empty or all-stopword query ("de la") parses to an empty tsquery, which
  -- would otherwise match nothing noisily. Return no rows, quietly.
  where numnode(q.ts) > 0
    and v.search_vector @@ q.ts
  -- Canonical order, not relevance: a reader expects Génesis before
  -- Apocalipsis, and it makes offset paging stable.
  order by v.book_id, v.chapter, v.verse
  limit least(coalesce(p_limit, 50), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.search_bible(text, integer, integer) from public;
grant execute on function public.search_bible(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Jumping to a reference
--
-- Typing "Juan 3" should offer to go there rather than search for the word
-- "Juan". resolve_scripture cannot do this: it requires chapter:verse and caps
-- ranges at ten verses. Those are deliberate devotional semantics and the
-- anti-hallucination gate for generated plans — widening its contract would let
-- the generator quietly accept a whole chapter as a day's verse. So this is a
-- separate function that reuses only the book-resolution half.
-- ---------------------------------------------------------------------------

create function public.locate_reference(p_ref text)
returns table (book_id smallint, chapter smallint, verse smallint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  parts text[];
  normalised text;
  resolved_book smallint;
  ch smallint;
  v smallint;
  max_chapter smallint;
begin
  -- book [chapter [: verse]]
  parts := regexp_match(
    coalesce(p_ref, ''),
    '^\s*(.+?)(?:\s+(\d+)(?:\s*[:.]\s*(\d+))?)?\s*$'
  );

  if parts is null then
    return;
  end if;

  normalised := public.normalize_book_name(parts[1]);

  select a.book_id into resolved_book
  from public.bible_book_aliases a
  where a.alias = normalised;

  -- Same unique-prefix fallback as resolve_scripture: "1 C" is ambiguous
  -- between Corintios and Crónicas and must fail rather than guess.
  if resolved_book is null then
    select case when count(*) = 1 then min(candidates.book_id) end
      into resolved_book
    from (
      select distinct a.book_id
      from public.bible_book_aliases a
      where char_length(normalised) >= 3
        and a.alias like normalised || '%'
    ) as candidates;
  end if;

  if resolved_book is null then
    return;
  end if;

  ch := coalesce(parts[2]::smallint, 1::smallint);
  v := coalesce(parts[3]::smallint, 1::smallint);

  select b.chapter_count into max_chapter
  from public.bible_books b
  where b.id = resolved_book;

  if ch < 1 or ch > max_chapter then
    return;
  end if;

  -- A verse that does not exist sends the reader nowhere useful, so fail
  -- rather than land them on a chapter with nothing highlighted.
  if not exists (
    select 1 from public.bible_verses bv
    where bv.book_id = resolved_book and bv.chapter = ch and bv.verse = v
  ) then
    return;
  end if;

  book_id := resolved_book;
  chapter := ch;
  verse := v;

  return next;
end;
$$;

revoke execute on function public.locate_reference(text) from public;
grant execute on function public.locate_reference(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The grant service_role never had
--
-- resolve_scripture is SECURITY INVOKER and is granted to service_role, but
-- service_role has no SELECT on the tables it reads. Any service-role caller —
-- a verse-of-the-day cron, a backfill — fails with "permission denied for table
-- bible_book_aliases", naming a table the caller never mentioned. It works
-- today only because generate-prayer-plan forwards the user's JWT.
--
-- Zero risk: this is public-domain reference data, and service_role bypasses
-- RLS anyway, so the grant is the only gate. The canonical home for grants is
-- 20260730100400_grants.sql, which predates these tables.
--
-- anon deliberately gets nothing: reading the Bible requires an account, like
-- the rest of the app, and it avoids an unauthenticated bulk-read surface.
-- ---------------------------------------------------------------------------

grant select on public.bible_books to service_role;
grant select on public.bible_verses to service_role;
grant select on public.bible_book_aliases to service_role;
