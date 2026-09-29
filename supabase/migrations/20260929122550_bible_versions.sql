-- Ammen — la Biblia en dos idiomas: el esquema.
--
-- La app va a tener contenido en inglés, y un plan en inglés no puede citar la
-- Reina-Valera. Hace falta una segunda traducción de dominio público: la World
-- English Bible (WEB). Aquí solo se prepara el sitio para ella sin que cambie
-- nada de lo que ya funciona: **todo lo que no diga versión sigue siendo
-- `rvr1909`**, que es lo que el cliente, el generador de planes y el correo
-- piden hoy sin saber que hay otra.
--
-- Van tres migraciones, en este orden a propósito: el esquema (esta), las
-- funciones que devuelven texto aprendiendo la versión (`bible_versioned_rpc`)
-- y, solo entonces, el texto de la WEB (`bible_web_data`). Cada migración es su
-- propia transacción; si la carga fuera antes y un `db push` se cortara entre
-- medias, `resolve_scripture` sin versión devolvería Juan 3:16 en los dos
-- idiomas pegados.

-- ---------------------------------------------------------------------------
-- 1. El catálogo de versiones
--
-- Una tabla y no un enum: lleva nombre, idioma, fuente y licencia, que son lo
-- que hay que enseñar en un pie de «texto de…», y añadir una tercera versión
-- debería ser un INSERT, no un ALTER TYPE.
--
-- `is_default` es el valor por defecto **de su idioma**: el cliente elige la
-- versión por el idioma de la interfaz. El valor por defecto global —el que
-- toman las llamadas que no dicen nada— es `rvr1909`, fijado en el DEFAULT de
-- la columna y de cada parámetro `p_version`, no aquí.
-- ---------------------------------------------------------------------------

create table if not exists public.bible_versions (
  code text primary key check (code ~ '^[a-z0-9]+$'),
  name text not null,
  language text not null check (language in ('es', 'en')),
  source text not null,
  license text not null,
  is_default boolean not null default false
);

create unique index if not exists bible_versions_one_default_per_language
  on public.bible_versions (language)
  where is_default;

-- La WEB es dominio público, pero «World English Bible» es marca de eBible.org:
-- si se altera el texto, el resultado ya no puede llamarse así. Por eso se
-- carga tal cual —ni una comilla cambiada— y la licencia queda escrita aquí.
insert into public.bible_versions (code, name, language, source, license, is_default)
values
  (
    'rvr1909',
    'Reina-Valera 1909',
    'es',
    'https://github.com/iglesianazaret/biblia-reina-valera-1909-base-datos-sql',
    'Dominio público.',
    true
  ),
  (
    'web',
    'World English Bible',
    'en',
    'https://eBible.org/web/ (engwebp_vpl, 2020 stable text edition)',
    'Public domain. "World English Bible" is a trademark of eBible.org: the text must not be altered under that name.',
    true
  )
on conflict (code) do nothing;

alter table public.bible_versions enable row level security;

-- Datos de referencia, como los libros: los lee cualquiera con cuenta.
drop policy if exists "bible versions are readable by signed-in users"
  on public.bible_versions;
create policy "bible versions are readable by signed-in users"
  on public.bible_versions for select
  to authenticated
  using (true);

grant select on public.bible_versions to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. La versión en cada versículo
--
-- El DEFAULT hace que las 31.102 filas de la RVR1909 queden etiquetadas sin
-- reescribir la tabla, y que cualquier INSERT viejo siga cayendo en la RVR.
--
-- La clave primaria empieza por la versión porque así se lee siempre: «Juan 3
-- en esta versión», y el índice devuelve el capítulo ya ordenado. La clave
-- foránea a `bible_books` pierde con eso el índice que la cubría (la PK empezaba
-- por `book_id`), así que lleva el suyo: `rls.sql` exige que ninguna quede sin.
--
-- Las notas y los subrayados NO llevan versión, a propósito: están indexados
-- por (libro, capítulo, versículo), así que lo que subrayas en Juan 3:16 sigue
-- subrayado en John 3:16. Dónde no coinciden las dos numeraciones lo cuenta
-- `supabase/tests/bible.sql`.
-- ---------------------------------------------------------------------------

