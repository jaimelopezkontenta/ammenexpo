-- Ammen — el cuarto bucle: la oración respondida.
--
-- De los cuatro bucles del producto, tres están construidos y este no. La tabla
-- `testimonies` existe desde la Fase 1 con RLS, policies y GRANT completos, y
-- **cero escritores y cero lectores** en todo el repo. Es el momento más
-- compartible que tiene la app y no había forma de decirlo: oras treinta días
-- por la enfermedad de tu madre y no hay ningún sitio donde poner que pasó.
--
-- **Nace pública, y eso está mal.** `is_public boolean not null default true`
-- significa que alguien acaba de escribir lo más íntimo que tiene y se publica
-- por omisión. Esa es exactamente la clase de sorpresa que no se perdona.
-- Pasa a tener tres estados, con **los círculos por defecto**: la gente que oró
-- contigo es quien tiene sentido que se entere.

create type public.testimony_visibility as enum ('private', 'circles', 'public');

-- El índice cuelga de `is_public`, así que se va con ella.
drop index public.testimonies_public_idx;

alter table public.testimonies
  add column visibility public.testimony_visibility not null default 'circles';

update public.testimonies
   set visibility = (case when is_public then 'public' else 'private' end)
                    ::public.testimony_visibility;

-- Antes de soltar la columna, porque la policy vieja la lee y Postgres se
-- niega mientras exista esa dependencia.
drop policy "public testimonies are readable, private ones only by author"
  on public.testimonies;

alter table public.testimonies drop column is_public;

create index testimonies_visible_idx
  on public.testimonies (created_at desc)
  where visibility <> 'private';

-- ---------------------------------------------------------------------------
-- Quién puede leerlo
-- ---------------------------------------------------------------------------

-- "Los círculos a los que perteneces" es una relación entre dos personas, no
-- una lista de círculos elegidos: si compartimos aunque sea uno, me llega. Un
-- `testimony_shares` a imagen de `plan_shares` daría más precisión a cambio de
-- pedirle a alguien que elija destinatarios en el momento en que menos ganas
-- tiene de rellenar un formulario.
create function public.shares_a_circle_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user
  );
$$;

revoke execute on function public.shares_a_circle_with(uuid) from public;
grant execute on function public.shares_a_circle_with(uuid) to authenticated;

-- La rama del autor va primero y decide con una columna de la propia fila, que
-- es lo que hace que `insert ... returning` funcione. Es la regla que este
-- proyecto ya ha pisado dos veces.
create policy "yours always, your circles' when they chose so"
  on public.testimonies for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      not public.has_blocked(user_id)
      and (
        visibility = 'public'
        or (
          visibility = 'circles'
          and public.shares_a_circle_with(user_id)
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Moderación
-- ---------------------------------------------------------------------------

-- Un testimonio es texto que una persona escribe y otras leen, así que entra en
-- la misma superficie que el resto: reportable, y ausente para quien haya
-- bloqueado a quien lo escribió (eso ya lo hace la policy de arriba).
alter table public.reports drop constraint reports_target_type_check;

alter table public.reports add constraint reports_target_type_check
  check (target_type = any (array[
    'post', 'comment', 'message', 'group', 'profile', 'intercession', 'user',
    'testimony'
  ]));

-- ---------------------------------------------------------------------------
-- Leerlos
-- ---------------------------------------------------------------------------

-- El plan al que pertenece viaja con el testimonio: "esto se respondió mientras
-- oraba por…" es la mitad de lo que hace que valga la pena leerlo.
create function public.visible_testimonies(p_limit integer default 30)
returns table (
  id uuid,
  body text,
  visibility text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_avatar_url text,
  plan_title text,
  is_mine boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id,
    t.body,
    t.visibility::text,
    t.created_at,
    t.user_id,
    pr.display_name,
    pr.avatar_url,
    p.title,
    t.user_id = (select auth.uid())
  from public.testimonies t
  join public.profiles pr on pr.id = t.user_id
  left join public.prayer_plans p on p.id = t.plan_id
  order by t.created_at desc
  limit greatest(least(p_limit, 100), 1);
$$;

revoke execute on function public.visible_testimonies(integer) from public;
grant execute on function public.visible_testimonies(integer) to authenticated;
