# Runbook — baseline local reproducible (RDY-00)

## Arrancar

```powershell
npx supabase start   # o: npm run db:start
npm run web           # nunca `npm run dev`, que no existe
```

## Reset repetible + smoke de los dos seeds

```powershell
npx supabase db reset
```

Cuentas seed (**solo local**, `supabase/seed.sql` — nunca reutilizar estas
contraseñas en staging/producción):

| Correo | Contraseña | Estado |
|---|---|---|
| `prueba@ammen.local` | `ammen1234` | onboarding hecho, términos aceptados |
| `zoe@ammen.local` | `ammen1234` | onboarding hecho, términos aceptados |

Evidencia automatizada: `e2e/baseline.spec.ts` (Playwright, Chromium) —
ambos seeds entran y aterrizan en Hoy/Orar sin repetir onboarding/términos,
y dos browser contexts no comparten sesión. Repetible desde reset:

```powershell
npx supabase db reset
npx playwright test e2e/baseline.spec.ts --project=chromium
```

Corrido dos veces consecutivas en esta sesión (ver log del plan, RDY-00 /
RDY-07): 3/3 tests verdes ambas veces.

## Una cuenta fresca (legal + onboarding, manual)

No automatizado todavía por Playwright — pendiente en RDY-08 (guion H de la
sección 5). Manual: `npm run web` → "Crear cuenta" → aceptar términos →
completar el cuestionario de onboarding → llega a Hoy.

## `npm run verify`

`typecheck` + `lint` + `test` (Vitest) + `db:test` (10 suites SQL,
serializadas: cada una hace su propio `supabase db reset` antes de correr,
nunca en paralelo con otra).

**Nota de entorno (Windows + Docker Desktop, este host):** `supabase db
reset` incluye un paso de "Restarting containers" que en este host, cargado
con contenedores de otros proyectos, falla de forma intermitente con
`LegacyStorageGatewayStatusError` — un 502 al verificar el gateway de
Storage, no un fallo de las migraciones ni del esquema (que ya habían
terminado de aplicarse y sembrarse cuando el error aparece). Reintentar el
mismo comando resuelve la mayoría de las veces. `.github/workflows/verify.yml`
corre en un runner Linux efímero de un solo proyecto, donde no se ha
observado (ni se espera, dado que la causa parece ser contención de recursos
de este host compartido) el mismo problema — pero no hay evidencia de CI
real todavía, solo el workflow escrito.

```powershell
npm run verify
```
