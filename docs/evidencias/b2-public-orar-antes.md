# Evidencia B2 — comportamiento observado ANTES del fix

> Ticket: RDY-02 / blocker B2 (auditoría G2, hasta aquí `[I]`).
> Regla del plan: primero observar el comportamiento vigente; solo después
> aplicar la corrección acordada. Esta página es el "antes".

- **Execution ID:** `b2-antes-20260805`
- **Fecha UTC:** 2026-08-05
- **SHA:** `845d9cbb3c69358a65a3fb7b23d45e537952a691` + WIP preexistente (sin
  cambios de este plan todavía)
- **Entorno:** Windows 11, Docker 29.6.1, Supabase CLI 2.110.0, Postgres 17
  local (`supabase_db_ammen`), esquema hasta `20260818100000_signup_source.sql`
- **Comando:** `docker exec -i supabase_db_ammen psql -U postgres -d postgres
  -v ON_ERROR_STOP=1 -f - < b2-experimento-antes.sql` (script fuera del repo,
  mismo patrón que las suites)
- **Montaje:** dueña A y extraña B; plan `visibility='public'`, `status='active'`,
  día 1 desbloqueado hoy; **cero filas** en `plan_shares`. Todo como B.

## Resultados observados (sin interpretar)

| Superficie | Consulta como B | Observado |
|---|---|---|
| Tab Orar | `plans_shared_with_me()` filtrado al plan | **1 fila — aparece** |
| Fila del plan | `prayer_plans` vía RLS | 1 fila — legible |
| Comunidad | `home_feed()` con `kind='plan'` | 1 fila — aparece |
| Día abierto | `prayer_plan_days` vía RLS | 1 fila — legible |
| Botón de oración | `insert` en `intercessions` como B | **INSERT 0 1 — aceptado** |

## Lectura

La hipótesis `[I]` de la auditoría queda **confirmada como hecho local**: con el
esquema vigente, un plan `public` sin share explícito entra en la pestaña Orar y
acepta la acción de orar desde la API, no solo desde Comunidad. Es coherente con
la mecánica: `plans_shared_with_me()` es `SECURITY INVOKER` sin filtro propio y
la policy de lectura incluye la rama `visibility = 'public'`.

## Contrato aplicado después (decisión del plan, §2.11)

1. `public` es **descubrible y abrible desde Comunidad** (se conserva).
2. Solo un **share explícito** (directo o vía círculo) aparece en Orar y habilita
   la oración.
3. `/orar/[planId]` aplica esa autorización **server-side**, no por ausencia en
   la lista del cliente.

El "después" lo prueban las assertions añadidas a `supabase/tests/plans.sql`
(migración `20260820100000_public_plan_contract.sql`) y, desde el ciclo de
corrección del 2026-08-05, el spec E2E real `e2e/public-contract.spec.ts`
(Playwright/Chromium, contra Supabase local) — **ejecutado, no solo citado**:
3/3 tests en verde, repetido dos veces consecutivas. Cubre lo que SQL solo no
puede: que Orar lo excluya *en el navegador*, que `/orar/[planId]` lo
rechace al navegar directo por URL (no solo al filtrar una lista), que
Comunidad lo siga abriendo para leer, y que un enlace creado con un clic real
en `/plan/[id]/compartir` (no una fila insertada a mano) haga que Orar lo
acepte tras canjearlo.

> Nota de corrección: una versión anterior de este documento citaba ese
> mismo archivo como evidencia sin que existiera todavía en el repositorio.
> Quedó corregido en el ciclo de verificación del 2026-08-05; ver el log del
> plan.

Sin texto de oración, datos personales ni frases de crisis en esta evidencia.
