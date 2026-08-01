-- Ammen — seguir a alguien.
--
-- Sustituye a un modelo de amigos que llevaba aquí desde la Fase 1 sin que
-- nadie lo viera: `friendships`, con su enum, sus cuatro policies y su
-- `are_friends()`, escrita en silencio cada vez que alguien canjeaba un enlace,
-- y sin una sola pantalla. Aquello pedía aceptar y rechazar; esto no pide nada.
--
-- **Seguir es de una dirección y no se aprueba.** Sigues a alguien y lo suyo
-- público te llega; a esa persona no se le pregunta. Es la misma forma que ya
-- tiene bloquear en esta app —una sola dirección, sin negociación— y las dos se
-- deshacen con un toque.

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

-- La clave primaria ya sirve para "a quién sigo"; esto es para el otro lado,
-- "quién me sigue", que es lo que mira el contador y el perfil.
create index follows_followee_idx on public.follows (followee_id);

-- ---------------------------------------------------------------------------
-- Los números
-- ---------------------------------------------------------------------------
--
-- **Los contadores no se cuentan sobre la tabla.** Si el número saliera de un
-- `count(*)` sobre `follows`, para enseñarlo habría que dejar leer el grafo
-- entero, y quién sigue a quién es de las dos partes y de nadie más. Con las
-- columnas, el número es público y la lista no.
--
-- Misma forma que `sync_group_member_count()`, que lleva haciendo esto con los
-- círculos desde la Fase 1.

alter table public.profiles
  add column follower_count integer not null default 0,
  add column following_count integer not null default 0;

create function public.sync_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
       set follower_count = follower_count + 1
     where id = new.followee_id;

    update public.profiles
       set following_count = following_count + 1
     where id = new.follower_id;

    return new;
  else
    update public.profiles
       set follower_count = greatest(follower_count - 1, 0)
     where id = old.followee_id;

    update public.profiles
       set following_count = greatest(following_count - 1, 0)
     where id = old.follower_id;

    return old;
  end if;
end;
$$;

create trigger follows_count
  after insert or delete on public.follows
  for each row execute function public.sync_follow_counts();

-- ---------------------------------------------------------------------------
-- Bloquear deshace el seguimiento
-- ---------------------------------------------------------------------------
--
-- En los dos sentidos, y por eso no basta con que la policy impida seguir: si
-- solo mirara hacia adelante, bloquearías a alguien y seguiría contando como
-- seguidor tuyo, con su cara en tu lista y su número en tu perfil. El bloqueo
-- de esta app se prometió como "deja de llegarte lo suyo"; esto es parte de
-- cumplirlo.

create function public.clear_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id);

  return new;
end;
$$;

create trigger blocks_clear_follows
  after insert on public.blocks
  for each row execute function public.clear_follows_on_block();

-- ---------------------------------------------------------------------------
-- Quién puede seguir a quién
-- ---------------------------------------------------------------------------

-- `has_blocked()` solo mira una dirección —si yo bloqueé a alguien—, y aquí
-- hacen falta las dos: quien te bloqueó no debería recibir un seguidor nuevo
-- tuyo. SECURITY DEFINER porque una policy no puede leer `blocks` de la otra
-- persona: las subconsultas de una policy pasan por la RLS de la tabla que
-- consultan, y la de `blocks` solo deja ver las tuyas.
create function public.blocked_either_way(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_user_id)
       or (b.blocker_id = p_user_id and b.blocked_id = (select auth.uid()))
  );
$$;

revoke execute on function public.blocked_either_way(uuid) from public;
grant execute on function public.blocked_either_way(uuid) to authenticated;

alter table public.follows enable row level security;

-- Decide con las columnas de su propia fila, que es la regla 1: una policy de
-- SELECT que volviera a consultar `follows` rompería el `insert ... returning`.
--
-- Las dos partes lo ven: quien sigue, para poder dejar de seguir; y quien es
-- seguida, para saber quién la lee y poder quitárselo de encima. Nadie más ve
-- el grafo — para eso están los contadores.
create policy "both sides see the follow"
  on public.follows for select to authenticated
  using (
    follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
  );

create policy "you follow on your own behalf"
  on public.follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not public.blocked_either_way(followee_id)
  );

-- Dos salidas: dejar de seguir, y **quitarte un seguidor** sin llegar a
-- bloquearlo. Sin la segunda, la única forma de sacarte a alguien de encima
-- sería el bloqueo, que es un martillo para algo que muchas veces solo pide un
-- "prefiero que no".
create policy "either side ends the follow"
  on public.follows for delete to authenticated
  using (
    follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
  );

-- Los GRANT son una capa distinta de RLS: sin esto el error sería "permission
-- denied for table follows", que no se parece en nada a un fallo de policy.
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;

-- ---------------------------------------------------------------------------
-- El perfil, ahora con números
-- ---------------------------------------------------------------------------
--
-- `public_profile` cambia de tipo de retorno, y `create or replace` no puede
-- hacer eso: hay que soltarla, recrearla **y volver a emitir el grant**, porque
-- la firma forma parte del nombre. Es la cuarta vez en este proyecto.
--
-- **La racha sale.** La dejé fuera a propósito hace dos commits —es indulgente
-- para que no apriete, y publicarla convierte una disciplina privada en un
-- marcador— y es una decisión de producto que se ha tomado en el otro sentido.
-- Queda dicho aquí para que dentro de seis meses se sepa que fue deliberado.
--
-- Se decide **en el servidor y con el día de esa persona**, no en el cliente: el
-- número guardado solo es cierto hasta el último día que oró —ningún trigger
-- puede dispararse por un día en que nadie apareció—, y `liveStreak` compara
-- contra la fecha del dispositivo, que es la de quien mira, no la de quien oró.
-- Para tu propia racha da igual; para la de alguien al otro lado del mundo, no.

drop function public.public_profile(uuid);

create function public.public_profile(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  member_since date,
  shares_circle boolean,
  is_me boolean,
  i_follow boolean,
  follower_count integer,
  following_count integer,
  streak integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.created_at::date,
    public.shares_a_circle_with(p.id),
    p.id = (select auth.uid()),
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid())
        and f.followee_id = p.id
    ),
    p.follower_count,
    p.following_count,
    -- La misma regla de gracia que `bump_personal_streak`: un día perdido se
    -- perdona, dos seguidos reinician.
    case
      when p.streak_last_day is null then 0
      when p.streak_last_day >= public.local_today(p.id) - 2 then p.streak_count
      else 0
    end
  from public.profiles p
  where p.id = p_user_id
    -- Bloquear es de una sola dirección en toda la app: deja de llegarte lo
    -- suyo, y a la otra persona no se le dice nada ni se le cierra nada. Aquí
    -- igual, para no inventar una regla distinta en una pantalla suelta.
    and not public.has_blocked(p.id);
$$;

revoke execute on function public.public_profile(uuid) from public;
grant execute on function public.public_profile(uuid) to authenticated;
