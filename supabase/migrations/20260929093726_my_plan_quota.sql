-- Oleada 2a de la auditoría (2026-09-29): la cuota, antes del formulario.
--
-- Los tres planes gratuitos se descubrían al enviar el formulario entero:
-- `reserve_generation` devolvía `quota_exhausted` y la pantalla enseñaba el
-- límite a quien ya había elegido temas, duración y círculos. Esto deja leer
-- la cuota antes, contada exactamente igual que la cuenta `reserve_generation`
-- (filas del ledger de alcance personal o de círculo, de por vida).
--
-- El límite (3) está repetido a propósito aquí y en `reserve_generation`;
-- `supabase/tests/generation.sql` comprueba que los dos dicen lo mismo.

create or replace function public.my_plan_quota()
returns table (used integer, quota_limit integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer
       from public.generation_ledger l
      where l.user_id = (select auth.uid())
        and l.scope in ('personal', 'circle')),
    3;
$$;

revoke execute on function public.my_plan_quota() from public, anon;
grant execute on function public.my_plan_quota() to authenticated;
