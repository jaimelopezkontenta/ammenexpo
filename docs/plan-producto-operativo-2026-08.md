# Plan de producto operativo — agosto de 2026 (anexo)

> **Anexo operativo** de `docs/plan-implementacion-readiness-2026-08.md` (el "plan RDY").
> No lo sustituye: la fuente de verdad de alcance, blockers B0–B5, reglas de cierre
> y guiones de usuario sigue siendo ese documento. Esto es la lectura ejecutable,
> por olas pequeñas, para quien tiene que operar o implementar sin releer las 1400
> líneas cada vez. Si algo aquí contradice al plan RDY, manda el plan RDY.

## 1. Regla de verdad (sin cambios respecto al plan RDY)

1. Nada se marca cerrado sin evidencia ejecutada sobre el commit candidato.
2. Existencia de código, revisión estática, mocks o una captura aislada no equivalen a PASS.
3. Cada ticket exige criterios binarios completos y su matriz de pruebas aplicable.
4. Un fallo abierto invalida el PASS; no se promedian blockers ni plataformas.
5. El cierre lo aprueban responsable técnico y dueño operativo; safety requiere además especialista.

Estado global: **REJECT / no aprobado para lanzamiento público** — Gate 1 cerca de
completo, Gate 2 en progreso, Gates 3 y 4 sin alcanzar. Nada de este anexo
cambia ese estado.

## 2. Olas (slices)

El juez eligió slices pequeños. Cada ola es un conjunto de cambios verificables por
separado, con sus propios gates binarios, sin arrastrar trabajo de olas futuras.

| Ola | Alcance | Estado en este anexo |
|---|---|---|
| **Ola 1** (esta) | (1) este documento; (2) fix de enrutado en `app/persona/[id].tsx`; (3) regresión Playwright del contrato desde persona; (4) fail-closed del sender de push | Implementada y verificada local |
| Ola 2+ | ledger/cuota/lease IA, flags server-side, pg_cron, simetría de bloqueo, revocación de grants | Especificadas abajo (sección 6); **flags server-side: primer slice implementado** (sección 9), el resto **no implementado** |

## 3. Ola 1 — qué se hizo, archivos y gates

### 3.1 Documento operativo

- **Archivo:** `docs/plan-producto-operativo-2026-08.md` (este mismo).
- **Gate binario:** existe, enlaza RDY-00..13, no contradice el plan RDY, y la
  matriz de estado (sección 5) coincide con el log de ejecución del plan RDY.

### 3.2 Fix de enrutado: `app/persona/[id].tsx`

- **Bug confirmado (DEF-01 del plan RDY, corregido parcialmente en Comunidad pero
  no aquí).** `person_plans()` solo devuelve planes `visibility = 'public'`
  (migración `20260810100200_community.sql`), pero la pantalla de persona los
  enlazaba a `/orar/[planId]`. Desde el contrato B2
  (`20260820100000_public_plan_contract.sql`), `/orar/[planId]` rechaza un plan
  público sin share explícito — el enlace que la lista prometía quedaba roto para
  el 100% de los planes públicos sin share.
- **Cambio:** los planes de esa lista navegan ahora a `/plan-publico/[planId]`
  (lectura pública, `get_public_plan_day()`), que es exactamente lo que la lista
  promete. `/orar/[planId]` se conserva únicamente en la superficie de Orar, que
  sí exige share explícito (`plans_shared_with_me()` / `get_shared_plan_day()`).
- **No se tocó copy** (paridad es/en intacta): el cambio es solo de `pathname`.
- **Archivos:** `app/persona/[id].tsx` (un `href`, más comentario).
- **Gate binario:** un plan público sin share, abierto desde la pantalla de
  persona, termina en lectura pública (URL `/plan-publico/…`, versículo visible)
  y **no** ofrece la acción de orar.

### 3.3 Regresión Playwright: `e2e/public-contract.spec.ts`

- **Qué añade:** un test que, con el plan público sin share sembrado por SQL
  controlado (mismo patrón que el resto del spec), entra como la cuenta B, abre
  `/persona/{dueño}`, pulsa el enlace del plan y afirma: URL `/plan-publico/`,
  versículo visible, cero botones «Oré por ti».
