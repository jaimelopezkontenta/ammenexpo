# ADR 0006 — Claves de caché desde una fábrica y cliente Supabase tipado

Estado: aceptada (2026-09-29).

## Contexto

La auditoría de septiembre encontró 184 `queryKey: [...]` escritos a mano en 61 raíces
y dos invalidaciones (`["openHolds"]`, `["openCrisis"]`) que no refrescaban nada porque
ninguna query las usaba: una clave distinta entre la query y su invalidación falla en
silencio y la pantalla enseña el dato viejo. En paralelo, `createClient` no llevaba el tipo
`Database`, así que ~96 `userId!`, 26 `as unknown as` y decenas de casts nominales
sustituían a un contrato que la base ya generaba.

## Decisión

- `core/query/keys.ts` (`qk`) define cada clave una vez, con los tipos de sus parámetros:
  `qk.myPlans(userId)` es la clave entera y `qk.myPlans.root` el prefijo para invalidar.
  Los valores son exactamente los que había (un test los fija). ESLint prohíbe escribir
  un `queryKey` literal o un `setQueryData([...])` fuera de ese fichero.
- `utils/supabase.ts` usa `createClient<Database>` con `types/supabase.ts`, generado por
  `npm run db:types` y comprobado en `verify` y en CI (`db:types:check`).
- Las puertas de error usan `isLoadingError`: `isError` sigue en `true` tras un refetch
  fallido aunque haya datos en pantalla y los tapaba.

## Consecuencias

- Cambiar una clave es tocar un sitio; el compilador muestra todos los usos.
- El flip a cliente tipado destapó cursores que enviaban `null` donde el tipo generado dice
  «omitido» (equivalente, el argumento tiene `default null`) y un insert que depende del
  trigger de `plan_owner_id` (un cast con comentario).
- Quedan casts `as X[]` en lecturas ya tipadas; retirarlos exige lint con tipos
  (`no-unnecessary-type-assertion`), aplazado por su coste.
- Los `userId!` de `core/**/queries.ts` siguen; el paso siguiente es que esos hooks reciban
  un `userId` obligatorio (`useRequiredUserId`).
