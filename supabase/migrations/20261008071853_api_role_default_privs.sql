-- El recorte manual, convertido en migración.
--
-- La inicialización de Supabase deja reglas de privilegios por defecto en el
-- esquema public: cada tabla que crea `postgres` (todas las de esta base,
-- porque las migraciones corren como postgres) hereda para `anon` y
-- `authenticated` un `GRANT DELETE, REFERENCES, TRIGGER, MAINTAIN`.
--
-- El test de catálogo de rls.sql lo prohibía ya (TRUNCATE/REFERENCES/TRIGGER/
-- MAINTAIN «sobran igual»), y en las bases locales se recortó a mano — por eso
-- la suite pasaba en local. En un `supabase db reset` limpio, como el de CI,
-- el recorte manual no existe y cada reset nuevo dejaba main rojo: era un
-- arreglo manual que nunca se versionó.
--
-- DELETE se queda: es la puerta que hace que la RLS se evalúe (sin el grant la
-- query ni llega a la policy), y cada tabla sigue regulando quién lo usa.
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN no los toca nadie en runtime: PostgREST
-- no los expone, las FK y los triggers se crean en migraciones (como postgres),
-- y el mantenimiento de tabla es del sistema.
--
-- La segunda sentencia es la que de verdad arregla el futuro: sin ella, cada
-- tabla nueva de cada migración nueva volvería a heredar el sobrante.
--
-- Test: la aserción de catálogo de supabase/tests/rls.sql (falla sin esta
-- migración sobre un reset limpio, pasa con ella).

revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated;

alter default privileges in schema public
  revoke truncate, references, trigger, maintain on tables
  from anon, authenticated;