- **Qué NO inventa:** la precondición (plan público sin share) se crea por SQL
  con `e2e/helpers/sql.ts`, igual que los otros tres tests del spec; la acción
  que se prueba (navegar desde persona) pasa por la UI real.
- **Límite documentado:** la navegación se fuerza con `page.goto()` a la pantalla
  de persona (no hay aún un clic end-to-end desde Comunidad → perfil de autor en
  este spec); eso ya lo cubre el test «descubrible desde Comunidad» del mismo
  spec, y el contrato completo Orar↔public sigue siendo responsabilidad de
  RDY-08. No se añadió un journey nuevo, solo la regresión del enrutado.
- **Archivos:** `e2e/public-contract.spec.ts`.
- **Gate binario:** `npx playwright test e2e/public-contract.spec.ts --project=chromium --workers=1` → 4/4.

### 3.4 Fail-closed del sender: `supabase/functions/send-intercession-push`

- **Antes:** si `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` faltaban, `index.ts`
  usaba `Deno.env.get(...)!` y `createClient` recibía `undefined` — sin una rama
  que desactivara el envío explícitamente.
- **Ahora:** `resolveSenderConfig(env)` (puro, en `payload.ts`, testeado por
  Vitest) decide antes de tocar nada:
  - `PUSH_SENDER_ENABLED === "false"` → deshabilitado por kill switch (semántica
    intacta: apagado en caliente sin redeploy, respuesta `{ok:true,skipped:"kill_switch",sent:0}`).
  - URL o clave de servicio ausentes o vacías → **fail-closed**: respuesta
    `{ok:false,error:"sender_not_configured"}` con `503`, **sin** crear cliente,
    **sin** arrendar ninguna fila del outbox y **sin** hablar con Expo.
  - Ambas presentes → habilitado, y el resto del flujo no cambia.
- **Sin secretos en errores/logs:** la rama `disabled` solo devuelve una etiqueta
  fija; `resolveSenderConfig` nunca devuelve ni registra la URL ni la clave. Los
  `console.error` existentes solo imprimen mensajes/estados de error de PostgREST
  o de transporte, nunca credenciales.
- **Archivos:** `supabase/functions/send-intercession-push/index.ts`,
  `supabase/functions/send-intercession-push/payload.ts`,
  `supabase/functions/send-intercession-push/payload.test.ts` (+6 tests).
- **Gate binario:** `npx vitest run supabase/functions/send-intercession-push` → 34/34.

## 4. Mapa de fases, dependencias y gates acumulativos

Idéntico al plan RDY (sección 3). Reproducido aquí para no abrir dos documentos:

```text
F0  RDY-00 baseline local reproducible
 │
 ├── F1  RDY-01 B0 ───────┐
 │       RDY-02 B2        ├── Gate 1: seguridad/contrato
 │       RDY-03 CI ───────┘
 │
 ├── F2  RDY-04 auth ─────────────┐
 │       RDY-05 hold              ├── Gate 2: auth/safety mínima
 │       RDY-06 crisis ───────────┘
 │
 ├── F3  RDY-07 harness Playwright ─┐
 │       RDY-08 journeys web         ├── Gate 3: beta privada
 │       RDY-09 observabilidad ──────┘
 │
 └── F4  RDY-10 tokens/dispositivo ─┐
          RDY-11 entrega push         ├── Gate 4: candidato público
          RDY-12 Maestro Android      │
          RDY-13 iOS/canary ──────────┘
```

- **Gate 0** — baseline reproducible: dos resets serializados, `npm run web`,
  seeds + cuenta fresca, resultado real de `verify` registrado.
- **Gate 1** — seguridad/contrato: RDY-01/02/03 PASS; B0 con negativos y
  administrativos; experimento B2 antes/después; CI obligatorio serializado.
- **Gate 2** — auth/safety mínima: Gate 1 verde; auth beta en staging
  (confirmación/recovery); hold con dueño/cola/liberar/retirar auditados; crisis
  sin publicación y con escalado humano.
- **Gate 3** — beta privada: Gates 0–2 verdes; Playwright dos contexts; CI y
  observabilidad mínima; cohorte 5–15 adultos conocidos.
