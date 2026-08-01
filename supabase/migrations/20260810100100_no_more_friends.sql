-- Ammen — fuera los amigos.
--
-- `friendships` llevaba aquí desde la primera migración: tabla, enum
-- `friendship_status`, cuatro policies, GRANT y `are_friends()`. **Nunca hubo
-- una pantalla.** Lo único que la escribía era `ensure_friendship`, llamada en
-- silencio al canjear un enlace o una invitación, y lo único que la leía eran
-- dos ramas de policy colgando de `visibility = 'friends'` — un valor que la
-- Edge Function no escribe jamás (solo `private`, `link` o `group`), así que
-- esas ramas llevaban un año siendo código muerto que aun así había que leer
-- cada vez que alguien tocaba los permisos de un plan.
--
-- **Lo que canjear un enlace hacía de verdad no era la amistad**: era
-- `plan_shares`, que se queda intacta. Quitar esto no cierra ningún acceso, y
-- hay una assertion que lo comprueba en vez de suponerlo.
--
-- En su lugar, canjear un enlace **te hace seguir a esa persona**, que es el
-- equivalente honesto: alguien te compartió su plan, tú lo abriste, y a partir
-- de ahí quieres enterarte de lo suyo. Con una diferencia que importa: esto se
-- deshace con un toque, y la amistad silenciosa no se podía deshacer de ninguna
-- forma porque no se podía ni ver.

-- ---------------------------------------------------------------------------
-- Seguir al canjear
-- ---------------------------------------------------------------------------

create function public.ensure_follow(p_follower uuid, p_followee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_follower is null or p_followee is null or p_follower = p_followee then
    return;
  end if;

  -- SECURITY DEFINER se salta la RLS, así que la regla de la policy hay que
  -- repetirla a mano: un enlace compartido no puede colar un seguidor entre dos
  -- personas que se bloquearon.
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_follower and b.blocked_id = p_followee)
       or (b.blocker_id = p_followee and b.blocked_id = p_follower)
  ) then
    return;
  end if;

  insert into public.follows (follower_id, followee_id)
  values (p_follower, p_followee)
  on conflict do nothing;
end;
$$;

revoke execute on function public.ensure_follow(uuid, uuid) from public;

-- Solo la llaman las dos funciones de canje, que ya son SECURITY DEFINER. Nadie
-- necesita invocarla desde fuera: seguir a alguien se hace escribiendo en
-- `follows`, y ahí decide la policy.
grant execute on function public.ensure_follow(uuid, uuid) to service_role;

create or replace function public.redeem_share_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.share_links;
  plan_owner uuid;
  circle_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into link
  from public.share_links sl
  where sl.token = p_token
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now());

  if link is null then
    -- Not a share link. It may be a circle invitation.
    select g.id into circle_id
    from public.groups g
    where g.invite_token = p_token;

    if circle_id is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
    end if;

    insert into public.group_members (group_id, user_id, role)
    values (circle_id, current_user_id, 'member')
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('ok', true, 'scope', 'circle',
                              'circle_id', circle_id);
  end if;

  if link.scope = 'plan' then
    select p.owner_id into plan_owner
    from public.prayer_plans p
    where p.id = link.plan_id;

    if plan_owner is null then
      return jsonb_build_object('ok', false, 'reason', 'plan_missing');
    end if;

    if plan_owner = current_user_id then
      return jsonb_build_object('ok', true, 'scope', 'plan',
                                'plan_id', link.plan_id, 'self', true);
    end if;

    insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
    values (link.plan_id, current_user_id, plan_owner)
    on conflict do nothing;

    -- El acceso al plan lo da `plan_shares`, arriba. Esto es otra cosa: quien
    -- abre el enlace pasa a seguir a quien lo mandó. En una dirección — a la
    -- otra persona no se le añade nada.
    perform public.ensure_follow(current_user_id, plan_owner);

    return jsonb_build_object('ok', true, 'scope', 'plan',
                              'plan_id', link.plan_id);
  else
    insert into public.group_members (group_id, user_id, role)
    values (link.group_id, current_user_id, 'member')
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('ok', true, 'scope', 'group',
                              'group_id', link.group_id);
  end if;
