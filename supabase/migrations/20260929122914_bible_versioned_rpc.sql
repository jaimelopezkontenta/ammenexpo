-- Ammen — la Biblia en dos idiomas: las funciones que devuelven texto.
--
-- Cada función que lee versículos aprende un último parámetro
-- `p_version text default 'rvr1909'`. Quien no lo pase —el cliente de hoy, el
-- generador de planes, el correo de hábito— recibe exactamente lo mismo que
-- antes.
--
-- **Por qué DROP y no solo CREATE OR REPLACE.** Añadir un parámetro cambia la
-- firma, y Postgres trata una firma distinta como otra función: quedarían dos
-- `search_bible`, y una llamada con los argumentos de siempre dejaría de saber
-- a cuál ir («function is not unique»), también por PostgREST. Así que la
-- firma vieja se suelta y la nueva se crea con los mismos permisos que tenía la
-- vieja (y sin anon, que `rls.sql` cierra a una lista). El cliente llama por
-- nombre con parámetros nombrados, así que no nota el cambio.
--
-- Ninguna función SQL guarda dependencia de estas (no hay cuerpos BEGIN
-- ATOMIC), así que el DROP no arrastra nada: `email_habit_payload` sigue
-- llamando a `verse_of_the_day_for(p_user)` y cae en la nueva con la RVR.
--
-- Va antes de cargar la WEB (`bible_web_data`): ninguna función sin versión
-- llega a ver las dos Biblias en la misma tabla.
--
-- Una versión desconocida no es un error: no hay versículos con ese código,
-- así que todo devuelve vacío, que es lo mismo que una referencia que no
-- existe. Un `null` explícito se trata como «la de siempre».

-- ---------------------------------------------------------------------------
-- resolve_scripture — la puerta contra versículos inventados
--
-- Igual que antes (20260730100800), con el texto y la etiqueta de la versión
-- pedida. El libro se reconoce en los dos idiomas con cualquier versión: un
-- plan en inglés que diga «Juan 3:16» sigue siendo una cita real, y lo que
-- vuelve es «John 3:16» con el texto de la WEB.
-- ---------------------------------------------------------------------------

drop function if exists public.resolve_scripture(text);

create or replace function public.resolve_scripture(
  p_ref text,
  p_version text default 'rvr1909'
)
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
  v_version text := coalesce(p_version, 'rvr1909');
  parts text[];
  resolved_book smallint;
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

  -- Prefijo único, como siempre: «1 C» puede ser Corintios o Crónicas (o
  -- Corinthians, o Chronicles) y tiene que fallar en vez de adivinar.
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

  -- Un capítulo entero no es una lectura devocional; los pasajes, cortos.
  if v_end - v_start > 9 then
    v_end := (v_start + 9)::smallint;
  end if;

  select string_agg(bv.text, ' ' order by bv.verse)
    into body
  from public.bible_verses bv
  where bv.version = v_version
    and bv.book_id = resolved_book
    and bv.chapter = ch
    and bv.verse between v_start and v_end;

  if body is null then
    return;
  end if;

  canonical_ref := public.bible_book_label(resolved_book, v_version)
    || ' ' || ch || ':' || v_start
    || case when v_end > v_start then '-' || v_end else '' end;

  book_id := resolved_book;
  chapter := ch;
  verse_start := v_start;
  verse_end := v_end;
  text := body;

  return next;
end;
$$;

