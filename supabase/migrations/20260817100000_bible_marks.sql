-- Ammen — la Biblia con rastro.
--
-- El lector está completo desde la Fase 4.10 y es **de solo lectura**: se puede
-- buscar, navegar y continuar donde lo dejaste, y no se puede dejar marca de
-- nada. Subrayar y anotar son la mitad de por qué una app de Biblia se usa a
-- diario en vez de consultarse de vez en cuando.
--
-- Las dos tablas son de dueño único, como la lista de oración: lo que subrayas
-- no lo ve nadie, y lo que escribes al margen menos todavía.

-- Un subrayado por versículo y por persona: la clave primaria compuesta es la
-- que hace que subrayar dos veces sea quitar en vez de duplicar, sin que el
-- cliente tenga que consultar antes de escribir.
create table public.bible_highlights (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id smallint not null references public.bible_books (id),
  chapter smallint not null,
  verse smallint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id, chapter, verse)
);

-- Por capítulo, que es como se lee: la pantalla pide los subrayados de Juan 3,
-- no los de toda la Biblia.
create index bible_highlights_chapter_idx
  on public.bible_highlights (user_id, book_id, chapter);

create table public.bible_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id smallint not null references public.bible_books (id),
  chapter smallint not null,
  verse smallint not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una nota por versículo. Un hilo de notas sobre el mismo versículo es un
  -- producto distinto —y uno que pide pantalla propia para leerse— mientras que
  -- una nota que se edita es lo que la gente hace en el margen de un libro.
  unique (user_id, book_id, chapter, verse)
);

create index bible_notes_chapter_idx
  on public.bible_notes (user_id, book_id, chapter);

create trigger bible_notes_set_updated_at
  before update on public.bible_notes
  for each row execute function public.set_updated_at();

alter table public.bible_highlights enable row level security;
alter table public.bible_notes enable row level security;

-- Deciden con la columna de su propia fila, que es la regla 1: una policy de
-- SELECT que volviera a consultar su propia tabla rompería el
-- `insert ... returning`. Cada tabla nueva se gana su assertion de regresión.
create policy "your highlights are yours"
  on public.bible_highlights for select
  to authenticated using (user_id = (select auth.uid()));

create policy "you highlight for yourself"
  on public.bible_highlights for insert
  to authenticated with check (user_id = (select auth.uid()));

create policy "you remove your own highlights"
  on public.bible_highlights for delete
  to authenticated using (user_id = (select auth.uid()));

create policy "your notes are yours"
  on public.bible_notes for select
  to authenticated using (user_id = (select auth.uid()));

create policy "you write your own notes"
  on public.bible_notes for insert
  to authenticated with check (user_id = (select auth.uid()));

create policy "you edit your own notes"
  on public.bible_notes for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "you delete your own notes"
  on public.bible_notes for delete
  to authenticated using (user_id = (select auth.uid()));

-- Los GRANT son una capa distinta de RLS. Sin update en los subrayados: se
-- ponen y se quitan, no se editan.
grant select, insert, delete on public.bible_highlights to authenticated;
grant select, insert, update, delete on public.bible_notes to authenticated;
grant all on public.bible_highlights to service_role;
grant all on public.bible_notes to service_role;
