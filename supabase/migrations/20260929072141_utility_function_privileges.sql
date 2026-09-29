-- Oleada 1a de la auditoría (2026-09-29): utilidades fuera del alcance de anon.
--
-- Cinco funciones auxiliares se crearon sin revocar el EXECUTE por defecto de
-- PUBLIC, así que cualquiera sin sesión podía llamarlas por PostgREST. Las dos
-- del filtro (`is_objectionable`, `is_crisis_text`) son las que importan:
-- dejaban probar, sin cuenta y sin límite, qué frases pasan el filtro de
-- moderación y el de crisis. Ninguna pantalla anónima las usa; las RPC
-- públicas que las necesitan son SECURITY DEFINER.
--
-- Quien tiene sesión las conserva: triggers y búsquedas que corren con sus
-- permisos siguen funcionando igual.

revoke execute on function public.generate_token() from public, anon;
revoke execute on function public.immutable_unaccent(text) from public, anon;
revoke execute on function public.is_crisis_text(text) from public, anon;
revoke execute on function public.is_objectionable(text) from public, anon;
revoke execute on function public.normalize_book_name(text) from public, anon;

grant execute on function public.generate_token() to authenticated, service_role;
grant execute on function public.immutable_unaccent(text) to authenticated, service_role;
grant execute on function public.is_crisis_text(text) to authenticated, service_role;
grant execute on function public.is_objectionable(text) to authenticated, service_role;
grant execute on function public.normalize_book_name(text) to authenticated, service_role;
