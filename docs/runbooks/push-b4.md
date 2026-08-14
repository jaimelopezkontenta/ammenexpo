# Runbook — push B4 (RDY-10/RDY-11)

> Estado: **modelo de datos y lógica pura IMPLEMENTED/EVIDENCE-PASS local.
> Entrega real PENDING** — no hay dispositivo físico, cuenta de proveedor ni
> EAS en este entorno. Regla del plan §1 punto 7: un mock nunca cuenta como
> cierre de push.

## Lo que existe y está probado localmente

- `supabase/migrations/20260823100000_push_devices_outbox.sql`:
  - `push_devices` — un token por instalación (no por perfil). RLS: solo
    lectura de la fila propia; escribir pasa por `register_push_device()`,
    `revoke_push_device()`, `revoke_all_my_push_devices()`.
  - `push_outbox` — una fila por (intercesión, dispositivo), única de
    verdad: reintentar es la misma fila, nunca una nueva.
  - Trigger `enqueue_push_outbox()` — encola automáticamente al insertar en
    `intercessions`, una fila por dispositivo activo del dueño del plan.
  - `mark_push_delivery()` — el sender marca `sent`/`delivered`/`failed`;
    `DeviceNotRegistered` desactiva el dispositivo entero, no solo el intento.
  - `pending_push_outbox()` — lo que el sender lee; `service_role` únicamente.
  - Evidencia: `npm run db:test:push` — 10/10 suites SQL en verde incluyendo
    ésta (ver log del plan).
- `supabase/functions/send-intercession-push/`:
  - `payload.ts` — construcción del mensaje (nunca el texto de la
    intercesión ni de una oración), batching a 100, detección de
    `DeviceNotRegistered`. Probado con Vitest
    (`payload.test.ts`, 9 tests, verde).
  - `index.ts` — el sender: kill switch vía `PUSH_SENDER_ENABLED=false`
    (secret de la función, sin redeploy), lee `pending_push_outbox()`, llama
    a la API de Expo, resuelve cada ticket con `mark_push_delivery()`.
- `core/notifications/push.ts` — `usePushRegistration()` (permiso en
  contexto, `register_push_device` al concederse) y
  `revokeThisDevicePush()` (llamado desde `signOut()` en
  `core/auth/SessionProvider.tsx`, antes de cerrar la sesión). `expo-notifications`
  y `expo-device` instalados vía `npx expo install` — versión resuelta para
  SDK 56, la misma que el resto del proyecto. Web queda fuera a propósito
  (`Platform.OS === "web"`).
- `app.json` — plugin `expo-notifications` configurado (icono/color Android).

## Lo que NO se pudo verificar en este entorno, y por qué

- **Invocación HTTP local del Edge Function.** `supabase functions serve`
  arrancó y expuso `send-intercession-push`, pero la llamada devolvió
  `503 name resolution failed` al intentar resolver un host desde dentro del
  runtime de Deno en este Docker Desktop/Windows — parece una limitación de
  red del `functions serve` local en este host, no un defecto del código
  (la lógica pura ya está probada por separado con Vitest). Queda como
  **PENDING de investigación de entorno**, no como evidencia de que el
  sender esté roto.
- **Entrega real.** Sin un token de Expo de un dispositivo físico no hay
  nada que enviar de verdad. `ExponentPushToken[...]` en los tests SQL son
  literales de fixture, nunca tokens reales.
- **Receipts reales del proveedor.** `mark_push_delivery(id, 'permanent_failure',
  null, 'DeviceNotRegistered')` está probado con el string literal que la
  API de Expo usa — no con una respuesta real de su endpoint de receipts.
- **`eas.json` operable.** El archivo existe (SCAFFOLDED) pero no hay login
  de EAS en este entorno para generar un build real. `EAS_PROJECT_ID`
  (`.env.example`, leído por `app.config.js`) es el mecanismo documentado
  para cuando exista un proyecto EAS real — hoy está vacío a propósito, y
  eso **no** es un build acreditado, es la ausencia honesta de uno.

## Corrección del ciclo de verificación (2026-08-05, segunda pasada)

El primer cierre de B4 no distinguía errores permanentes de reintentables:
cualquier ticket de error de Expo —incluido un fallo de transporte del lote
entero— se escribía como `failed` y revocaba el dispositivo, exactamente
igual que un `DeviceNotRegistered` real. Tampoco comprobaba bloqueos en el
momento del envío, así que bloquear a alguien no impedía que su push
siguiera saliendo si ya estaba en la cola. Ver
`supabase/migrations/20260824100000_push_retry_lease_blocks.sql` y
`supabase/migrations/20260825100000_resolve_push_notification.sql`:

- `mark_push_delivery` distingue `sent` / `delivered` / `permanent_failure`
  (revoca el dispositivo) / `retryable_failure` (backoff exponencial, tope
  real de 8 intentos, nunca revoca por agotar reintentos).
- `claim_push_outbox_batch()` arrienda (`leased_until`) lo que reparte, con
  `for update skip locked` — dos invocaciones solapadas nunca reciben la
  misma fila.
- `enqueue_push_outbox()`, `pending_push_outbox()` y
  `claim_push_outbox_batch()` excluyen cualquier destino donde el dueño haya
  bloqueado a quien ora — ni se encola, ni se entrega, ni el sender puede
  arrendarlo.
- `resolve_push_notification()` — el cliente nunca navega a partir de lo que
  trae el payload de una notificación (que de por sí ya no lleva ni un
  `planId`, solo un `outboxId` opaco): pide primero esta RPC, que confirma
  dueño correcto y ausencia de bloqueo antes de decidir a dónde ir
  (`core/notifications/resolveTarget.ts`,
  `core/notifications/push.ts#useNotificationResponseHandler`).
- Evidencia: `npm run db:test:push` — 22 assertions originales + 20 nuevas
  de retry/lease/bloqueo/resolución de tap, todas en verde (ver log del
  plan). `npx vitest run core/notifications supabase/functions/send-intercession-push`
  — 25 tests en verde.

## Antes de Gate 3 (beta)

- [ ] Un build preview real (requiere `eas.json` operable + login EAS).
- [ ] Dos dispositivos físicos, dos cuentas, entrega real observada.
- [ ] `PUSH_SENDER_ENABLED` configurado y probado apagar/encender en caliente
      contra un proyecto Supabase remoto real.

## Antes de Gate 4 (público)

- [ ] Offline/retry, dedupe, tap→deep link, bloqueo — los ocho puntos del
      guion G de la sección 5 del plan, con dispositivos físicos Android e
      iOS.
- [ ] Runbook de proveedor (rotación de credenciales, límites de tasa,
      alertas de fallo) — no escrito todavía porque no hay proveedor más
      allá de la API pública de Expo.

## Comandos locales repetibles

```powershell
npm run db:test:push          # modelo de datos + RPC, 22 assertions
npm run test -- payload       # lógica pura del sender
```
