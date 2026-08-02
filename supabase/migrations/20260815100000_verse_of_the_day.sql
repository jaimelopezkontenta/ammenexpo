-- Ammen — el versículo del día.
--
-- Sin plan activo, la app no tiene hoy nada que darte: abres y te dice que no
-- tienes plan. Este es el gancho diario más barato que existe en este proyecto,
-- porque los 31.102 versículos de la Reina-Valera 1909 llevan en la base desde
-- la Fase 3 y solo se usaban para **verificar** que una referencia inventada por
-- el modelo existe.
--
-- **Una lista curada, no `random()` sobre la Biblia entera.** Un versículo al
-- azar entre 31.102 sale genealogía, medidas del tabernáculo o una maldición
-- mucho más veces de lo que sale consuelo. Cincuenta referencias elegidas a mano
-- —comprobadas una a una contra la tabla antes de escribirlas aquí— hacen que
-- **cualquier** día sea un día decente.
--
-- Y una tabla y no un array dentro de la función: la lista va a crecer y se va a
-- retocar, y eso no debería pedir una migración que reescriba código.

create table public.daily_verses (
  ord smallint primary key,
  book_id smallint not null references public.bible_books (id),
  chapter smallint not null,
  verse smallint not null,
  unique (book_id, chapter, verse)
);

insert into public.daily_verses (ord, book_id, chapter, verse) values
  (1, 43, 3, 16),    (2, 19, 23, 1),    (3, 50, 4, 6),     (4, 50, 4, 13),
  (5, 23, 41, 10),   (6, 24, 29, 11),   (7, 40, 11, 28),   (8, 45, 8, 28),
  (9, 6, 1, 9),      (10, 20, 3, 5),    (11, 19, 46, 1),   (12, 19, 34, 18),
  (13, 19, 55, 22),  (14, 19, 121, 1),  (15, 19, 91, 1),   (16, 46, 13, 4),
  (17, 48, 5, 22),   (18, 49, 2, 8),    (19, 58, 11, 1),   (20, 59, 1, 2),
  (21, 60, 5, 7),    (22, 62, 4, 19),   (23, 66, 21, 4),   (24, 40, 6, 33),
  (25, 42, 1, 37),   (26, 19, 37, 4),   (27, 23, 40, 31),  (28, 47, 12, 9),
  (29, 5, 31, 6),    (30, 19, 27, 1),   (31, 33, 6, 8),    (32, 36, 3, 17),
  (33, 25, 3, 22),   (34, 19, 103, 2),  (35, 51, 3, 23),   (36, 52, 5, 16),
  (37, 19, 139, 14), (38, 45, 12, 2),   (39, 43, 14, 27),  (40, 43, 16, 33),
  (41, 40, 5, 4),    (42, 19, 30, 5),   (43, 21, 3, 1),    (44, 19, 51, 10),
  (45, 23, 43, 2),   (46, 58, 13, 5),   (47, 19, 62, 1),   (48, 34, 1, 7),
  (49, 35, 3, 19),   (50, 19, 118, 24);

alter table public.daily_verses enable row level security;

-- Datos de referencia, como los libros: los lee cualquiera con cuenta y no los
-- escribe nadie desde la app.
create policy "anybody signed in reads the daily list"
  on public.daily_verses for select
  to authenticated
  using (true);

grant select on public.daily_verses to authenticated;
grant select on public.daily_verses to service_role;

-- ---------------------------------------------------------------------------
-- El de hoy
-- ---------------------------------------------------------------------------
--
-- Determinista por fecha: **el mismo para todo el mundo el mismo día**, que es
-- lo que permite hablar de él —«¿viste el de hoy?»— y lo que hace que no
-- cambie si abres la app dos veces. Con la fecha *local* de cada persona, así
-- que cambia a su medianoche y no a la del servidor, igual que el día del plan.

create function public.verse_of_the_day()
returns table (
  book_id smallint,
  book_name text,
  chapter smallint,
  verse smallint,
  reference text,
  text text
)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (
    select public.local_today((select auth.uid())) as day
  ),
  pick as (
    select d.*
    from public.daily_verses d, today t
    -- `mod` sobre los días desde una fecha fija: recorre la lista entera antes
    -- de repetir, en vez de un `random()` que puede dar el mismo dos días
    -- seguidos.
    where d.ord = 1 + (
      ((select t.day from today t) - date '2026-01-01')
      % (select count(*) from public.daily_verses)
    )
  )
  select
    p.book_id,
    b.modern_name,
    p.chapter,
    p.verse,
    b.modern_name || ' ' || p.chapter || ':' || p.verse,
    v.text
  from pick p
  join public.bible_books b on b.id = p.book_id
  join public.bible_verses v
    on v.book_id = p.book_id and v.chapter = p.chapter and v.verse = p.verse;
$$;

revoke execute on function public.verse_of_the_day() from public;
grant execute on function public.verse_of_the_day() to authenticated;