- **Gate 4** — lanzamiento público: Gate 3 verde en candidate SHA; hold/crisis
  completos con SLA ensayado; push real dos dispositivos; Maestro Android + pase
  iOS real; `verify`+E2E verdes en el mismo SHA; canary bajo umbrales.

## 5. Matriz de estado por ticket (PASS-local / PENDING / SCAFFOLDED)

Fiel al log de ejecución del plan RDY (secciones 9–13). "PASS local" es verde en
este host; "PENDING" es trabajo o evidencia externa aún no ejecutada; "SCAFFOLDED"
es código escrito y sin ejecución acreditada.

| Ticket | Blocker | Estado | Qué falta para el PASS completo |
|---|---|---|---|
| RDY-00 baseline | B5 | **PASS local** (smoke web) | Nada local: la cuenta fresca (legal+onboarding) queda automatizada por `e2e/fresh-account.spec.ts` |
| RDY-01 B0 | B0 | **PASS local** | Nada local; evidencia aprobada por responsable técnico |
| RDY-02 B2 | B2 | **PASS local** | Repetir guion F (público/Orar) con este enrutado ya corregido |
| RDY-03 CI | B5 | **SCAFFOLDED** | Run real de `.github/workflows/verify.yml` en GitHub Actions + protección de rama |
| RDY-04 auth | B3 | **PASS local** (mínimo local) | Auth real en staging (SMTP/API/web, confirmación/recovery/redirects) |
| RDY-05 hold | B1a | **PASS local** (mecanismo) | Ejercicio de SLA humano; operación de liberar/retirar con moderador real |
| RDY-06 crisis | B1b | **PASS local** (mecanismo) | Aprobación de especialista; simulacro humano con paging/SLA |
| RDY-07 harness | B5 | **PASS local** | Nada local; validar en CI el lock + artefactos |
| RDY-08 journeys | B5 | **PENDING (parcial)** | `moderation`, `auth` (staging) y `privacy-rights`; hoy baseline + public-contract + share-loop + fresh-account |
| RDY-09 observabilidad | B5 | **PASS local** (allowlist/schema/kill switch) | Proveedor de producción real conectado + alerta con dueño |
| RDY-10 tokens | B4 | **PASS local** (modelo) | Permiso allow/deny y token en dispositivo físico |
| RDY-11 sender push | B4 | **PASS local** (outbox/payload) | Entrega real con dos dispositivos y receipts del proveedor |
| RDY-12 Maestro Android | B5 | **SCAFFOLDED** | Instalar ADB/Maestro y ejecutar sobre preview/release |
| RDY-13 iOS/canary | B5 | **PENDING** (`eas.json` SCAFFOLDED) | Mac/EAS/TestFlight + iPhone físico; pase iOS real |

### 5.1 Resultados de la Ola 1 (comandos ejecutados, con salida real)

```text
npm run typecheck
  → PASS, tsc --noEmit sin errores.

npm run lint
  → PASS, "All matched files use Prettier code style!", eslint sin errores.

npm run test
  → PASS, 19 archivos / 207 tests (payload.test.ts pasa de 28 a 34 tests,
    los 6 nuevos son los de resolveSenderConfig fail-closed).

npx vitest run supabase/functions/send-intercession-push
  → PASS, 34/34.

npx playwright test e2e/public-contract.spec.ts --project=chromium --workers=1
  → PASS, 4/4 (incluye la regresión nueva "desde la pantalla de persona,
    el plan público abre la lectura pública y no ofrece orar").

npx playwright test --project=chromium --workers=1
  → PASS, 7/7 (baseline 3 + public-contract 4), 1.5 min.

npm run verify
  → typecheck + lint + test verdes; db:test alcanzó 7/10 suites y luego la
    suite storage tropezó con LegacyStorageGatewayStatusError durante su
    `supabase db reset` — DEF-04 del plan RDY, intermitencia de este host,
    no del código. Se reejecutó suite por suite el resto:

    npm run db:test:storage → STORAGE ASSERTIONS PASSED
    npm run db:test:social  → SOCIAL ASSERTIONS PASSED
    npm run db:test:push    → PUSH ASSERTIONS PASSED

  → 10/10 suites SQL en verde (RLS, acquisition loop, daily loop, timezone,
    Bible, circles, plans, storage, social, push), igual que documenta el
    plan RDY para este host.
```

