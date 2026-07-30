-- Ammen — resolving a scripture reference to real text.
--
-- Runs after the RVR1909 data is loaded. This is the gate that stops a
-- hallucinated verse from ever reaching a user: anything the resolver cannot
-- find in the loaded text is rejected by the caller.

create extension if not exists unaccent with schema extensions;

-- "1ª Cor." / "1 Corintios" / "1 corintios" all collapse to "1 cor" / "1 corintios".
create function public.normalize_book_name(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      lower(extensions.unaccent(coalesce(p_name, ''))),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

create table public.bible_book_aliases (
  alias text primary key,
  book_id smallint not null references public.bible_books (id)
);

alter table public.bible_book_aliases enable row level security;

create policy "book aliases are readable by signed-in users"
  on public.bible_book_aliases for select
  to authenticated
  using (true);

grant select on public.bible_book_aliases to authenticated;

-- Both the 1909 spelling and the modern one ("Revelación" / "Apocalipsis",
-- "Ecclesiastés" / "Eclesiastés", "Ruth" / "Rut").
insert into public.bible_book_aliases (alias, book_id)
select public.normalize_book_name(b.name), b.id
from public.bible_books b
on conflict (alias) do nothing;

insert into public.bible_book_aliases (alias, book_id)
select public.normalize_book_name(b.modern_name), b.id
from public.bible_books b
on conflict (alias) do nothing;

-- Forms a model is likely to emit that are not in either column.
insert into public.bible_book_aliases (alias, book_id) values
  ('salmo', 19),
  ('salmos', 19),
  ('cantares', 22),
  ('cantar de los cantares', 22),
  ('el cantar de los cantares', 22),
  ('eclesiastes', 21),
  ('predicador', 21),
  ('hechos de los apostoles', 44),
  ('los hechos de los apostoles', 44),
  ('apocalipsis de juan', 66),
  ('primera de samuel', 9),
  ('segunda de samuel', 10),
  ('primera de reyes', 11),
  ('segunda de reyes', 12),
  ('primera de corintios', 46),
  ('segunda de corintios', 47),
  ('primera de tesalonicenses', 52),
  ('segunda de tesalonicenses', 53),
  ('primera de timoteo', 54),
  ('segunda de timoteo', 55),
  ('primera de pedro', 60),
  ('segunda de pedro', 61),
  ('primera de juan', 62),
  ('segunda de juan', 63),
  ('tercera de juan', 64),
  ('gn', 1), ('ex', 2), ('lv', 3), ('nm', 4), ('dt', 5),
  ('sal', 19), ('pr', 20), ('ec', 21), ('is', 23), ('jer', 24),
  ('mt', 40), ('mr', 41), ('mc', 41), ('lc', 42), ('jn', 43),
  ('hch', 44), ('ro', 45), ('rom', 45),
  ('1 co', 46), ('2 co', 47), ('ga', 48), ('gal', 48),
  ('ef', 49), ('fil', 50), ('flp', 50), ('col', 51),
  ('1 ts', 52), ('2 ts', 53), ('1 ti', 54), ('2 ti', 55),
  ('tit', 56), ('flm', 57), ('he', 58), ('heb', 58),
  ('stg', 59), ('sant', 59), ('1 p', 60), ('2 p', 61),
  ('1 jn', 62), ('2 jn', 63), ('3 jn', 64), ('jud', 65), ('ap', 66)
on conflict (alias) do nothing;

-- ---------------------------------------------------------------------------
-- resolve_scripture
--
-- Accepts "Filipenses 4:6-7", "Salmo 23:1", "1 Co 13:4-7", "Prov. 3:5".
-- Returns no rows when the reference cannot be resolved — the caller treats
-- that as "the model made this up" and rejects the day.
-- ---------------------------------------------------------------------------

create function public.resolve_scripture(p_ref text)
returns table (
  canonical_ref text,
  book_id smallint,
  chapter smallint,
  verse_start smallint,
  verse_end smallint,
  text text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  parts text[];
  resolved_book smallint;
  book_label text;
  ch smallint;
  v_start smallint;
  v_end smallint;
  body text;
begin
  -- book / chapter : verse [- verse]
  parts := regexp_match(
    coalesce(p_ref, ''),
    '^\s*(.+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*$'
  );

  if parts is null then
    return;
  end if;

  select a.book_id into resolved_book
  from public.bible_book_aliases a
  where a.alias = public.normalize_book_name(parts[1]);

  -- Enumerating every abbreviation a model might invent ("Prov.", "Filip.",
  -- "Apoc.") is a losing game, so fall back to a prefix match. It must resolve
  -- to exactly one book: "1 C" is ambiguous between Corintios and Crónicas and
  -- has to fail rather than guess.
  if resolved_book is null then
    select case when count(*) = 1 then min(candidates.book_id) end
      into resolved_book
    from (
      select distinct a.book_id
      from public.bible_book_aliases a
      where char_length(public.normalize_book_name(parts[1])) >= 3
        and a.alias like public.normalize_book_name(parts[1]) || '%'
    ) as candidates;
  end if;

  if resolved_book is null then
    return;
  end if;

  ch := parts[2]::smallint;
  v_start := parts[3]::smallint;
  v_end := coalesce(parts[4]::smallint, v_start);

  if v_end < v_start then
    return;
  end if;

  -- A whole chapter is not a devotional reading; keep passages short.
  if v_end - v_start > 9 then
    v_end := (v_start + 9)::smallint;
  end if;

  select string_agg(bv.text, ' ' order by bv.verse)
    into body
  from public.bible_verses bv
  where bv.book_id = resolved_book
    and bv.chapter = ch
    and bv.verse between v_start and v_end;

  if body is null then
    return;
  end if;

  select b.modern_name into book_label
  from public.bible_books b
  where b.id = resolved_book;

  canonical_ref := book_label || ' ' || ch || ':' || v_start
    || case when v_end > v_start then '-' || v_end else '' end;

  book_id := resolved_book;
  chapter := ch;
  verse_start := v_start;
  verse_end := v_end;
  text := body;

  return next;
end;
$$;

revoke execute on function public.resolve_scripture(text) from public;
grant execute on function public.resolve_scripture(text) to authenticated, service_role;