end;
$$;

create or replace function public.redeem_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into inv
  from public.invites i
  where i.code = p_code;

  if inv is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if inv.inviter_id = current_user_id then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- First acceptance wins; later ones still create the follow so a code
  -- forwarded around a family chat keeps working.
  if inv.accepted_by is null then
    update public.invites
       set accepted_by = current_user_id,
           accepted_at = now()
     where id = inv.id;
  end if;

  perform public.ensure_follow(current_user_id, inv.inviter_id);

  return jsonb_build_object('ok', true, 'inviter_id', inv.inviter_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- El enum: fuera 'friends', dentro 'public'
-- ---------------------------------------------------------------------------
--
-- Quitar un valor de un enum obliga a recrear el tipo — no hay `drop value`. Se
-- hace aquí, junto con la limpieza, y no en la migración de los planes
-- públicos, para no dejar el valor muerto conviviendo con el nuevo ni un
-- commit: un enum con un valor que nadie debe usar es una trampa esperando a
-- que alguien lo elija.
--
-- 'public' entra ahora aunque no lo use nadie todavía: `alter type ... add
-- value` no se puede usar en la misma transacción en que se añade, y recrear el
-- tipo lo resuelve de una vez.

drop policy "plans are readable by owner and people they are shared with"
  on public.prayer_plans;

create type public.plan_visibility_new
  as enum ('private', 'group', 'link', 'public');

-- El CHECK también habla del tipo viejo, y cambiar la columna debajo lo deja
-- comparando peras con manzanas: "operator does not exist: plan_visibility_new
-- <> plan_visibility". Se suelta y se vuelve a poner igual.
alter table public.prayer_plans
  drop constraint prayer_plans_group_required;

alter table public.prayer_plans
  alter column visibility drop default;

alter table public.prayer_plans
  alter column visibility type public.plan_visibility_new
  using (
    -- No hay ninguna fila así —el servidor nunca escribió 'friends'— pero una
    -- conversión que revienta a mitad de un despliegue por una fila que "no
    -- debería existir" es exactamente cómo se pierde una tarde.
    case visibility::text
      when 'friends' then 'private'
      else visibility::text
    end
  )::public.plan_visibility_new;

drop type public.plan_visibility;
-- Sin esquema en el nombre nuevo: `rename to` toma un identificador pelado.
alter type public.plan_visibility_new rename to plan_visibility;

alter table public.prayer_plans
  alter column visibility set default 'private'::public.plan_visibility;

alter table public.prayer_plans
  add constraint prayer_plans_group_required
    check (visibility <> 'group' or group_id is not null);

-- ---------------------------------------------------------------------------
-- Los permisos, sin la rama muerta
-- ---------------------------------------------------------------------------
--
-- `visibility = 'public'` entra ya: la pantalla que lo elige llega en el
-- siguiente commit, pero el permiso es lo que decide si un plan público se
-- puede abrir, y prefiero que lo cubran las assertions desde el principio.
--
-- **Los días siguen bajo la misma regla.** `can_read_plan_day` exige
-- `unlock_date <= plan_today(...)`, así que un plan público no adelanta nada; y
-- `prayer_body` y `daily_action` siguen fuera del grant por columna, así que la
-- oración en primera persona no se publica con el plan.

create or replace function public.can_read_plan(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.prayer_plans p
    where p.id = pid
      and (
        p.owner_id = (select auth.uid())
        or public.has_plan_share(p.id)
        or (
          p.group_id is not null
          and exists (
            select 1 from public.group_members m
            where m.group_id = p.group_id
              and m.user_id = (select auth.uid())
          )
        )
        or p.visibility = 'public'
      )
  );
$$;

create policy "plans are readable by owner and people they are shared with"
  on public.prayer_plans for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.has_plan_share(id)
    or (group_id is not null and public.is_group_member(group_id))
    or visibility = 'public'
  );

-- ---------------------------------------------------------------------------
-- Y ahora sí
-- ---------------------------------------------------------------------------

drop function public.ensure_friendship(uuid, uuid);
drop function public.are_friends(uuid, uuid);
drop table public.friendships;
drop type public.friendship_status;
