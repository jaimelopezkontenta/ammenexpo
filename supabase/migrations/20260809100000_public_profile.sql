-- Ammen — quién es la persona que oró por ti.
--
-- Hasta aquí, alguien que ora por ti es una cadena de texto y ahora también una
-- cara. Esto le da un sitio al que ir.
--
-- **La racha no sale.** Está en `profiles` y sería trivial devolverla, pero la
-- racha de este producto es deliberadamente indulgente —un día de gracia—
-- precisamente para que no apriete. Publicarla convierte una disciplina privada
-- en un marcador, y en una app de oración ese es el incentivo equivocado: en tu
-- propio perfil es motivación, en el de otra persona es comparación. Lo que sí
-- ayuda al bucle social es desde cuándo lleva alguien aquí.

create function public.public_profile(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  member_since date,
  shares_circle boolean,
  is_me boolean
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
    p.id = (select auth.uid())
  from public.profiles p
  where p.id = p_user_id
    -- Bloquear es de una sola dirección en toda la app: deja de llegarte lo
    -- suyo, y a la otra persona no se le dice nada ni se le cierra nada. Aquí
    -- igual, para no inventar una regla distinta en una pantalla suelta.
    and not public.has_blocked(p.id);
$$;

revoke execute on function public.public_profile(uuid) from public;
grant execute on function public.public_profile(uuid) to authenticated;
