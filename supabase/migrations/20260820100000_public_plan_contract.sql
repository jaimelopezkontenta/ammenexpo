-- Ammen — B2: el contrato de los planes públicos.
--
-- **Lo observado antes de tocar nada** (experimento dirigido, evidencia en
-- `docs/evidencias/b2-public-orar-antes.md`): con el esquema vigente, un plan
-- `public` activo y SIN `plan_shares` aparecía en `plans_shared_with_me()` —
-- la pestaña Orar—, era legible, salía en Comunidad y **aceptaba intercesiones
-- por API**. La hipótesis de la auditoría dejó de ser hipótesis.
--
-- **El contrato que fija esta migración** (decisión §2.11 del plan):
--
--   1. `public` es **descubrible y abrible desde Comunidad**. No cambia: la
--      policy de lectura conserva la rama `visibility = 'public'` y
--      `home_feed` lo sigue sirviendo.
--   2. Solo un **share explícito** —directo (`shared_with_user_id`), a un
--      círculo (`plan_shares.group_id`), o el plan propio de un círculo—
--      aparece en Orar y habilita orar. `has_plan_share()` ya cubre las dos
--      primeras; la tercera es la membresía del `group_id` del plan.
--   3. `/orar/[planId]` deja de fiarlo a encontrar el plan en una lista del
--      cliente: pide el día a `get_shared_plan_day()`, que aplica la misma
--      regla en el servidor. Sin share, devuelve cero filas — ese es el
--      «ya no está».
--
-- Lo que NO se toca: ningún share existente, ninguna fila, ninguna policy de
-- lectura. La migración es aditiva salvo por dos recreaciones de función y el
-- estrechamiento del INSERT de `intercessions`, que es exactamente el punto
-- del contrato.

-- ---------------------------------------------------------------------------
-- Acceso de oración: share explícito o círculo. La lectura pública ya no
-- basta para orar.
-- ---------------------------------------------------------------------------