revoke execute on function public.resolve_scripture(text, text) from public, anon;
grant execute on function public.resolve_scripture(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- locate_reference — saltar a una referencia desde el buscador
--
-- La versión importa en un sitio: el versículo tiene que existir en la que se
-- está leyendo. Romanos 14:24 existe en la WEB y no en la RVR; Hechos 8:37, al
-- revés.
-- ---------------------------------------------------------------------------

drop function if exists public.locate_reference(text);

create or replace function public.locate_reference(
  p_ref text,
  p_version text default 'rvr1909'
)
returns table (book_id smallint, chapter smallint, verse smallint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_version text := coalesce(p_version, 'rvr1909');
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

  -- Las dos versiones tienen los mismos capítulos por libro (lo comprueba la
  -- carga de la WEB), así que `chapter_count` vale para las dos.
  select b.chapter_count into max_chapter
  from public.bible_books b
  where b.id = resolved_book;

  if ch < 1 or ch > max_chapter then
    return;
  end if;

  if not exists (
    select 1 from public.bible_verses bv
    where bv.version = v_version
      and bv.book_id = resolved_book
      and bv.chapter = ch
      and bv.verse = v
  ) then
    return;
  end if;

  book_id := resolved_book;
  chapter := ch;
  verse := v;

  return next;
end;
$$;

revoke execute on function public.locate_reference(text, text) from public, anon;
grant execute on function public.locate_reference(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- search_bible — la búsqueda, en el idioma de la versión
--
-- La consulta pasa por la misma `bible_search_config` que el índice: en
-- inglés «loved» lematiza a «love» y encuentra «love», «loves» y «loving»; en
-- español sigue igual que antes (y sin eñe, gracias a unaccent).
--
-- La etiqueta del libro se pone después de paginar: `count(*) over ()` obliga
-- a recorrer todas las coincidencias, y «God» en la WEB son miles; no hace
-- falta el nombre del libro de las que no se van a devolver.
--
-- Vuelve el `numnode(...) > 0` que tenía la primera versión (bible_reader): una
-- consulta vacía o solo de palabras vacías («de la», «the») ya no devolvía
-- nada, pero ahora lo dice la función en vez de depender de cómo trate `@@`
-- una tsquery sin lexemas.
-- ---------------------------------------------------------------------------

drop function if exists public.search_bible(text, integer, integer);

create or replace function public.search_bible(
  p_query text,
  p_limit integer default 30,
  p_offset integer default 0,
  p_version text default 'rvr1909'
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
    select
      coalesce(p_version, 'rvr1909') as version,
      websearch_to_tsquery(
        public.bible_search_config(coalesce(p_version, 'rvr1909')),
        public.immutable_unaccent(coalesce(p_query, ''))
      ) as ts
  ),
  hits as (
    select
      v.book_id,
      v.chapter,
      v.verse,
      v.text,
      count(*) over () as total_count
    from q
    join public.bible_verses v
      on v.version = q.version
     and v.search_vector @@ q.ts
    where numnode(q.ts) > 0
    -- Orden canónico, no relevancia: se espera Génesis antes que Apocalipsis,
    -- y hace estable la paginación por offset.
    order by v.book_id, v.chapter, v.verse
    limit greatest(least(p_limit, 100), 1)
    offset greatest(p_offset, 0)
  )
  select
    h.book_id,
    public.bible_book_label(h.book_id, q.version),
    h.chapter,
    h.verse,
    h.text,
    h.total_count
  from hits h
  cross join q
  order by h.book_id, h.chapter, h.verse;
$$;

revoke execute on function public.search_bible(text, integer, integer, text) from public, anon;
grant execute on function public.search_bible(text, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- El versículo del día
--
-- Determinista por fecha y versión, y **la misma referencia en las dos**: la
-- lista curada se recorre por la fecha local, no por la versión, así que el
-- mismo día a quien lee en español le sale Juan 3:16 y a quien lee en inglés
-- John 3:16. Un círculo con gente de los dos idiomas puede seguir hablando «del
-- de hoy». `bible.sql` comprueba que cada referencia curada existe en todas
-- las versiones: si una faltara en una, ese día esa versión se quedaría sin
-- versículo.
-- ---------------------------------------------------------------------------

drop function if exists public.verse_of_the_day();

create or replace function public.verse_of_the_day(
  p_version text default 'rvr1909'
)
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
    from public.daily_verses d
    where d.ord = 1 + (
      ((select t.day from today t) - date '2026-01-01')
      % (select count(*) from public.daily_verses)
    )
  ),
  labelled as (
    select p.*, public.bible_book_label(p.book_id, coalesce(p_version, 'rvr1909')) as label
    from pick p
  )
  select
    l.book_id,
    l.label,
    l.chapter,
    l.verse,
    l.label || ' ' || l.chapter || ':' || l.verse,
    v.text
  from labelled l
  join public.bible_verses v
    on v.version = coalesce(p_version, 'rvr1909')
   and v.book_id = l.book_id
   and v.chapter = l.chapter
   and v.verse = l.verse;
$$;

revoke execute on function public.verse_of_the_day(text) from public, anon;
grant execute on function public.verse_of_the_day(text) to authenticated;

-- El del correo: el mismo cálculo con la fecha local de otra persona. Solo lo
-- llama el servidor (service_role); el payload del correo de hábito sigue
-- pidiéndolo sin versión, así que sigue saliendo en RVR hasta que el correo
-- aprenda el idioma de cada cual.
drop function if exists public.verse_of_the_day_for(uuid);

create or replace function public.verse_of_the_day_for(
  p_user uuid,
  p_version text default 'rvr1909'
)
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
    select public.local_today(p_user) as day
  ),
  pick as (
    select d.*
    from public.daily_verses d
    where d.ord = 1 + (
      ((select t.day from today t) - date '2026-01-01')
      % (select count(*) from public.daily_verses)
    )
  ),
  labelled as (
    select p.*, public.bible_book_label(p.book_id, coalesce(p_version, 'rvr1909')) as label
    from pick p
  )
  select
    l.book_id,
    l.label,
    l.chapter,
    l.verse,
    l.label || ' ' || l.chapter || ':' || l.verse,
    v.text
  from labelled l
  join public.bible_verses v
    on v.version = coalesce(p_version, 'rvr1909')
   and v.book_id = l.book_id
   and v.chapter = l.chapter
   and v.verse = l.verse;
$$;

revoke execute on function public.verse_of_the_day_for(uuid, text)
  from public, anon, authenticated;
grant execute on function public.verse_of_the_day_for(uuid, text) to service_role;