Sin migraciones en esta ola (ninguna era imprescindible). Sin cambios de copy,
así que la paridad es/en no se vio afectada.

### 5.2 Resultados del slice `share-loop` + `fresh-account` (comandos ejecutados, con salida real)

Dos specs nuevos que cierran la parte automatizable de RDY-08 (`share-loop`) y
de la cuenta fresca del RDY-00, siguiendo el patrón de `baseline` y
`public-contract`: contextos aislados, precondiciones SQL solo para preparar
datos (nunca para sustituir la acción), `expect.poll` para el efecto en la base
y limpieza por SQL sin service role.

- **`e2e/share-loop.spec.ts`.** A crea un enlace con clic real, B lo abre en un
  context anónimo (se comprueba con el CTA «Ya tengo cuenta», no con «Ver el
  plan»), se autentica desde el preview, el token se canjea al entrar y B pulsa
  «Oré por ti» dos veces. Por SQL se afirma **una** intercesión (idempotente) y
  **un** aviso, nunca dos; no se simula push físico (ni dispositivos ni outbox).
  La segunda pulsación es un doble toque (`clickCount: 2`) porque el botón se
  desmonta tras la primera entrega — límite documentado en la cabecera del spec.
  El seed trae una intercesión `zoe → prueba` que consume la dedupe key de
  `notifications` del día; se libera solo el aviso en `beforeAll` para que la
  aserción pruebe la acción de este test, no una fila sembrada.
- **`e2e/fresh-account.spec.ts`.** Alta por UI con email único local, puerta de
  términos («Acepto»), onboarding completo (nombre/género, temporada, tema,
  hora) y aterrizaje en Hoy. Limpieza por `delete from auth.users where email`,
  que arrastra perfil/ajustes en cascada, sin exponer el service role.
- **`e2e/helpers/sql.ts`.** Nuevo `runSqlScalar` (mismo `execFileSync` + `-t -A`
  que el healthcheck de `globalSetup.ts`) para leer un `count(*)` sin parsear la
  salida tabulada de psql.

```text
npm run typecheck
  → PASS, tsc --noEmit sin errores.

npm run lint
  → PASS, "All matched files use Prettier code style!", eslint sin errores.

npm run test
  → PASS, 19 archivos / 207 tests.

npx playwright test e2e/share-loop.spec.ts e2e/fresh-account.spec.ts --project=chromium --workers=1 --timeout=120000
  → PASS, 2/2 (fresh-account 33.7s, share-loop 1.6m).

npx playwright test --project=chromium --workers=1 --timeout=120000
  → PASS, 9/9 (baseline 3 + public-contract 4 + fresh-account 1 + share-loop 1), 9.5m.
```

**Límite de entorno (no del código).** Con el timeout por defecto (30 s) la
suite completa cae intermitente en `page.goto` porque el bundle dev de Metro
(~12,7 MB) tarda más que eso en servir en un context con caché fría, y un `db
reset` puede tropezar con el `LegacyStorageGatewayStatusError` de DEF-04 justo
en el reinicio de contenedores. Con `--timeout=120000` (flag de CLI, sin tocar
`playwright.config.ts`) la suite completa pasa en verde. Es la misma
intermitencia ya registrada en la sección 8, no un defecto de los specs nuevos.

## 6. Lo que queda para olas posteriores (no implementado)

Estas piezas están **explícitamente fuera de la Ola 1**. Se especifican aquí con
riesgo y dependencia para que ninguna ola futura las pise sin decidir antes el
orden y la propiedad.