create function public.can_pray_plan(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_plan_share(pid)
     or exists (
          select 1
          from public.prayer_plans p
          where p.id = pid
            and p.group_id is not null
            and public.is_group_member(p.group_id)
        );
$$;

create function public.can_pray_plan_day(did uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.prayer_plan_days d
    where d.id = did
      and d.unlock_date <= public.plan_today(d.plan_id)
      and public.can_pray_plan(d.plan_id)
  );
$$;

revoke execute on function public.can_pray_plan(uuid) from public;
revoke execute on function public.can_pray_plan_day(uuid) from public;
grant execute on function public.can_pray_plan(uuid) to authenticated;
grant execute on function public.can_pray_plan_day(uuid) to authenticated;

-- La consecuencia directa: el INSERT que el experimento aceptó ya no pasa.
drop policy "users pray for days they can actually read" on public.intercessions;

create policy "users pray for days shared with them"
  on public.intercessions for insert
  to authenticated
  with check (
    intercessor_id = (select auth.uid())
    and public.can_pray_plan_day(plan_day_id)
  );

-- ---------------------------------------------------------------------------
-- Orar: solo lo compartido explícitamente
-- ---------------------------------------------------------------------------
--
-- La función era SECURITY INVOKER y heredaba de la policy la rama `public`.
-- El filtro ya no se hereda: se dice. La firma no cambia, así que el cliente
-- no se entera — pero el `drop` obliga a rehacer el grant, como siempre.

drop function if exists public.plans_shared_with_me();

create function public.plans_shared_with_me()
returns table (
  plan_id uuid,
  plan_title text,
  owner_id uuid,
  owner_name text,
  owner_avatar_url text,
  day_id uuid,
  day_number smallint,
  day_title text,
  scripture_ref text,
  scripture_text text,
  intercessor_prayer text,
  already_prayed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from (
    select
      p.id as plan_id,
      p.title as plan_title,
      p.owner_id as owner_id,
      pr.display_name as owner_name,
      pr.avatar_url as owner_avatar_url,
      d.id as day_id,
      d.day_number as day_number,
      d.title as day_title,
      d.scripture_ref as scripture_ref,
      d.scripture_text as scripture_text,
      d.intercessor_prayer as intercessor_prayer,
      exists (
        select 1 from public.intercessions i
        where i.plan_day_id = d.id
          and i.intercessor_id = (select auth.uid())
      ) as already_prayed
    from public.prayer_plans p
    join public.profiles pr on pr.id = p.owner_id
    join lateral (
      select dd.id, dd.day_number, dd.title, dd.scripture_ref,
             dd.scripture_text, dd.intercessor_prayer
      from public.prayer_plan_days dd
      where dd.plan_id = p.id
      order by dd.day_number desc
      limit 1
    ) d on true
    where p.owner_id <> (select auth.uid())
      and p.status = 'active'
      and not public.has_blocked(p.owner_id)
      -- La línea del contrato: share explícito o círculo. Un plan solo
      -- público ya no entra aquí aunque la policy lo haga legible.
      and public.can_pray_plan(p.id)
  ) rows
  order by rows.already_prayed, rows.owner_name;
$$;

revoke execute on function public.plans_shared_with_me() from public;
grant execute on function public.plans_shared_with_me() to authenticated;

-- ---------------------------------------------------------------------------
-- `/orar/[planId]`: la misma regla, aplicada en el servidor para UN plan
-- ---------------------------------------------------------------------------

create function public.get_shared_plan_day(p_plan_id uuid)
returns table (
  plan_id uuid,
  plan_title text,
  owner_id uuid,
  owner_name text,
  owner_avatar_url text,
  day_id uuid,
  day_number smallint,
  day_title text,
  scripture_ref text,
  scripture_text text,
  intercessor_prayer text,
  already_prayed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.title,
    p.owner_id,
    pr.display_name,
    pr.avatar_url,
    d.id,
    d.day_number,
    d.title,
    d.scripture_ref,
    d.scripture_text,
    d.intercessor_prayer,
    exists (
      select 1 from public.intercessions i
      where i.plan_day_id = d.id
        and i.intercessor_id = (select auth.uid())
    )
  from public.prayer_plans p
  join public.profiles pr on pr.id = p.owner_id
  join lateral (
    select dd.id, dd.day_number, dd.title, dd.scripture_ref,
           dd.scripture_text, dd.intercessor_prayer
    from public.prayer_plan_days dd
    where dd.plan_id = p.id
    order by dd.day_number desc
    limit 1
  ) d on true
  where p.id = p_plan_id
    and p.owner_id <> (select auth.uid())
    and p.status = 'active'
    and not public.has_blocked(p.owner_id)
    and public.can_pray_plan(p.id);
$$;

revoke execute on function public.get_shared_plan_day(uuid) from public;
grant execute on function public.get_shared_plan_day(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Comunidad: el plan público se sigue abriendo — para leerlo, no para orarlo
-- ---------------------------------------------------------------------------
--
-- Misma dieta de columnas que el preview de un enlace: nada de `prayer_body`,
-- nada de `interpretation`, nada del id del día (que no hace falta para leer
-- y es el mango con el que se intentaría orar). Los días cerrados no entran:
-- la función es INVOKER y la policy de `prayer_plan_days` decide.

create function public.get_public_plan_day(p_plan_id uuid)
returns table (
  plan_id uuid,
  plan_title text,
  plan_theme text,
  owner_id uuid,
  owner_name text,
  owner_avatar_url text,
  day_number smallint,
  day_title text,
  scripture_ref text,
  scripture_text text,
  intercession_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.title,
    p.theme,
    p.owner_id,
    pr.display_name,
    pr.avatar_url,
    d.day_number,
    d.title,
    d.scripture_ref,
    d.scripture_text,
    d.intercession_count
  from public.prayer_plans p
  join public.profiles pr on pr.id = p.owner_id
  join lateral (
    select dd.day_number, dd.title, dd.scripture_ref,
           dd.scripture_text, dd.intercession_count
    from public.prayer_plan_days dd
    where dd.plan_id = p.id
    order by dd.day_number desc
    limit 1
  ) d on true
  where p.id = p_plan_id
    and p.visibility = 'public'
    and p.status = 'active'
    and not public.has_blocked(p.owner_id);
$$;

revoke execute on function public.get_public_plan_day(uuid) from public;
grant execute on function public.get_public_plan_day(uuid) to authenticated;
