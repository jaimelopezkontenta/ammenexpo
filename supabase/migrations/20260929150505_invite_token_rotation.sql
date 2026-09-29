-- Oleada 4d (2026-09-29): un enlace de invitación que se ha escapado se puede
-- cambiar.
--
-- El token de un círculo (`groups.invite_token`) y el código de invitación
-- personal (`invites.code`) se generaban una vez y no cambiaban nunca:
-- `circle_invite_token()` solo lo lee y `useMyInviteCode` lo cachea «para
-- siempre». Si el enlace de un círculo privado acababa en un grupo público de
-- WhatsApp, la única salida era borrar el círculo. Ahora:
--
--   - `rotate_circle_invite_token(p_group_id)`: solo quien administra el
--     círculo (rol owner/admin, o quien lo creó). Devuelve el token nuevo.
--   - `rotate_my_invite_code()`: el código propio. Devuelve el código nuevo (y
--     crea uno si aún no había).
--
-- El viejo deja de canjearse en el acto: `join_group_with_token`,
-- `redeem_share_token`, `redeem_invite_code` y las vistas previas buscan por
-- el valor, no guardan copia. Lo que ya se hizo con el viejo —quien entró, a
-- quién sigue— se queda como estaba; y ningún otro token cambia (los
-- `share_links` de planes y de círculo tienen su propia vida y su revocación).
--
-- Los correos de invitación todavía en cola con el token viejo se marcan
-- `skipped` (`token_rotated`): llevarían a un enlace muerto.
--
-- Sin UI todavía: la pantalla del círculo y la de invitar tienen que ofrecerlo
-- (y, en el cliente, invalidar `qk.inviteCode`, que hoy tiene `staleTime:
-- Infinity`). Queda para producto.

create or replace function public.rotate_circle_invite_token(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_old text;
  v_new text;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  select g.invite_token into v_old
    from public.groups g
   where g.id = p_group_id
     and (
       g.owner_id = uid
       or exists (
         select 1 from public.group_members m
          where m.group_id = g.id
            and m.user_id = uid
            and m.role in ('owner', 'admin')
       )
     )
   for update of g;

  -- Mismo error si el círculo no existe que si no es tuyo: la función no
  -- sirve para preguntar qué ids existen.
  if v_old is null then
    raise exception 'only a circle admin can rotate its invite link'
      using errcode = '42501';
  end if;

  update public.groups
     set invite_token = public.generate_token()
   where id = p_group_id
  returning invite_token into v_new;

  update public.email_outbox o
     set status = 'skipped',
         last_error = 'token_rotated',
         leased_until = null
   where o.status = 'pending'
     and o.template = 'invite_circle'
     and o.payload ->> 'token' = v_old;

  return v_new;
end;
$$;

revoke execute on function public.rotate_circle_invite_token(uuid) from public, anon;
grant execute on function public.rotate_circle_invite_token(uuid) to authenticated;

create or replace function public.rotate_my_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_old text[];
  v_new text;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  -- Serializa con otra rotación de la misma persona (dos pestañas): la segunda
  -- ve ya los códigos de la primera.
  perform pg_advisory_xact_lock(hashtextextended('invite_code:' || uid::text, 0));

  select coalesce(array_agg(i.code), '{}') into v_old
    from public.invites i
   where i.inviter_id = uid;

  -- Todas sus filas, no solo la que enseña la app: un doble toque en «crear»
  -- pudo dejar dos, y cualquiera que circule tiene que dejar de valer. Quién
  -- aceptó cada una (`accepted_by`) se queda: es historia, no el enlace.
  update public.invites
     set code = public.generate_token()
   where inviter_id = uid;

  -- La que enseña la app (`useMyInviteCode`): la más antigua.
  select i.code into v_new
    from public.invites i
   where i.inviter_id = uid
   order by i.created_at, i.id
   limit 1;

  if v_new is null then
    insert into public.invites (inviter_id)
    values (uid)
    returning code into v_new;
  end if;

  update public.email_outbox o
     set status = 'skipped',
         last_error = 'token_rotated',
         leased_until = null
   where o.status = 'pending'
     and o.template = 'invite_app'
     and o.payload ->> 'token' = any (v_old);

  return v_new;
end;
$$;

revoke execute on function public.rotate_my_invite_code() from public, anon;
grant execute on function public.rotate_my_invite_code() to authenticated;