| Pieza | Qué es (intención) | Dependencias | Riesgo principal / señal temprana |
|---|---|---|---|
| **Ledger/cuota/lease IA** | Contabilizar el uso del generador de planes (quién, cuánto, cuándo), imponer cuota por cuenta y arrendar/limitar llamadas concurrentes al proveedor IA para no quemar presupuesto en ráfagas | RDY-09 (eventos/denominadores) y la decisión de producto sobre el modelo de cuota (gratis/pago aún fuera de alcance) | Doble cobro o bloqueo falso: si el lease/cuota no es idempotente, una generación reintentada consume dos veces; señal = `generate-prayer-plan` con `402` inesperados o ledger desalineado con filas `prayer_plans` |
| **Flags server-side** | Feature flags persistidas y auditables (hoy solo hay kill switches por env del sender, `PUSH_SENDER_ENABLED`) para activar/desactivar superficies sin redeploy ni tocar código | Modelo de flags y política de quién las mueve; RDY-09 para medir su efecto | Flag mal leído en frío: si el cliente cachea un flag de seguridad y no reconsulta, una desactivación de emergencia no surte efecto; señal = feature "apagada" sigue visible |
| **pg_cron** | Jobs programados en Postgres (por ejemplo, reclamar/reintentar outbox push vencido, expirar leases, limpiar estado obsoleto) en vez de depender de invocaciones externas del sender | RDY-11 (sender + outbox con lease estable); decisión de qué job corre dónde (DB vs Edge vs CI) | Trabajo duplicado o solapado: si cron y el sender invocado manualmente corren a la vez sin el mismo lease `skip locked`, un outbox se entrega dos veces; señal = receipts duplicados |
| **Simetría de bloqueo** | Completar la semántica de bloqueo en las dos direcciones y en todas las superficies (hoy el bloqueo es unidireccional y ya excluye push/feed/orar; simetría = decidir y fijar qué ve cada lado en perfiles, círculos y avisos) | RDY-02/05/06 (para no romper contrato público, cola y crisis) | Fuga de identidad: un camino que no respete el bloqueo expone que te bloquearon o deja ver contenido; señal = pantalla que muestra a un bloqueado |
| **Revocación de grants** | Segunda pasada sobre los grants de la base para revocar cualquier permiso residual no cubierto por `20260819100000_restrict_profile_updates.sql` (B0) y `20260820100000_public_plan_contract.sql` (B2) | Auditoría de grants efectivos (`information_schema`) y RDY-01/02 como referencia; nunca tocar migraciones ya aplicadas (forward-fix) | Revocar de más rompe operación legítima (staff/administración); señal = `db:test:rls` rojo o RPC administrativa que deja de funcionar |

> **Flags server-side: primer slice implementado.** La fila de arriba ya no está
> entera en "pendiente": el modelo, la RPC y el flag `community_feed` están en
> marcha — ver **sección 9**. Sigue pendiente la medición de efecto (RDY-09) y
> cualquier rollout por cohortes, que siguen siendo ola futura.

> **Ledger/cuota/lease IA: primer slice implementado.** La fila de arriba ya
> tiene su primer slice en marcha — ver **sección 10**. Quedan para olas
> posteriores: pagos (ampliar la cuota gratis), `pg_cron` (limpieza de leases
> vencidos en segundo plano) y la decisión de producto sobre el modelo de cuota
> definitivo. La revocación de grants de `prayer_plans` sigue siendo su propia
> ola: este slice no toca los grants existentes.

**Regla para olas futuras:** cada pieza de arriba entra como su propia ola pequeña,
con su experimento/antes-después y su gate binario, en el mismo estilo de la Ola 1.
Ninguna se cuela en una ola ya aceptada sin decidir primero riesgo y dependencia.

## 7. Criterios UX/producto (guía de aceptación, no código)

- **Leer ≠ orar.** Un plan público se abre para leerlo; orar exige share explícito.
  Ninguna pantalla debe prometer orar por un plan que solo es público (razón del
  fix 3.2 y del texto corregido `share.publicOn` en una pasada previa).
- **Un enlace roto es un bug de producto, no solo de ruta.** Si una tarjeta promete
  abrir y aterriza en un «ya no tienes acceso», se corrige el destino, no el texto.
- **El botón de orar es una promesa.** Solo aparece donde el servidor lo va a
  aceptar; su ausencia es un estado correcto, no un fallo.
- **Fail-closed por defecto.** Un canal de entrega (push) apagado o mal configurado
  se comporta como apagado y dice un error seguro — nunca envía a medias ni
  filtra credenciales.
- **Paridad es/en:** cualquier copy nuevo se traduce en ambos idiomas en la misma
  ola; esta ola no cambió copy, así que no hubo nada que traducir.
