-- Ammen — la eñe.
--
-- Al probar el directorio de círculos en el navegador, "oracion manana" no
-- encontró "Círculo de Oración de la Mañana". El acento sí lo resolvía la
-- configuración `spanish`, pero la eñe no: no es una n acentuada, es otra
-- letra, y el lematizador la conserva. `mañana` → 'mañan'; `manana` → 'manan'.
--
-- Mi test lo tapaba porque escribía `mañana` con la eñe puesta, que es
-- justo lo que nadie hace en un teclado de móvil.
--
-- Y lo mismo pasaba en la Biblia, donde importa mucho más: `senor` devolvía
-- CERO de los 1.412 versículos que dicen "Señor". Es la palabra más frecuente
-- del corpus. Se arreglan los dos aquí, porque arreglar solo uno dejaría dos
-- búsquedas que se comportan distinto sin ninguna razón que un lector pueda
-- adivinar.

-- ---------------------------------------------------------------------------
-- El envoltorio
-- ---------------------------------------------------------------------------

-- `unaccent` es STABLE, no IMMUTABLE, porque su diccionario podría cambiarse;
-- una columna generada exige IMMUTABLE. Este envoltorio es el rodeo
-- documentado, y hereda el mismo aviso que yo había evitado en la Fase 4.10 al
-- apoyarme en la configuración `spanish`: **si alguien altera el diccionario
-- `unaccent`, hay que reconstruir los dos índices de abajo**. Se acepta el
-- aviso a cambio de una búsqueda que funciona en español de verdad.
create function public.immutable_unaccent(p_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_text);
$$;

-- ---------------------------------------------------------------------------
-- Los círculos
-- ---------------------------------------------------------------------------

drop index public.groups_search_idx;
alter table public.groups drop column search_vector;

alter table public.groups
  add column search_vector tsvector
  generated always as (
    to_tsvector(
      'spanish'::regconfig,
      public.immutable_unaccent(name || ' ' || coalesce(description, ''))
    )
  ) stored;

create index groups_search_idx on public.groups using gin (search_vector);

-- El GRANT por columna se pierde al recrear la columna.
grant select (search_vector) on public.groups to authenticated;

create or replace function public.search_public_circles(
  p_query text default '',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  description text,
  member_count integer,
  is_member boolean,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_terms text;
  v_query tsquery;
begin
  -- La consulta pasa por el mismo filtro que el índice, o "manana" buscaría
  -- 'manan' contra un vector que guarda 'manan' solo si también se limpió.
  v_terms := btrim(
    regexp_replace(
      public.immutable_unaccent(coalesce(p_query, '')),
      '[^[:alnum:][:space:]]', ' ', 'g'
    )
  );

  if v_terms <> '' then
    v_query := to_tsquery(
      'spanish'::regconfig,
      array_to_string(
        array(
          select w || ':*'
          from unnest(regexp_split_to_array(v_terms, '\s+')) as w
          where w <> ''
        ),
        ' & '
      )
    );

    if numnode(v_query) = 0 then
      v_query := null;
    end if;
  end if;

  return query
  select
    g.id,
    g.name,
    g.description,
    g.member_count,
    exists (
      select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = (select auth.uid())
    ),
    count(*) over ()
  from public.groups g
  where g.visibility = 'public'
    and (v_query is null or g.search_vector @@ v_query)
  order by g.member_count desc, g.name
  limit greatest(least(p_limit, 50), 1)
  offset greatest(p_offset, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- La Biblia
-- ---------------------------------------------------------------------------

drop index public.bible_verses_search_idx;
alter table public.bible_verses drop column search_vector;

alter table public.bible_verses
  add column search_vector tsvector
  generated always as (
    to_tsvector('spanish'::regconfig, public.immutable_unaccent(text))
  ) stored;

create index bible_verses_search_idx
  on public.bible_verses using gin (search_vector);

create or replace function public.search_bible(
  p_query text,
  p_limit integer default 30,
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
  select
    v.book_id,
    b.modern_name,
    v.chapter,
    v.verse,
    v.text,
    count(*) over ()
  from public.bible_verses v
  join public.bible_books b on b.id = v.book_id
  where v.search_vector @@ websearch_to_tsquery(
          'spanish'::regconfig,
          public.immutable_unaccent(coalesce(p_query, ''))
        )
  order by v.book_id, v.chapter, v.verse
  limit greatest(least(p_limit, 100), 1)
  offset greatest(p_offset, 0);
$$;
