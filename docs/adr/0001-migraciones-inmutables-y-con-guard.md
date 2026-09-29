# 0001 · Migraciones inmutables, con timestamp real y con guard

**Estado:** aceptada · 2026-09-29

## Contexto

El 2026-09-29 apareció una base local con ocho migraciones aplicadas que no
existían en el repo ni en git: su SQL solo vivía en
`supabase_migrations.schema_migrations.statements`, y una de ellas compartía
versión con otra que sí estaba (`20260908100000`). `db push` compara versiones,
no contenidos: con dos ficheros bajo el mismo número, el segundo nunca llega. Un
`db reset` (que hacen `db:test`, `verify` y `e2e`) lo habría borrado todo. La
mayoría de las versiones del repo llevaba además fechas posteriores al commit
que las añadió: un contador hecho a mano.

## Decisión

- Una migración nueva sale siempre de `npx supabase migration new` (timestamp real).
- Lo ya publicado en `origin/main` no se edita ni se borra. `npm run
migrations:check` lo comprueba, también en CI (`verify.yml`, con historia
  completa), junto con nombres, versiones únicas y orden creciente.
- `npm run doctor` falla si la base local tiene migraciones aplicadas sin
  fichero, o dos con el mismo número.
- Se reintegró lo rescatado como migraciones idempotentes (`create or replace`,
  `if [not] exists`) para valer también sobre una base que ya tuviera las
  versiones originales; el SQL literal se conserva en `supabase/rescue/`.
- Cada migración lleva su test SQL.

## Consecuencias

- No se hace squash del historial: staging ya lo tiene aplicado. Un baseline, si
  acaso, antes de crear producción.
- Hay una excepción documentada posible en `IMMUTABILITY_EXCEPTIONS`
  (`scripts/checkMigrations.mjs`) para un `migration repair` en staging.
- Quien trabaje con agentes o a mano contra la base local debe volcar el SQL a un
  fichero antes de que exista.