- **La pantalla de persona muestra lo público y nada más.** Los planes listados son
  los `public` de esa persona; su perfil no es una puerta trasera a su Orar privado.

## 8. Comandos locales de referencia

```text
npm run web                                # arrancar la app web (nunca `npm run dev`)
npm run typecheck                          # tsc --noEmit
npm run lint                               # eslint + prettier
npm run test                               # Vitest (unidades puras, sin DB)
npm run verify                             # typecheck + lint + test + db:test (10 suites SQL)
npm run db:test                            # las 10 suites SQL con lock y reset por suite
npm run db:test:rls|flows|streak|timezone|bible|circles|plans|storage|social|push
npx playwright test --project=chromium --workers=1
npx vitest run supabase/functions/send-intercession-push
```

Nota de infraestructura (heredada del plan RDY, DEF-04): `supabase db reset` es
intermitente en este host y a veces devuelve `LegacyStorageGatewayStatusError`
después de haber aplicado esquema y seed. Ante eso, el patrón válido es repetir
suite por suite con reset real entre cada una, nunca reportar PASS agregado sin
haber visto las diez en verde.

## 9. Flags server-side — el registro (slice implementado)

Primer slice de la fila **Flags server-side** de la sección 6. Objetivo:
encender y apagar la superficie comunitaria **desde el servidor**, sin redeploy
y sin depender de que el cliente la oculte. El cliente no participa: la
seguridad vive en la base. Migración: `supabase/migrations/20260826100000_feature_flags.sql`.

**El registro es la tabla, no este documento.** `public.feature_flags` es la
fuente de verdad de qué flags existen, quién los posee (`owner`) y por qué
(`reason`). Esta sección describe el mecanismo y **no replica la lista de
flags**: si aquí y la tabla discrepan, manda la tabla.

- **`public.feature_flags`** — `key` (PK), `enabled`, `owner`, `reason`,
  `created_at`, `updated_at`. Solo la lee `service_role`; nada por la API.
- **`public.feature_flag_events`** — auditoría append-only: `flag_key`, `action`
  (`enable`/`disable`), `actor`, `reason`, `created_at`. Sin FK (un evento no
  desaparece cuando una cuenta se borra) y sin policies; la lee quien opera.
- **`public.flag_enabled(key)`** — lectura `security definer`, **fail-closed**:
  un flag desconocido o ausente lee `false`. Es la única puerta de lectura para
  el código del servidor (p. ej. `home_feed`).
- **`public.admin_set_flag(key, enabled, actor, reason)`** — escritura única:
  **solo `service_role`** (el mismo revoke/grant que `admin_set_staff`, sin
  comprobación interna); exige actor y motivo, y escribe el evento. Un flag no
  registrado no se puede crear por esta vía (falla cerrado). Append-only: ni
  `service_role` reescribe el pasado. Ni una cuenta staff lo mueve desde la app:
  el canal es administrativo (dashboard SQL o runner protegido), no la app.

**Flag inicial — `community_feed`:** controla la superficie comunitaria entera
— `home_feed`, `search_people`, `person_posts`, `person_plans` y el muro abierto
de `prayer_feed` (sin círculo). Nace **OFF** en instalaciones limpias/remotas;
el seed local (`supabase/seed.sql`) lo enciende a propósito para conservar y
probar el contrato B2 vigente. `supabase/tests/flags.sql` lo apaga y lo
enciende para probar ambas ramas. En remoto se abre desde el canal
administrativo (dashboard SQL o runner protegido, nunca la app):

```sql
select public.admin_set_flag('community_feed', true, 'ops-runner', 'abrir la comunidad');
```

**Enforcement:** cada entrada comprueba `flag_enabled('community_feed')` antes
de leer nada — OFF ⇒ conjunto vacío (no un filtrado parcial), ON ⇒ contrato B2
intacto. `prayer_feed(grupo)` queda fuera del flag: un círculo privado es una
superficie distinta de la comunidad pública y no se cierra con ella. No se
modificaron policies de SELECT ni `insert ... returning`.

**Refinamiento forward-only** en
`supabase/migrations/20260827100000_flag_admin_channel_and_coverage.sql`: cierra
el canal de `admin_set_flag` a `service_role` y extiende el enforcement a las
demás entradas comunitarias.

