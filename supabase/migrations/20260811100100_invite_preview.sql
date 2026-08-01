-- Ammen — quién te invitó.
--
-- `invites` se podía canjear desde la Fase 1 —`redeem_invite_code` existe y el
-- cliente la llama— pero **nada insertaba una fila**, así que no podía existir un
-- código que canjear. `rememberInviteCode` estaba exportada sin que la llamara
-- nadie: tampoco había ruta que capturara el código. Las tres cadenas `invite.*`
-- llevan traducidas desde el principio.
--
-- Es la única vía de entrada para alguien que **todavía no tiene un plan que
-- compartir**, que es exactamente quien acaba de instalar la app.

-- La policy de SELECT de `invites` deja ver las tuyas y las que aceptaste, que
-- es lo correcto — y deja fuera justo el caso que hace falta aquí: alguien sin
-- cuenta que abre un enlace y quiere saber de quién es antes de registrarse.
--
-- Devuelve **el nombre y nada más**. Ni el id de quien invita, ni cuántas veces
-- se ha usado el código: un enlace que circula por un grupo de WhatsApp no
-- tiene por qué contarle a un desconocido nada más que quién lo mandó.
create function public.get_invite_preview(p_code text)
returns table (inviter_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name
  from public.invites i
  join public.profiles p on p.id = i.inviter_id
  where i.code = p_code;
$$;

revoke execute on function public.get_invite_preview(text) from public;

-- A `anon` también: la pantalla la abre alguien que todavía no tiene cuenta, que
-- es el punto entero de una invitación.
grant execute on function public.get_invite_preview(text) to anon, authenticated;