alter table public.bible_verses
  add column if not exists version text not null default 'rvr1909'
    references public.bible_versions (code);

alter table public.bible_verses
  drop constraint if exists bible_verses_pkey,
  add constraint bible_verses_pkey primary key (version, book_id, chapter, verse);

create index if not exists bible_verses_book_id_fk_idx
  on public.bible_verses (book_id);

-- ---------------------------------------------------------------------------
-- 3. La búsqueda, en el idioma de cada versión
--
-- El vector se calculaba con la configuración `spanish`, que con el inglés
-- lematiza mal («loved» no llegaría a «love»). La columna generada solo puede
-- usar funciones IMMUTABLE y no puede leer otra tabla, así que el idioma de
-- cada versión se decide aquí, en una función que usan a la vez el índice y
-- la consulta (`search_bible`): si cada lado tuviera su CASE, bastaría con
-- tocar uno para que la búsqueda dejara de encontrar sin dar ningún error.
--
-- El mismo aviso que `immutable_unaccent`: **si cambia este mapeo, hay que
-- volver a ejecutar el SET EXPRESSION de abajo**, porque los vectores ya
-- guardados no se recalculan solos. Una versión que no esté aquí cae en
-- `spanish`; `bible.sql` comprueba que cada fila de `bible_versions` tiene la
-- configuración de su idioma.
-- ---------------------------------------------------------------------------

create or replace function public.bible_search_config(p_version text)
returns regconfig
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_version
    when 'web' then 'english'::regconfig
    else 'spanish'::regconfig
  end;
$$;

revoke execute on function public.bible_search_config(text) from public, anon;
grant execute on function public.bible_search_config(text) to authenticated, service_role;

-- Postgres 17 cambia la expresión en su sitio: reescribe la tabla y reconstruye
-- el índice GIN, sin el baile de soltar la columna, volver a crearla y
-- recuperar sus GRANT que hizo `unaccent_search`. Para las filas de la RVR el
-- resultado es idéntico al de antes (`spanish` + unaccent).
alter table public.bible_verses
  alter column search_vector set expression as (
    to_tsvector(public.bible_search_config(version), public.immutable_unaccent(text))
  );

-- ---------------------------------------------------------------------------
-- 4. Los libros, con su nombre en inglés
--
-- `modern_name` es lo que se enseña en español; `name_en` lo que se enseña con
-- la WEB. Son los nombres de la propia WEB («Song of Solomon», no «Song of
-- Songs»), para que la referencia y el texto hablen igual.
-- ---------------------------------------------------------------------------

alter table public.bible_books add column if not exists name_en text;

update public.bible_books b
   set name_en = n.name_en
  from (values
    (1, 'Genesis'), (2, 'Exodus'), (3, 'Leviticus'), (4, 'Numbers'),
    (5, 'Deuteronomy'), (6, 'Joshua'), (7, 'Judges'), (8, 'Ruth'),
    (9, '1 Samuel'), (10, '2 Samuel'), (11, '1 Kings'), (12, '2 Kings'),
    (13, '1 Chronicles'), (14, '2 Chronicles'), (15, 'Ezra'), (16, 'Nehemiah'),
    (17, 'Esther'), (18, 'Job'), (19, 'Psalms'), (20, 'Proverbs'),
    (21, 'Ecclesiastes'), (22, 'Song of Solomon'), (23, 'Isaiah'),
    (24, 'Jeremiah'), (25, 'Lamentations'), (26, 'Ezekiel'), (27, 'Daniel'),
    (28, 'Hosea'), (29, 'Joel'), (30, 'Amos'), (31, 'Obadiah'), (32, 'Jonah'),
    (33, 'Micah'), (34, 'Nahum'), (35, 'Habakkuk'), (36, 'Zephaniah'),
    (37, 'Haggai'), (38, 'Zechariah'), (39, 'Malachi'),
    (40, 'Matthew'), (41, 'Mark'), (42, 'Luke'), (43, 'John'), (44, 'Acts'),
    (45, 'Romans'), (46, '1 Corinthians'), (47, '2 Corinthians'),
    (48, 'Galatians'), (49, 'Ephesians'), (50, 'Philippians'),
    (51, 'Colossians'), (52, '1 Thessalonians'), (53, '2 Thessalonians'),
    (54, '1 Timothy'), (55, '2 Timothy'), (56, 'Titus'), (57, 'Philemon'),
    (58, 'Hebrews'), (59, 'James'), (60, '1 Peter'), (61, '2 Peter'),
    (62, '1 John'), (63, '2 John'), (64, '3 John'), (65, 'Jude'),
    (66, 'Revelation')
  ) as n (id, name_en)
 where b.id = n.id
   and b.name_en is distinct from n.name_en;

