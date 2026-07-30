-- Ammen — scripture reference data (Reina-Valera 1909, public domain).
--
-- A generated prayer plan must never carry an invented Bible verse. During
-- testing a local model produced a confident, well-formatted quote attributed
-- to Filipenses 4:6-7 whose text does not exist anywhere in that passage. That
-- failure is not detectable by skimming the output, and in a prayer app it is
-- a serious breach of trust.
--
-- So the model is never asked for scripture text. It picks a REFERENCE, and
-- the text is looked up here. A reference that does not resolve is rejected.
--
-- Using a public-domain translation also settles the licensing question: NVI,
-- NTV and RVR1960 are all under copyright.

create table public.bible_books (
  id smallint primary key,
  name text not null,
  modern_name text not null,
  new_testament boolean not null
);

create table public.bible_verses (
  book_id smallint not null references public.bible_books (id),
  chapter smallint not null,
  verse smallint not null,
  text text not null,
  primary key (book_id, chapter, verse)
);

-- Public-domain reference data: readable by any signed-in user. RLS is still
-- enabled so the "every table is protected" invariant holds across the schema.
alter table public.bible_books enable row level security;
alter table public.bible_verses enable row level security;

create policy "scripture is readable by signed-in users"
  on public.bible_books for select
  to authenticated
  using (true);

create policy "scripture verses are readable by signed-in users"
  on public.bible_verses for select
  to authenticated
  using (true);

grant select on public.bible_books to authenticated;
grant select on public.bible_verses to authenticated;