**Añadir un flag nuevo** es una migración forward-only que inserta su fila en
`feature_flags` (con `owner` y `reason`); el encendido/apagado ya es operación,
no código.

## 10. Ledger/cuota/lease IA — primer slice implementado

Primer slice de la fila **Ledger/cuota/lease IA** de la sección 6. Objetivo:
contabilizar el uso del generador con una reserva atómica que **no** se puede
resetear borrando o marcando planes, y arrendar las continuaciones para que dos
invocaciones no generen el mismo tramo. Migración:
`supabase/migrations/20260828100000_generation_ledger_quota_lease.sql`.

- **`public.generation_ledger`** — append-only. Una fila por **reserva**
  (`scope` `personal`/`circle`, consume cuota) y una por **resultado de tramo**
  (`scope` `continuation`, `completed`/`failed`, no consume cuota). El cliente
  la lee solo la suya propia; nadie la escribe por la API. Las reservas no se
  borran ni cambian de estado: la cuota es `count(*)` de reservas, permanente.
- **`public.plan_generation_leases`** — el lease server-side. Un plan tiene a lo
  sumo un lease vivo (`plan_id` PK). Solo lo mueven las RPC, nunca el cliente.
- **`public.reserve_generation(request_id, scope, duration, group_id, …)`** —
  reserva atómica por usuario (advisory lock por usuario) que además crea la
  fila de `prayer_plans` en la misma transacción. Idempotente por `request_id`.
  Valida `duration_days` en 3..30 y, para círculos, `can_create_circle_plan()`.
- **`public.claim_generation_chunk(plan_id, request_id, lease_seconds)`** —
  calcula el siguiente tramo **en el servidor** desde los días escritos (nunca
  del cliente) y lo arrienda. Dos reclamaciones del mismo plan se serializan:
  solo una gana, la otra lee `in_flight`. Idempotente por `request_id`
  (`already`). Un lease vencido se reclama.
- **`public.settle_generation_chunk(lease_id, outcome, error)`** — escribe el
  resultado en el ledger y suelta el lease. Un fallo del proveedor no deja el
  lease eterno; y si la invocación muere sin resolver, la expiración lo cubre.

**Decisiones de producto fijadas en este slice** (a decidir de nuevo cuando
lleguen los pagos): la cuota gratuita es **3 generaciones por usuario en total**
—personales y de círculo suman— y es **permanente**: borrar un plan o marcarlo
`failed` no devuelve el slot. Esto cambia el contrato previo "un plan de círculo
no gasta la cuota personal": ahora sí la gasta, que es lo que pedía la fila
"círculo sujeto a cuota". El generador escribe con el JWT del usuario (nunca
service_role) y conserva el modelo de escritura RLS: los grants de
`prayer_plans` no se tocan.

**Idempotencia.** El cliente manda un `request_id` (UUID) por acción lógica;
`reserve_generation` y `claim_generation_chunk` lo tratan como clave: reintentar
el mismo request devuelve lo ya reservado/reclamado sin consumir dos veces. El
recuento de reintentos del primer tramo ya no se fía del `attempt` del cliente:
se deriva del ledger (`count` de tramos `failed` con `from_day = 1`).

**Límite de concurrencia, dicho sin adornos.** La suite
`supabase/tests/generation.sql` corre sobre **una** conexión psql y no demuestra
que dos reservas paralelas no se salten el límite. Esa garantía la dan los
advisory locks de Postgres, y la ejercita de verdad el harness manual
`supabase/tests/generation-concurrency.sh` (N reservas en paralelo ⇒ solo 3
ganan). El harness no forma parte de `npm run verify` ni de `db:test`: es un
harness manual, no una afirmación de que una suite de una conexión prueba
carreras.

**Fuera de este slice (dependencias documentadas, no implementadas):** pagos
(el límite 3 es fijo, sin vía de ampliarlo), `pg_cron` (la limpieza de leases
vencidos es perezosa, la hace el propio claim al reclamar), flags nuevos,
simetría de bloqueo y scheduler de push. La revocación de grants de
`prayer_plans` sigue siendo su propia ola.