alter table public.bible_books alter column name_en set not null;

-- El nombre del libro tal como se enseña en una versión: `name_en` con la WEB,
-- `modern_name` con todo lo demás. Una sola función para que la referencia del
-- resolver, la de la búsqueda y la del versículo del día no puedan discrepar.
create or replace function public.bible_book_label(
  p_book_id smallint,
  p_version text default 'rvr1909'
)
returns text
language sql
stable
set search_path = ''
as $$
  select case ver.language when 'en' then b.name_en else b.modern_name end
  from public.bible_books b
  left join public.bible_versions ver
    on ver.code = coalesce(p_version, 'rvr1909')
  where b.id = p_book_id;
$$;

revoke execute on function public.bible_book_label(smallint, text) from public, anon;
grant execute on function public.bible_book_label(smallint, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Los alias ingleses
--
-- Un solo espacio de nombres para los dos idiomas: `alias` es la clave
-- primaria, así que ningún alias puede apuntar a dos libros, y el resolver
-- entiende «John 3:16» también cuando se le pide la RVR (y devuelve «Juan
-- 3:16»). Donde los dos idiomas escriben igual («Job», «Daniel», «Rom»,
-- «Jn»…) el alias ya existe y apunta al mismo libro.
--
-- El riesgo real no es la colisión exacta sino el prefijo: el resolver acepta
-- una abreviatura inventada si solo encaja con un libro, y un alias inglés
-- nuevo podría volver ambiguo —o peor, redirigir— un prefijo español que hoy
-- funciona. Así que la migración se vigila a sí misma: resuelve todos los
-- prefijos de los alias existentes antes y después, y aborta si alguno que
-- resolvía cambia de libro o deja de resolver.
-- ---------------------------------------------------------------------------

create temporary table bible_alias_en_staging (
  alias text primary key,
  book_id smallint not null
);

insert into bible_alias_en_staging (alias, book_id)
select public.normalize_book_name(b.name_en), b.id
from public.bible_books b
on conflict (alias) do nothing;

-- Formas que un modelo o una persona escriben en inglés y que no son el
-- nombre de la tabla: abreviaturas de uso común (SBL y las de siempre),
-- ordinales en letra como los «primera de» españoles, y variantes.
insert into bible_alias_en_staging (alias, book_id) values
  ('gen', 1), ('exod', 2), ('lev', 3), ('num', 4), ('deut', 5),
  ('josh', 6), ('judg', 7), ('jdg', 7),
  ('1 sam', 9), ('2 sam', 10), ('1 sa', 9), ('2 sa', 10),
  ('first samuel', 9), ('second samuel', 10),
  ('1 kgs', 11), ('2 kgs', 12), ('1 ki', 11), ('2 ki', 12),
  ('first kings', 11), ('second kings', 12),
  ('1 chr', 13), ('2 chr', 14), ('1 chron', 13), ('2 chron', 14),
  ('first chronicles', 13), ('second chronicles', 14),
  ('neh', 16), ('esth', 17),
  ('ps', 19), ('psa', 19), ('pss', 19), ('psalm', 19),
  ('prov', 20), ('eccl', 21), ('eccles', 21), ('qoheleth', 21),
  ('song', 22), ('song of songs', 22), ('the song of solomon', 22), ('canticles', 22),
  ('isa', 23), ('ezek', 26), ('dan', 27), ('hos', 28), ('obad', 31),
  ('mic', 33), ('nah', 34), ('hab', 35), ('zeph', 36), ('hag', 37),
  ('zech', 38), ('mal', 39),
  ('matt', 40), ('mk', 41), ('lk', 42),
  ('acts of the apostles', 44), ('the acts', 44),
  ('1 cor', 46), ('2 cor', 47), ('first corinthians', 46), ('second corinthians', 47),
  ('eph', 49), ('phil', 50), ('php', 50),
  ('1 thess', 52), ('2 thess', 53), ('1 th', 52), ('2 th', 53),
  ('first thessalonians', 52), ('second thessalonians', 53),
  ('1 tim', 54), ('2 tim', 55), ('first timothy', 54), ('second timothy', 55),
  ('philem', 57), ('phlm', 57), ('phm', 57),
  ('jas', 59), ('1 pet', 60), ('2 pet', 61), ('1 pe', 60), ('2 pe', 61),
  ('first peter', 60), ('second peter', 61),
  ('2 jn', 63), ('3 jn', 64), ('first john', 62), ('second john', 63), ('third john', 64),
  ('rev', 66), ('revelations', 66), ('the revelation', 66), ('revelation of john', 66)
on conflict (alias) do nothing;

-- Una colisión exacta se descartaría en silencio con `on conflict do nothing`;
-- mejor que falle aquí, diciendo cuál.
do $$
declare
  v_clash text;
begin
  select string_agg(s.alias || ' → ' || s.book_id || ' (ya es ' || a.book_id || ')', ', ')
    into v_clash
  from bible_alias_en_staging s
  join public.bible_book_aliases a on a.alias = s.alias
  where a.book_id <> s.book_id;

  if v_clash is not null then
    raise exception 'alias ingleses que ya apuntan a otro libro: %', v_clash;
  end if;
end;
$$;

-- Lo mismo que hace el resolver con un nombre: alias exacto, y si no, un
-- prefijo de al menos tres letras que encaje con un único libro.
create temporary table bible_alias_prefixes_before as
with probes as (
  select distinct public.normalize_book_name(left(a.alias, n)) as probe
  from public.bible_book_aliases a
  cross join lateral generate_series(3, char_length(a.alias)) as n
)
select
  p.probe,
  coalesce(
    (select a.book_id from public.bible_book_aliases a where a.alias = p.probe),
    (select case when count(distinct a.book_id) = 1 then min(a.book_id) end
       from public.bible_book_aliases a
      where a.alias like p.probe || '%')
  ) as book_id
from probes p
where char_length(p.probe) >= 3;

insert into public.bible_book_aliases (alias, book_id)
select s.alias, s.book_id
from bible_alias_en_staging s
on conflict (alias) do nothing;

do $$
declare
  v_changed text;
begin
  select string_agg(format('%s: %s → %s', b.probe, b.book_id, now_.book_id), ', ')
    into v_changed
  from bible_alias_prefixes_before b
  cross join lateral (
    select coalesce(
      (select a.book_id from public.bible_book_aliases a where a.alias = b.probe),
      (select case when count(distinct a.book_id) = 1 then min(a.book_id) end
         from public.bible_book_aliases a
        where a.alias like b.probe || '%')
    ) as book_id
  ) as now_
  where b.book_id is not null
    and now_.book_id is distinct from b.book_id;

  if v_changed is not null then
    raise exception 'los alias ingleses cambian cómo se resuelven nombres que ya funcionaban: %', v_changed;
  end if;
end;
$$;

drop table bible_alias_prefixes_before;
drop table bible_alias_en_staging;
