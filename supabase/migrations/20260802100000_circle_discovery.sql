-- Ammen — Bloque D, primera parte: encontrar un círculo público.
--
-- `circulos.tsx` ha dicho desde el principio que un círculo público "aparecerá
-- en las búsquedas", y no había búsqueda. Se construye en vez de borrar el
-- texto, con una consecuencia que hay que asumir de frente: a partir de aquí
-- entran desconocidos a un sitio donde la gente cuenta por qué necesita
-- oración. Por eso la moderación va en este mismo bloque y no después.

-- ---------------------------------------------------------------------------
-- El índice
-- ---------------------------------------------------------------------------

-- Misma decisión que en la Biblia y por la misma razón: la configuración
-- `spanish` ya quita los acentos al lematizar, así que "circulo de oracion"
-- encuentra "Círculo de Oración" sin diccionario `unaccent` ni configuración
-- propia. La forma de dos argumentos es IMMUTABLE, que es lo que permite la
-- columna generada.
alter table public.groups
  add column search_vector tsvector
  generated always as (
    to_tsvector(
      'spanish'::regconfig,
      name || ' ' || coalesce(description, '')
    )
  ) stored;

create index groups_search_idx on public.groups using gin (search_vector);

-- ---------------------------------------------------------------------------
-- El token de invitación deja de viajar con la fila
-- ---------------------------------------------------------------------------

-- La policy de SELECT de `groups` deja leer *cualquier* círculo público, y el
-- GRANT era de tabla entera: hasta ahora un desconocido podía pedir el
-- `invite_token` de todos ellos. Con una pantalla que lista círculos públicos a
-- gente que no es miembro, eso pasa de ser teórico a ser el resultado normal de
-- la consulta.
revoke select on public.groups from authenticated;

-- `search_vector` va en la lista aunque nadie lo lea desde el cliente: la
-- función de búsqueda es SECURITY INVOKER, así que el permiso que necesita para
-- filtrar por él es el de quien llama. Sin esto el error es "permission denied
-- for table groups", que señala a la tabla y no a la columna que falta.
grant select (
  id, owner_id, name, description, avatar_url, visibility, member_count,
  streak_count, streak_last_day, search_vector, created_at, updated_at
) on public.groups to authenticated;

-- Invitar sigue siendo cosa de cualquier miembro, como hasta ahora: lo que
-- cambia es que hay que ser miembro para obtener el token, no solo para verlo.
create function public.circle_invite_token(p_group_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select g.invite_token
  from public.groups g
  where g.id = p_group_id
    and public.is_group_member(g.id);
$$;

revoke execute on function public.circle_invite_token(uuid) from public;
grant execute on function public.circle_invite_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- La búsqueda
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER a propósito: la policy de `groups` ya decide qué es
-- visible, y `is_member` se resuelve contra la de `group_members`, que solo
-- deja ver el censo de tus propios círculos. Una función definer aquí tendría
-- que reimplementar ambas reglas y podría discrepar de ellas.
create function public.search_public_circles(
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
  -- Nada de `to_tsquery` sobre lo que la gente escribe de verdad: revienta con
  -- un `&`, con dos puntos o con una comilla sin cerrar. Se limpia a mano
  -- porque hace falta el prefijo `:*` — sin él, escribir "orac" no encontraría
  -- "Oración", que es justo lo que hace una caja de búsqueda mientras tecleas,
  -- y `websearch_to_tsquery` no sabe emitirlo.
  v_terms := btrim(
    regexp_replace(coalesce(p_query, ''), '[^[:alnum:][:space:]]', ' ', 'g')
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

    -- "de la" son todo palabras vacías: el lematizador las descarta y queda una
    -- tsquery sin nodos, que no casa con nada. Buscar y recibir cero círculos
    -- se lee como "no hay ninguno", así que se trata como no haber buscado.
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
  -- Los más concurridos primero: en un directorio vacío de reseñas, cuánta
  -- gente hay dentro es la única señal honesta que tiene quien elige.
  order by g.member_count desc, g.name
  limit greatest(least(p_limit, 50), 1)
  offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.search_public_circles(text, integer, integer)
  from public;
grant execute on function public.search_public_circles(text, integer, integer)
  to authenticated;
