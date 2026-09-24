# Plan de implementación de readiness — agosto de 2026

> Convierte `docs/auditoria-ammen-2026-08.md` en trabajo ejecutable.
> Es un plan: en esta tarea no se ejecutaron `npm run verify`, Playwright, Maestro,
> pruebas de dispositivo, builds ni cambios de aplicación.

## 1. Objetivo, alcance, estado y regla de verdad

### Objetivo

Cerrar con evidencia reproducible los blockers B0–B5 y demostrar, como usuarios reales,
que el loop `share → canje → Orar → oración → aviso/push → retorno` funciona de forma
segura antes de ampliar el acceso.

### Alcance

- Seguridad de `profiles`, rol staff y cola de moderación.
- Contrato único entre planes públicos, Comunidad, shares y Orar.
- Auth real y equivalente entre local, staging y producción.
- Safety: hold, liberación/retirada, crisis, privacidad, auditoría y operación humana.
- CI, Playwright web, observabilidad, builds nativos y regresiones de derechos.
- Push de intercesión, por dispositivo, con receipts, dedupe, retry y deep link.
- Android en Windows con Maestro; iOS únicamente en macOS/EAS/TestFlight/dispositivo.
- Beta privada de confianza y canary previo a apertura pública.

### Fuera de alcance

- Features nuevas no necesarias para cerrar los recorridos y blockers.
- Pagos, suscripciones, pricing o promesas de monetización.
- Refactors amplios, cambios cosméticos y reescrituras de arquitectura.
- Recordatorios push genéricos: la primera entrega cubre solo intercesiones.
- Diagnóstico, triaje clínico o intervención automatizada ante una crisis.

### Estado actual de partida

- La auditoría estática mantiene el estado **REJECT / no aprobado para lanzamiento**.
- B0 es crítico y bloquea usuarios no confiables.
- B1a, B1b, B2, B3, B4 y B5 no tienen evidencia dinámica de cierre.
- `npm run verify` existe y encadena typecheck, lint, Vitest y nueve suites SQL.
- No existe todavía evidencia de CI, E2E UI, observabilidad, push o builds EAS.
- El host actual es Windows; Supabase local y Docker están disponibles.
- ADB y Maestro no están instalados; iOS no es ejecutable localmente en este host.
- El working tree contiene WIP ajeno a este plan: no se debe revertir ni mezclar.

### Hechos de entrada y anclas

- **B0:** `20260730100400_grants.sql` concede UPDATE de tabla sobre `profiles`;
  `20260730100000_core.sql` permite update de la fila propia, y
  `20260814100000_report_queue.sql` añadió después `is_staff`.
- **B1:** `20260813100100_content_hold.sql` retiene por `held_at`; no hay liberación
  visible y las frases de autolesión reciben el mismo hold sin protocolo específico.
- **B2:** `plans_shared_with_me()` y la policy public vigentes sugieren un alcance, pero
  el caso public sin `plan_shares` no fue ejecutado y debe seguir tratado como hipótesis.
- **B3:** `supabase/config.toml` local tiene mínimo 6 y confirmación desactivada;
  `core/auth/validation.ts` exige 8 y `app/(auth)/crear-cuenta.tsx` presupone confirmación.
- **B4:** existen `expo_push_token`, `push_sent_at` e índice pending/dedupe; no existen
  `expo-notifications`, sender ni procesamiento de receipts en el repositorio auditado.
- **B5:** hay nueve archivos de test TypeScript en HEAD y diez al incluir el WIP
  untracked `core/intercessions/progress.test.ts`; hay nueve suites SQL, pero no CI,
  E2E, observabilidad ni `eas.json` acreditados por la auditoría.

### Regla de verdad y cierre

1. **Nada se marca cerrado sin evidencia ejecutada** sobre el commit candidato.
2. Existencia de código, revisión estática, mocks o una captura aislada no equivalen a PASS.
3. Cada ticket exige criterios binarios completos y su matriz de pruebas aplicable.
4. Todo PASS registra commit SHA, entorno, build/release, UTC, actor y artefactos.
5. Un fallo abierto invalida el PASS; no se promedian blockers ni plataformas.
6. Un resultado remoto no se infiere desde local y un resultado iOS no se infiere desde Windows.
7. Los mocks de push sirven para desarrollo, pero **nunca cuentan como cierre de push**.
8. La evidencia no debe contener contraseñas, tokens, texto de oración ni crisis en claro.
9. El cierre lo aprueban responsable técnico y dueño operativo; safety requiere además especialista.
10. Si cambia código, migración, config auth, proveedor push o build, se reejecuta el gate afectado.

### Paquete mínimo de evidencia

- `execution-id` único y vínculo al ticket.
- SHA exacto y confirmación de working tree esperado.
- SO, navegador/dispositivo, versión app/build y entorno Supabase.
- Config efectiva relevante, redactada, y migraciones aplicadas.
- Comando exacto, exit code y log completo o enlace durable.
- Trace, screenshot y video solo donde corresponda y sin contenido sensible.
- Resultado esperado/observado y defectos vinculados.
- Aprobadores, hora UTC y decisión PASS/FAIL.

## 2. Decisiones de ejecución

1. **Congelación:** no features, pagos ni refactors hasta superar el gate público.
2. **Datos:** migraciones forward-only, aditivas cuando sea posible; nunca editar una migración aplicada.
3. **Corrección:** ante fallo desplegado, preferir nueva migración/forward-fix; rollback solo de artefacto compatible.
4. **Web primero:** Playwright contra Supabase local precede a la automatización nativa.
5. **Dos usuarios:** Playwright usa dos browser contexts aislados y cuentas distintas.
6. **Android:** Maestro se ejecuta en Windows sobre build preview/release y dispositivo/emulador con ADB.
7. **iOS:** se ejecuta en macOS o mediante EAS/TestFlight y dispositivo físico; Windows no acredita cobertura.
8. **Push:** la primera clase de evento es intercesión; no ampliar hasta probar entrega y privacidad.
9. **Safety:** mínimo operable antes de toda beta con participantes no plenamente confiables;
   ciclo y SLA completo antes de público.
10. **B2:** primero observar el comportamiento vigente; solo después aplicar la corrección acordada.
11. **Contrato B2 recomendado:** `public` es descubrible/abrible desde Comunidad; solo un share explícito entra en Orar.
12. **CI temprano:** incorporar `npm run verify` en paralelo organizativo con B0/B2, no al final del plan.
13. **Serialización:** ningún reset de DB corre a la vez que otro test SQL o E2E sobre la misma instancia.
14. **Selectores:** Playwright/Maestro priorizan rol y label; `testID` solo cuando la UI sea ambigua.
15. **Privacidad:** telemetría registra IDs técnicos, estados y duración, nunca contenido sensible.
16. **Nombramiento staff:** un operador autorizado usa SQL/procedimiento administrativo desde
    dashboard o runner protegido con DB admin/service role; registra actor, timestamp y motivo,
    nunca se expone al cliente y guarda credenciales fuera del repo en el secret manager aprobado.

## 3. Mapa de fases, dependencias y gates acumulativos

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

### Gate 0 — baseline reproducible

- Dos resets locales serializados completan sin intervención no documentada y dejan el mismo estado útil.
- `npm run web` abre la app; no se documenta ni usa `npm run dev`.
- Las dos cuentas seed hacen login y aterrizan en Hoy/Orar sin repetir términos ni onboarding.
- Una cuenta local fresca completa por separado aceptación legal y onboarding y llega a Hoy.
- Existe un resultado real registrado de `npm run verify`, aunque sea rojo al inicio.
- Todo fallo inicial queda clasificado; no se oculta para continuar.

### Gate 1 — seguridad y contrato

- RDY-01, RDY-02 y RDY-03 en PASS.
- B0 cerrado con pruebas negativas y administrativas positivas.
- El experimento B2 conserva evidencia antes/después y las tres superficies concuerdan.
- CI obligatorio informa `npm run verify` y serializa consumidores de la DB.

### Gate 2 — auth y safety mínima

- Gate 1 continúa verde.
- Auth de beta web pasa contra staging mediante SMTP/API/web, incluidos confirmación y recovery.
- Hold tiene dueño, cola y caminos de liberar/retirar auditados.
- Crisis no se publica normalmente, muestra recursos y tiene escalado humano definido.
- Este gate permite preparar beta web; no acredita builds nativos ni operación pública.

### Gate 3 — beta privada

- Gates 0–2 continúan verdes.
- Playwright del loop con dos contexts pasa contra Supabase local.
- CI y observabilidad mínima identifican release, errores y eventos sin contenido.
- Cohorte recomendada: **5–15 adultos conocidos**, invitación individual y canal de soporte.
- No se amplía si no hay capacidad diaria para revisar holds/reportes y revocar acceso.

### Gate 4 — lanzamiento público

- Gate 3 continúa verde sobre el candidate commit.
- Hold/crisis completos y SLA ensayado con especialista y responsables de guardia.
- Push real pasa con dos cuentas y dos dispositivos físicos, incluidos fallos y bloqueo.
- Maestro Android y un pase iOS real están verdes sobre builds identificables.
- Auth se repite en builds preview/release nativos una vez que F4 incorpora `eas.json`.
- Cero defectos críticos o altos abiertos; `verify` y E2E verdes en el mismo SHA.
- Forward-fix/rollback compatible fue ensayado y el canary no supera umbrales de parada.

## 4. Tickets ejecutables

### RDY-00 — Baseline reproducible y smoke local

- **Blocker:** B5 / fundamento de todos los gates.
- **Objetivo:** obtener una línea base repetible con ambos seeds y una cuenta fresca en Supabase local.
- **Archivos probables:** `README.md`, `package.json`, `supabase/config.toml`,
  `supabase/seed.sql`, `docs/runbooks/readiness-local.md`.
- **Dependencias:** ninguna; preservar WIP existente.
- **Intención de implementación:** documentar tres bloques independientes: reset repetible y
  login de seeds; alta fresca con legal/onboarding; captura del resultado real de `verify`.
  Usar `npm run web`, exclusión de DB y registrar fallos sin arreglos laterales.
- **Criterios binarios:** (a) dos resets consecutivos producen el mismo estado útil;
  (b) ambos seeds hacen login y aterrizan en Hoy/Orar sin repetir términos/onboarding;
  (c) una cuenta fresca acepta términos, completa onboarding y llega a Hoy;
  (d) el resultado real de `verify`, verde o rojo, queda registrado; (e) reset/E2E no se solapan.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| dos resets + smoke DB | suite existente | pendiente F3 | — | seeds + cuenta fresca web | — |

- **Evidencia:** comandos/logs, SHA, versión Docker/Supabase/Node, capturas de ambas sesiones y defectos.
- **Rollback/forward-fix:** revertir solo documentación/script nuevo incompatible; corregir setup hacia delante.

### RDY-01 — B0: impedir autoescalada y mutación de racha

- **Blocker:** B0 crítico.
- **Objetivo:** limitar `profiles` a columnas editables por cliente sin romper administración legítima.
- **Archivos probables:** nueva `supabase/migrations/<timestamp>_restrict_profile_updates.sql`,
  `supabase/tests/rls.sql`, `supabase/tests/social.sql`, `core/moderation/queue.ts`.
- **Dependencias:** RDY-00.
- **Intención de implementación:** migración aditiva que revoque UPDATE de tabla y conceda UPDATE
  por columnas permitidas; definir nombramiento staff mediante una operación privilegiada
  controlada, nunca cliente, que audite actor, timestamp y motivo sin secretos en el repo.
- **Criterios binarios:** usuario normal no cambia `is_staff`, `streak_count` ni
  `streak_last_day`; sí cambia `display_name`/`avatar_url`; no lee ni resuelve cola;
  staff nombrado administrativamente sí lee y resuelve; extraño/anon permanecen cerrados.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| obligatorio: negativos/positivo staff | si cambia helper | rol staff visible F3 | — | API con JWT normal/admin | — |

- **Evidencia:** assertions SQL, errores esperados de API, grants efectivos antes/después y
  registro de actor/timestamp/motivo de la operación administrativa.
- **Rollback/forward-fix:** no restaurar UPDATE de tabla; nueva migración para ajustar columnas o revocar más.

### RDY-02 — B2: experimento dirigido y contrato public/Orar

- **Blocker:** B2 alto, hipótesis aún no ejecutada.
- **Objetivo:** observar primero y fijar después una semántica única.
- **Archivos probables:** `supabase/tests/plans.sql`, `supabase/tests/flows.sql`, nueva migración,
  `core/plans/queries.ts`, `app/comunidad.tsx`, `app/(tabs)/orar.tsx`, `app/orar/[planId].tsx`.
- **Dependencias:** RDY-00; experimento previo a cualquier corrección.
- **Intención de implementación:** crear A dueño y B extraño, plan public activo sin
  `plan_shares`; registrar RPC, Orar, detalle y Comunidad; luego implementar el contrato recomendado.
- **Criterios binarios:** evidencia “antes” existe; después, Comunidad descubre/abre public;
  `plans_shared_with_me()` y Orar lo excluyen sin share; `/orar/[planId]` lo rechaza sin share;
  al compartir explícitamente, las tres superficies de oración lo aceptan.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| obligatorio antes/después | queries si aplica | Comunidad/Orar/detalle | después F4 | experimento dirigido | — |

- **Evidencia:** tabla de resultados observados antes de corregir, SQL, trace y decisión de producto firmada.
- **Rollback/forward-fix:** nueva migración/policy; no reinterpretar silenciosamente datos o shares existentes.

### RDY-03 — CI mínimo obligatorio y exclusión de DB

- **Blocker:** B5 alto.
- **Objetivo:** hacer `npm run verify` una señal obligatoria, temprana y reproducible.
- **Archivos probables:** `.github/workflows/verify.yml`, scripts de lock/orquestación,
  `package.json`, documentación de branch protection.
- **Dependencias:** RDY-00; trabajo paralelo organizativamente a RDY-01/RDY-02.
- **Intención de implementación:** workflow en `ubuntu-latest` o runner Linux equivalente
  con Docker/Supabase, versiones fijadas, cache segura y exclusión mutua de reset DB;
  publicar logs de fallo y proteger rama/candidate commit.
- **Criterios binarios:** PR no puede integrar con `verify` rojo/ausente; el job ejecuta el script
  real sin saltar suites; resets SQL y E2E compartidos se serializan; rerun limpio es determinista.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| nueve suites vía verify | obligatorio | job separado F3 | F4 | revisar protección | — |

- **Evidencia:** URL de dos runs, uno rojo controlado y uno verde, logs completos y regla de protección.
- **Rollback/forward-fix:** desactivar solo job defectuoso con incidente aprobado; corregir workflow sin omitir gate.

### RDY-04 — B3: paridad auth local/staging/prod

- **Blocker:** B3 alto.
- **Objetivo:** una política explícita y probada de contraseña, confirmación, recovery y redirects web.
- **Archivos probables:** `supabase/config.toml`, `core/auth/validation.ts`,
  `app/(auth)/crear-cuenta.tsx`, `app/(auth)/recuperar.tsx`, `app/(auth)/nueva-contrasena.tsx`,
  configuración Supabase remota y redirects EAS.
- **Dependencias:** Gate 1; SMTP y dominio/redirect web de staging disponibles.
- **Intención de implementación:** inventariar config efectiva redactada, decidir confirmación,
  alinear mínimo servidor/cliente y probar correo/links reales mediante API y web en staging;
  dejar la repetición en builds preview/release nativos para F4, después de crear `eas.json`.
- **Criterios binarios:** clave de 6 es rechazada por servidor; clave de 8 válida completa el alta;
  confirmación se comporta igual que la decisión registrada; login, recovery, expiración y redirects pasan.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| config/RPC si aplica | validación 6/8 | alta/login/recovery web | F4 | correo real staging | — hasta F4 |

- **Evidencia:** fingerprints local/staging/prod, headers redactados, correo/links y trace web de staging.
- **Rollback/forward-fix:** restaurar config conocida solo si compatible; preferir ajuste coordinado cliente/servidor.

### RDY-05 — B1a: ciclo held → cola → liberar/retirar

- **Blocker:** B1a alto.
- **Objetivo:** impedir retenciones indefinidas y registrar cada decisión humana.
- **Archivos probables:** nueva migración de cola/auditoría, `20260813100100_content_hold.sql`
  como referencia, `core/moderation/queue.ts`, `app/moderacion.tsx`, `translation/es.json`,
  `translation/en.json`, runbook de moderación.
- **Dependencias:** RDY-01 y responsable operativo nombrado.
- **Intención de implementación:** modelar estados y RPCs estrechas para encolar automáticamente,
  reclamar/revisar, liberar o retirar con motivo, actor y tiempos; evitar editar migraciones previas.
- **Criterios binarios:** falso positivo retenido aparece al staff y no a terceros; liberar lo hace visible;
  abusivo retirado sigue oculto; autor recibe estado apropiado; toda transición es inmutable/auditable.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| RLS + estados + auditoría | state mapping | autor/staff/extraño | F4 smoke | revisión con reloj SLA | — |

- **Evidencia:** filas auditadas redactadas, traces de ambos caminos, tiempos y firma del moderador.
- **Rollback/forward-fix:** detener nuevas publicaciones si falla; nueva migración para reparar estados, nunca borrar auditoría.

### RDY-06 — B1b: recursos y protocolo de crisis ES/EN

- **Blocker:** B1b crítico.
- **Objetivo:** respuesta inmediata, privada y humana sin diagnóstico automatizado.
- **Archivos probables:** clasificador/migración safety nueva, pantallas de posts/comentarios,
  `translation/es.json`, `translation/en.json`, `docs/runbooks/crisis-es-en.md`, documentos legales.
- **Dependencias:** RDY-05; especialista, países/edades y responsable de guardia definidos.
- **Intención de implementación:** separar crisis de moderación común, impedir publicación normal,
  mostrar recursos localizados/fallback y definir escalado, minimización, acceso, conservación y SLA.
- **Criterios binarios beta:** ES/EN no se publican, recursos inmediatos funcionan, privacidad y dueño están definidos.
- **Criterios binarios público:** especialista aprueba textos/protocolo; simulacro cumple SLA, trazabilidad y fallback.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| privacidad/estado/escalado | clasificación/presentación | ES/EN sin contenido en artefacto | F4 | simulacro humano | revisión real UI |

- **Evidencia:** aprobación especialista, checklist del simulacro sin frase real, tiempos, accesos y recursos verificados.
- **Rollback/forward-fix:** deshabilitar publicación afectada y mostrar recursos estáticos seguros; corregir hacia delante.

### RDY-07 — Harness Playwright web con dos contexts

- **Blocker:** B5 alto.
- **Objetivo:** automatización web aislada sobre Supabase local con artefactos diagnósticos.
- **Archivos probables:** `playwright.config.ts`, `e2e/fixtures/`, `e2e/helpers/`,
  scripts en `package.json`, workflow CI.
- **Dependencias:** Gate 2 y contrato de exclusión DB de RDY-03.
- **Intención de implementación:** levantar `npm run web`, reservar DB, preparar datos por API/SQL
  controlado, usar dos contexts y limpiar por ejecución; selectores por rol/label y `testID` excepcional.
- **Criterios binarios:** A/B no comparten storage; una corrida repetida pasa desde reset;
  fallo intencional adjunta trace, screenshot y video; secretos/contenido sensible quedan redactados.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| fixture/reset exclusivo | helpers si aplica | obligatorio Chromium | — | inspección artefactos | — |

- **Evidencia:** comando, config, dos runs consecutivos, artefacto de fallo controlado y tiempos.
- **Rollback/forward-fix:** desactivar test solo con issue/owner; corregir fixture, no añadir sleeps arbitrarios.

### RDY-08 — Journeys críticos web y regresiones de derechos

- **Blocker:** B5 y regresión de B0–B3.
- **Objetivo:** automatizar los recorridos A, C, E, F y H definidos en la sección 5.
- **Archivos probables:** `e2e/share-loop.spec.ts`, `e2e/moderation.spec.ts`,
  `e2e/auth.spec.ts`, `e2e/public-contract.spec.ts`, `e2e/privacy-rights.spec.ts`.
- **Dependencias:** RDY-07 y tickets funcionales correspondientes.
- **Intención de implementación:** cubrir happy path y denegaciones mediante UI real; usar API solo
  para precondiciones explícitas, nunca para reemplazar la acción que se afirma probar.
- **Criterios binarios:** loop produce una sola intercesión/aviso interno; holds recorren ambos finales;
  auth respeta política; public no entra en Orar sin share; export/borrado/revocación no filtran datos.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| invariantes post-journey | lógica crítica | obligatorio dos contexts | F4 subset | revisión semántica | — |

- **Evidencia:** reporte HTML, traces solo de fallos, IDs técnicos de filas y captura de conteos deduplicados.
- **Rollback/forward-fix:** bloquear merge del área rota; reparar producto/test hacia delante sin relajar aserciones.

### RDY-09 — Observabilidad mínima, release y funnel privado

- **Blocker:** B5 y parte medible de B4.
- **Objetivo:** detectar fallos y medir el funnel sin registrar contenido sensible.
- **Archivos probables:** `app/_layout.tsx`, módulo nuevo `core/observability/`, config de build,
  workflow de sourcemaps, runbook de alertas y dashboard.
- **Dependencias:** RDY-03; proveedor y política de conservación aprobados.
- **Intención de implementación:** etiquetar release/build/entorno, subir sourcemaps, capturar errores
  y eventos `preview`, `signup`, `redeem`, `intercession`, `push_*`, `open` con IDs opacos.
- **Criterios binarios:** error controlado simboliza al release correcto; eventos tienen denominadores;
  payload auditado no contiene oración, crisis, email, nombre ni token; alertas tienen dueño.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| conteos reconciliados | redacción/schema | eventos por journey | F4 | alerta controlada | build release |

- **Evidencia:** evento/error redactado, sourcemap resuelto, consulta de funnel y prueba de alerta.
- **Rollback/forward-fix:** kill switch de telemetría; conservar operación segura y corregir schema hacia delante.

### RDY-10 — Tokens push por dispositivo y ciclo de vida

- **Blocker:** B4 alto.
- **Objetivo:** registrar cada instalación sin token global de perfil y revocar al salir/bloquear.
- **Archivos probables:** `app.json`, `package.json`, `eas.json`, nueva migración de dispositivos,
  `core/notifications/push.ts`, `app/_layout.tsx`, settings/permisos.
- **Dependencias:** Gate 3, credenciales de push segregadas y política de privacidad.
- **Intención de implementación:** pedir permiso en contexto, upsert por instalación/usuario,
  rotar token, registrar último uso, revocar en logout y excluir bloqueos/cuentas eliminadas.
- **Criterios binarios:** permitido registra un token por dispositivo; denegado funciona sin presión;
  dos dispositivos coexisten; logout/token expirado se desactiva; cambio de cuenta no hereda token.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| RLS/rotación/revocación | state machine | fallback web | Android/iOS F4 | permiso allow/deny | obligatorio físico |

- **Evidencia:** filas redactadas, pantallas de permisos, logout/cambio de cuenta y IDs de dispositivos de prueba.
- **Rollback/forward-fix:** deshabilitar registro/envío; revocar tokens afectados mediante operación auditada.

### RDY-11 — Push real de intercesión, receipts, dedupe y deep link

- **Blocker:** B4 alto.
- **Objetivo:** cerrar el loop externo con entrega única y navegación segura.
- **Archivos probables:** sender/Edge Function/worker nuevo, migración de outbox/receipts,
  `core/notifications/`, `app/avisos.tsx`, linking config, runbook de proveedor.
- **Dependencias:** RDY-09 y RDY-10.
- **Intención de implementación:** outbox idempotente por intercesión/destino, retry con backoff,
  receipts y baja de tokens inválidos; deep link resuelve autorización al abrir, no confía en payload.
- **Criterios binarios:** A recibe una entrega por oración idempotente; offline reintenta sin duplicar;
  receipt inválido desactiva token; tap abre contexto autorizado; bloqueo evita envío y exposición.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| outbox/dedupe/bloqueo | retry/receipt/parser | aviso interno/deep link web | obligatorio | proveedor/receipts | dos físicos reales |

- **Evidencia:** IDs de receipt redactados, timestamps, vídeo del tap, conteo único y prueba de bloqueo.
- **Rollback/forward-fix:** kill switch del sender; no borrar outbox, marcar estado y reparar con migración/job seguro.

### RDY-12 — Maestro Android sobre preview/release

- **Blocker:** B5 y cierre Android de B4.
- **Objetivo:** validar recorridos nativos y permisos en Android desde Windows.
- **Archivos probables:** `eas.json`, `maestro/android/*.yaml`, scripts de build/test,
  labels o `testID` puntuales en pantallas ambiguas, runbook Android.
- **Dependencias:** RDY-11; instalar/verificar ADB y Maestro, hoy ausentes.
- **Intención de implementación:** generar build preview/release identificable, instalarlo y ejecutar
  auth, share/deep link, Orar, push allow/deny, logout y dead link sin depender de Expo Go.
- **Criterios binarios:** flujo pasa dos veces en build limpio; permiso permitido/denegado pasa;
  background/offline/deep link pasa; fallo guarda artefactos y build ID.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| invariantes backend | — | gate previo | obligatorio Android | revisión accesibilidad | físico obligatorio push |

- **Evidencia:** versión ADB/Maestro, build hash, reporte, vídeo/capturas y modelo/OS del dispositivo.
- **Rollback/forward-fix:** retirar build preview/canary; corregir artefacto y repetir toda la matriz afectada.

### RDY-13 — Pase iOS real, canary y candidato público

- **Blocker:** B5, cierre iOS de B4 y gate público.
- **Objetivo:** acreditar iOS realmente y abrir de forma gradual con parada observable.
- **Archivos probables:** `eas.json`, config iOS/APNs, perfiles Maestro reutilizables,
  runbook TestFlight/canary, dashboards y checklist de release.
- **Dependencias:** RDY-06 completo, RDY-09, RDY-11 y RDY-12.
- **Intención de implementación:** ejecutar en Mac o EAS/TestFlight/dispositivo físico el subset crítico;
  fijar candidate SHA, cohortes, umbrales de error/safety/push y autoridad de stop.
- **Criterios binarios:** iOS físico pasa auth, link, share/oración, push y bloqueo; candidate SHA tiene
  `verify` + E2E verdes; canary no supera umbrales; forward-fix/rollback compatible fue ensayado.

| SQL | Vitest | Playwright | Maestro | Manual | Dispositivo |
|---|---|---|---|---|---|
| gate candidate | gate candidate | gate candidate | iOS en Mac si viable | TestFlight/canary | iPhone físico obligatorio |

- **Evidencia:** build/TestFlight ID, equipo macOS/EAS, dispositivo/OS, artefactos, dashboard y decisión go/no-go.
- **Rollback/forward-fix:** pausar rollout, deshabilitar sender/feature afectada y publicar build/migración compatible.

## 5. Guiones de usuario reales

### Preparación común local

1. Ejecutar las tareas de Supabase y E2E de forma exclusiva, nunca en paralelo sobre la misma DB.
2. Arrancar la web con `npm run web`; **no usar `npm run dev`**, que no existe.
3. Para smoke local únicamente pueden usarse los seeds:
   `prueba@ammen.local / ammen1234` y `zoe@ammen.local / ammen1234`.
4. Esas contraseñas pertenecen solo al entorno local/seed: **jamás reutilizarlas en staging o producción**.
5. En remoto, crear cuentas desechables únicas y guardar credenciales en el secreto aprobado, no en artefactos.

### A. Share → preview → canje → Orar → oración → aviso

1. Cuenta A crea/elige un plan activo y genera un share explícito.
2. En contexto anónimo limpio, B abre el preview y observa dueño, estado y CTA sin datos privados.
3. B elige login o alta; tras auth, el token pendiente se canjea una sola vez.
4. B abre Orar y encuentra exactamente el plan compartido.
5. B abre el día actual y pulsa «Oré por ti» dos veces o reintenta tras pérdida de red.
6. Observar: una sola intercesión, sin oración/interpretación privada del dueño.
7. A abre avisos y ve una sola notificación y la identidad permitida de quien oró.
8. En F4, A recibe un único push y el tap abre el contexto autorizado.

### B. Intento de `is_staff=true` y moderación legítima

1. Con JWT de usuario normal, enviar por API update de `is_staff=true` sobre su perfil.
2. Intentar también cambiar `streak_count` y `streak_last_day`.
3. Intentar leer `report_queue()` y resolver un reporte conocido.
4. Observar: mutaciones privilegiadas denegadas y cero contenido de cola expuesto.
5. Cambiar solo `display_name` para demostrar que la edición legítima continúa.
6. Nombrar otra cuenta staff por el canal administrativo auditado.
7. Esa cuenta abre Moderación, ve el caso y lo resuelve.
8. Observar: actor, motivo y timestamps completos; el usuario normal sigue sin acceso.

### C. Falso positivo y contenido abusivo

1. A publica un texto benigno del corpus que activa hold sin ser dañino.
2. B intenta verlo; A revisa su propio estado.
3. Observar: B no lo ve, A ve «en revisión» y staff lo recibe automáticamente.
4. Staff reclama el caso, registra motivo y libera.
5. Observar: B ya lo ve y la auditoría conserva hold, revisión y liberación.
6. Repetir con texto sintético abusivo no dirigido a una persona real.
7. Staff retira; observar que terceros no lo ven y el autor recibe estado apropiado.
8. Comparar ambos tiempos con el SLA, sin incluir textos completos en evidencia.

### D. Frase de crisis

1. Usar una frase sintética aprobada por el especialista, en ES, desde A.
2. Observar: no aparece como publicación normal y muestra recursos inmediatos adecuados.
3. Verificar salida segura, privacidad, accesibilidad y fallback si un recurso no carga.
4. Repetir en EN y en el país/edad objetivo definidos.
5. Ejecutar el escalado humano del simulacro y medir acknowledgment/resolución.
6. Observar: acceso mínimo, trazabilidad y conservación según protocolo.
7. Confirmar que ningún mensaje diagnostica ni promete intervención automática.
8. Confirmar que logs, screenshots y eventos no contienen la frase.

### E. Auth real

1. En staging configurado, intentar alta por API con clave de 6 caracteres.
2. Observar rechazo del servidor, no solo del formulario.
3. Crear cuenta desechable con clave de 8 o más y completar la confirmación elegida.
4. Cerrar sesión y entrar de nuevo en web contra staging.
5. Solicitar recovery, abrir correo real y probar el redirect web correcto.
6. Cambiar contraseña y confirmar que el link no se puede reutilizar.
7. Probar link expirado y sesión ya existente.
8. Observar equivalencia con la política registrada local/staging/prod para API/web.
9. En F4, repetir alta/login/recovery y redirects sobre builds preview/release nativos
   identificados; ese resultado pertenece al gate móvil/público, no al gate beta web.

### F. Experimento dirigido public/Orar

1. A crea un plan `public` activo y no crea ninguna fila `plan_shares` para B.
2. Antes de corregir, B consulta RPC, tab Orar, `/orar/[planId]` y Comunidad por separado.
3. Registrar exactamente qué ocurre, sin presentar la hipótesis como bug ya probado.
4. Aplicar el contrato aprobado y repetir desde reset.
5. Observar: Comunidad descubre/abre; RPC/Orar/detalle de oración excluyen sin share.
6. A comparte explícitamente con B y B canjea.
7. Observar: RPC, Orar y `/orar/[planId]` incluyen/abren de forma consistente.

### G. Push real y condiciones adversas

1. Instalar builds identificados en dos dispositivos físicos con cuentas A y B.
2. En A conceder permiso; en una segunda instalación denegarlo y observar uso normal.
3. B ora por A; observar una sola entrega en A y receipt del proveedor.
4. Poner A offline, repetir con nueva intercesión válida y recuperar red.
5. Observar retry sin duplicado; el tap abre el aviso/contexto autorizado.
6. Simular token expirado con mecanismo de prueba del proveedor; observar desactivación.
7. Cerrar sesión/cambiar cuenta; observar que el token no cruza identidades.
8. A bloquea B; una nueva acción no debe exponer identidad/contenido ni enviar push prohibido.
9. Repetir Android e iOS; mocks o simuladores solos no cierran este guion.

### H. Exportación, borrado y links muertos

1. A solicita exportación; comprobar que contiene sus datos permitidos y no datos privados de B.
2. A revoca un share; B abre el link previo y la ruta autenticada.
3. Observar estado revocado/muerto distinto de error de red y ausencia en Orar.
4. Crear otro link y probar expiración controlada.
5. A solicita borrado y completa la confirmación.
6. Observar cierre de sesión, revocación de tokens push y denegación de links/contextos previos.
7. B conserva solo datos legal/productivamente previstos, sin contenido privado huérfano.
8. Registrar conteos/IDs opacos, nunca el contenido exportado completo.

## 6. Matriz de plataformas y entornos

| Entorno | Backend | Cliente/build | Pruebas obligatorias | Acredita | Limitación |
|---|---|---|---|---|---|
| Windows local | Supabase local/Docker | `npm run web` | SQL, Vitest, Playwright, smoke A/B | Gate 0–3 web | no acredita iOS ni push real |
| CI | Supabase efímero aislado | web/headless | `npm run verify`, Playwright | reproducibilidad por SHA | serializar reset/E2E |
| Windows Android | local o staging | preview/release, no Expo Go | Maestro + manual | Android nativo | instalar ADB/Maestro primero |
| Android físico | staging/canary | preview/release firmado | permisos, offline, push, deep link | push Android real | emulador solo no cierra push |
| macOS/iOS | staging/canary | EAS/TestFlight/release | Maestro si viable + manual | navegación iOS | requiere Mac/EAS |
| iPhone físico | staging/canary | TestFlight/release | push, tap, bloqueo, auth | cierre iOS real | obligatorio para Gate 4 |
| Staging remoto | proyecto separado | release candidate | auth/SMTP, push, safety drill | paridad operativa | config debe capturarse redactada |
| Producción canary | producción | candidate SHA | smoke no destructivo + métricas | decisión pública | cohorte y stop authority |

### Reglas de cuentas y datos

- Seeds conocidos solo en local; nunca copiar sus contraseñas a remoto.
- Staging usa cuentas desechables identificables y limpieza aprobada.
- Crisis/moderación usan corpus sintético revisado, no historias de personas reales.
- Producción canary no ejecuta mutaciones destructivas ni frases de crisis de prueba.
- Logs y vídeos aplican redacción antes de compartirse o conservarse.

## 7. Checklists go/no-go

### Beta privada de confianza

- [ ] Gate 0 reproducible y evidencia aprobada.
- [ ] B0 cerrado: usuario normal no eleva staff/racha ni accede/resuelve cola.
- [ ] B2 observado antes de corregir y contrato recomendado fijado/testeado.
- [ ] Auth real de beta web en staging: 6 rechazada por API/servidor; 8 válida y
      confirmación/login/recovery SMTP/web verdes.
- [ ] Safety mínima: no publicación de crisis, recursos ES/EN, dueño y fallback.
- [ ] Hold entra en cola y puede liberarse/retirarse con auditoría.
- [ ] CI obligatorio verde en candidate SHA con DB serializada.
- [ ] Playwright de dos contexts completa el loop y regresiones críticas.
- [ ] Observabilidad simboliza release y no captura contenido sensible.
- [ ] Cero críticos abiertos; altos solo si no afectan gate y tienen aceptación explícita.
- [ ] Cohorte limitada a 5–15 adultos conocidos, consentimiento y soporte directo.
- [ ] Capacidad diaria de moderación/revocación y autoridad de stop confirmadas.
- [ ] Exportación, borrado y links revocados pasan regresión web.
- [ ] Plan de incidente/forward-fix probado en staging.

**NO-GO beta:** cualquier ítem sin evidencia, B0 no cerrado, safety sin responsable,
auth remoto desconocido, CI/E2E rojo o telemetría que filtre contenido.

### Lanzamiento público

- [ ] Todos los ítems de beta siguen verdes en el candidate commit.
- [ ] Hold→cola→liberar/retirar opera dentro del SLA ensayado.
- [ ] Protocolo crisis ES/EN revisado por especialista y simulacro humano aprobado.
- [ ] Países, edades, privacidad, conservación y horarios de guardia están decididos.
- [ ] Push de intercesión pasa con dos cuentas y dos dispositivos físicos.
- [ ] Permiso denegado, token expirado, offline/retry, dedupe, tap y bloqueo pasan.
- [ ] Maestro Android verde sobre preview/release identificado.
- [ ] iOS real verde en Mac/EAS/TestFlight y iPhone físico; no inferido desde Windows.
- [ ] Auth y redirects repetidos en builds preview/release nativos creados en F4.
- [ ] `npm run verify` y E2E están verdes sobre el mismo SHA candidato.
- [ ] Cero defectos críticos o altos abiertos.
- [ ] Release/sourcemaps, alertas y funnel tienen dueño y denominadores.
- [ ] Canary permanece bajo umbrales de error, safety y push definidos.
- [ ] Rollback de artefacto y forward-fix de DB fueron ensayados de forma compatible.
- [ ] Stores/legal/privacy revisados para el alcance real, todavía sin pagos.

**NO-GO público:** falta de pase físico en cualquier plataforma, mocks usados como
evidencia push, SLA no ensayado, críticos/altos abiertos, candidate SHA divergente o canary degradado.

## 8. Riesgos, decisiones del consejo y estimaciones

### Riesgos y mitigaciones

| Riesgo | Señal temprana | Mitigación / stop |
|---|---|---|
| Grant residual permite privilegios | test negativo cambia filas o devuelve cola | cerrar acceso, auditar grants, forward-fix |
| Corrección B2 rompe shares existentes | discrepancia SQL/UI o caída de canje | snapshot lógico, migración compatible, parar rollout |
| Resets generan flakiness | puertos/filas cambian entre runs | lock exclusivo, instancia por job, IDs de ejecución |
| Auth remoto diverge | 6 aceptada o redirect incorrecto | bloquear beta, alinear dashboard/config/build |
| Hold supera capacidad humana | edad de cola/SLA crece | reducir cohorte o cerrar publicación |
| Crisis expone datos o promete ayuda | payload/log/texto incorrecto | kill switch, recursos seguros, incidente de privacidad |
| Telemetría captura contenido | auditoría de payload falla | desactivar SDK/evento y purgar según política |
| Push duplica o cruza cuentas | receipts repetidos/token heredado | parar sender, revocar tokens, reconciliar outbox |
| Deep link revela contexto bloqueado | ruta abre tras bloqueo/revocación | autorización server-side al abrir, retirar build |
| Cobertura nativa aparente | solo emulador/mock/Windows para iOS | no cerrar gate sin dispositivo y build IDs |
| WIP se mezcla con readiness | diff contiene cambios ajenos | rama/PR enfocado, inventario previo, no revertir WIP |
| Canary daña usuarios | errores/safety superan umbral | autoridad de stop y rollout pausado inmediatamente |

### Decisiones del consejo

- **Qwen:** SQL→web→nativo; beta cerrada sí tras compuertas, sin pagos; daba más peso temprano a push.
- **DeepSeek:** B0 primero y safety prioritaria; sospecha `public`→Orar, pero exige experimento antes de corregir.
- **Gemini:** no producción; empujaba push/compliance temprano, sin aceptar su estimación temporal como promesa.
- **Sol:** beta instrumentada; B0, contrato, auth, safety, CI/E2E y luego push antes de abrir.
- **Grok:** congelar features/refactors y probar el loop; favorece reducir frontend antes que expandir alcance.
- **Kimi:** operación primero; no da por roto `public` y exige evidencia de auth/safety/push/CI.
- **Desacuerdo resuelto:** smoke manual continúa desde F0; CI/Playwright preceden a push; safety mínima
  bloquea beta, safety completa bloquea público; el orden rector queda **SQL → web → nativo**.

### Estimaciones por rango

> Son rangos de esfuerzo de ingeniería/operación, no fechas ni compromisos. Se recalibran
> después de cada gate; no incluyen esperas de tiendas, proveedor, especialista o revisión legal.

| Ticket | Esfuerzo orientativo | Incertidumbre dominante |
|---|---:|---|
| RDY-00 baseline | 0.5–1.5 persona-días | setup y WIP local |
| RDY-01 B0 | 1–3 persona-días | grants/RPC administrativos |
| RDY-02 B2 | 1–3 persona-días | resultado real del experimento |
| RDY-03 CI | 1–3 persona-días | Docker/serialización en runner |
| RDY-04 auth | 2–5 persona-días | SMTP/config remota/redirects |
| RDY-05 hold | 4–8 persona-días | modelo auditado y UI staff |
| RDY-06 crisis | 3–8 persona-días técnicos | revisión especialista/países aparte |
| RDY-07 harness | 2–5 persona-días | estabilidad Expo web/fixtures |
| RDY-08 journeys | 3–7 persona-días | estados multiusuario y derechos |
| RDY-09 observabilidad | 2–5 persona-días | proveedor/redacción/dashboard |
| RDY-10 tokens | 3–6 persona-días | modelo por dispositivo/permisos |
| RDY-11 sender push | 5–10 persona-días | receipts, retry, privacidad |
| RDY-12 Android | 2–5 persona-días | instalación tooling/build nativo |
| RDY-13 iOS/canary | 3–7 persona-días | Mac/EAS/APNs/TestFlight |

No sumar mecánicamente los rangos: hay trabajo paralelo, esperas externas y retrabajo condicionado
por gates. Ninguna estimación autoriza omitir evidencia o abrir por calendario.

## 9. Log de ejecución

**Estado:** en progreso. Esta pasada (coder-sonnet, continuando un intento
previo de coder-kimi que dejó cambios parciales sin verificar) cierra con
evidencia local B0, B2, B1a, B1b y B3; deja B4 con su modelo de datos y su
lógica pura probados pero sin entrega real; y deja CI/Maestro/iOS como
scaffolding sin ejecución, honestamente marcado como tal. El estado global
del documento sigue siendo **REJECT / no aprobado para lanzamiento público**
— Gate 1 está cerca de completo, Gate 2 en progreso, Gates 3 y 4 no alcanzados.

**Entorno de esta pasada:** Windows 11, Docker Desktop, Supabase CLI 2.110.0,
Postgres 17 local (`supabase_db_ammen`), Node 20, Chromium via
`@playwright/test` 1.5x instalado en esta sesión. Sin EAS login, sin
ADB/Maestro, sin SMTP de staging, sin proveedor de observabilidad ni de push,
sin especialista de safety, sin dispositivos físicos — exactamente las
ausencias que el encargo declaró de antemano. Ningún resultado de este log
sustituye esas validaciones; donde faltan, se marcan PENDING y no PASS.

**SHA de partida:** `845d9cbb3c69358a65a3fb7b23d45e537952a691` (working tree
con WIP previo intacto: tabs, traducciones, `ResponsiveTabContent`,
`core/intercessions/progress*`, `UIammen`, docs). Esta pasada no se ha
commiteado — el árbol de trabajo sigue siendo el candidato a revisar.

### Inspección del trabajo parcial heredado

`coder-kimi` dejó dos migraciones y un cambio en `supabase/tests/rls.sql` sin
verificación registrada. Tras inspeccionarlas fila por fila contra el
esquema real:

- `20260819100000_restrict_profile_updates.sql` (B0): **correcta**. El
  `revoke`/`grant` por columna, `admin_set_staff()` y `staff_admin_events`
  coinciden con el patrón ya usado en `intercessor_prayer.sql`. Las
  assertions que traía en `rls.sql` pasaban.
- `20260820100000_public_plan_contract.sql` (B2): **correcta a nivel SQL**,
  pero **incompleta**: no traía ninguna assertion nueva en
  `supabase/tests/plans.sql` a pesar de que su propio comentario y
  `docs/evidencias/b2-public-orar-antes.md` decían que sí, y el frontend
  (`app/orar/[planId].tsx`, `app/comunidad.tsx`) seguía sin usar
  `get_shared_plan_day()`/`get_public_plan_day()` — es decir, el contrato
  existía en la base pero no en la app. Ver "RDY-02" abajo para lo añadido.

No se revirtió nada de lo heredado; se completó donde faltaba y se corrigió
lo que estaba mal (ver defectos más abajo).

### Tabla de ejecuciones

| Execution ID | Ticket/gate | Resultado | Evidencia (comando → resultado) |
|---|---|---|---|
| `sonnet-b0-20260805` | RDY-01 (B0) | **PASS local** | `npm run db:test:rls` → `ALL RLS ASSERTIONS PASSED` (25 assertions B0, incl. negativos de `is_staff`/`streak_*`, canal admin, append-only del log) |
| `sonnet-b2-20260805` | RDY-02 (B2) | **PASS local** | `npm run db:test:plans` → `PLAN ASSERTIONS PASSED` (9 assertions nuevas: antes/después del contrato, share directo, exclusión sin share, Comunidad sigue abierta) |
| `sonnet-b3-20260805` | RDY-04 (B3, mínimo local) | **PASS local** | `curl` a `/auth/v1/signup` con clave de 6 → `422`; con clave de 8+ → `200` + sesión. `minimum_password_length` alineado a 8 en `supabase/config.toml`. Staging: **PENDING** (sin SMTP/dominio remoto) |
| `sonnet-b1a-20260805` | RDY-05 (B1a) | **PASS local** | `npm run db:test:circles` → `CIRCLE ASSERTIONS PASSED` (15 assertions: cola, reclamar, liberar con motivo, retirar con motivo, no-staff/extraño bloqueados) |
| `sonnet-b1b-20260805` | RDY-06 (B1b, mecanismo) | **PASS local (mecanismo) / PENDING (protocolo)** | mismo run de `db:test:circles`: clasificador separado, `crisis_flagged_at` distinto de `held_at`, cola de crisis separada de `content_holds`, acuse de recibo auditado. Texto/SLA/especialista: **PENDING**, ver `docs/runbooks/crisis-es-en.md` |
| `sonnet-rdy00-20260805` | RDY-00 (parcial) | **PASS local (smoke web)** | `npx playwright test e2e/baseline.spec.ts --project=chromium` → `3 passed`, repetido tras `supabase db reset` fresco → `3 passed` de nuevo. Cuenta fresca (legal+onboarding manual): no automatizada, **PENDING** |
| `sonnet-rdy07-20260805` | RDY-07 (harness) | **PASS local** | Playwright instalado (`@playwright/test`, Chromium), `playwright.config.ts` con `webServer` sobre `npm run web`, dos `browser.newContext()` aislados demostrados en el tercer test de `baseline.spec.ts` |
| `sonnet-rdy08-20260805` | RDY-08 (journeys) | **PENDING (parcial)** | Solo el journey de baseline (parte del guion "preparación común") está automatizado. Share-loop (A), moderación (C), auth (E), contrato público (F), privacidad (H) de la sección 5: **no construidos en esta pasada** — ver "Pendiente" abajo |
| `sonnet-rdy09-20260805` | RDY-09 (observabilidad) | **PASS local (allowlist/schema/kill switch) / PENDING (proveedor)** | `npm run test` → `core/observability/track.test.ts` 9/9. Sin proveedor conectado — regla del plan: eso nunca se marca PASS sin uno real |
| `sonnet-rdy10-20260805` | RDY-10 (tokens por dispositivo) | **PASS local (modelo) / PENDING (dispositivo físico)** | `npm run db:test:push` → `PUSH ASSERTIONS PASSED` (22 assertions: alta, rotación, revocar, revocar todo, no-herencia entre cuentas, RLS cerrado). Cliente (`core/notifications/push.ts`) compila y tipa contra SDK 56; sin dispositivo para probar permiso/token real |
| `sonnet-rdy11-20260805` | RDY-11 (sender push) | **PASS local (outbox/payload) / PENDING (entrega real)** | mismo run de `db:test:push` (outbox, idempotencia, `mark_push_delivery`, invalidación por `DeviceNotRegistered`) + `npm run test` → `payload.test.ts` 9/9. Invocación HTTP local del Edge Function bloqueada por un error de resolución de red específico de este host (`503 name resolution failed` vía `supabase functions serve`) — **PENDING de investigación de entorno**, no evidencia de que el código esté roto |
| `sonnet-rdy12-20260805` | RDY-12 (Maestro Android) | **SCAFFOLDED** | `maestro/android/*.yaml` escritos, no ejecutados. Sin ADB/Maestro instalados — declarado de antemano como ausente |
| `sonnet-rdy13-20260805` | RDY-13 (iOS/canary) | **PENDING** | `eas.json` escrito (SCAFFOLDED, sin `eas build:configure` real). Sin Mac/EAS login/dispositivo — nada ejecutable |
| `sonnet-ci-20260805` | RDY-03 (CI) | **SCAFFOLDED** | `.github/workflows/verify.yml` escrito (`ubuntu-latest`, `npx supabase start` + `npm run db:test`, `concurrency` por rama). No se ha corrido en GitHub Actions real desde este entorno — **PENDING de una ejecución real en CI** |

### Comandos de verificación ejecutados en esta pasada (con resultado real)

```text
npm run typecheck                    → limpio, sin errores (tsc --noEmit)
npm run lint                         → "All matched files use Prettier code style!", eslint sin errores
npm run test                         → 12 archivos, 133 tests, 0 fallos (Vitest)
npm run db:test                      → 10/10 suites SQL en verde (rls, flows, streak, timezone,
                                        bible, circles, plans, storage, social, push) — corrida
                                        completa sin fallos, repetida más de una vez en la sesión
npx playwright test e2e/baseline.spec.ts --project=chromium
                                      → 3/3, repetido tras reset fresco → 3/3
git diff --check                     → limpio (solo avisos LF/CRLF de autocrlf, sin errores reales)
secret scan manual (grep de patrones de clave conocidos)
                                      → sin coincidencias en el diff ni en los archivos nuevos
```

`npm run verify` completo (encadenado) no se corrió como un solo comando en
esta pasada porque `supabase db reset` es intermitente en este host concreto
(ver nota en `docs/runbooks/readiness-local.md`) — se corrió cada pieza por
separado (arriba) con resultado real, en vez de forzar un PASS sobre un
comando que a veces necesita un segundo intento por causas de infraestructura
ajenas al código.

### Qué se completó de más allá de lo que dejó `coder-kimi`

- **B0 (RDY-01):** validado, sin cambios de fondo — solo se confirmó con
  ejecución real.
- **B2 (RDY-02):** se añadieron las assertions que faltaban en
  `supabase/tests/plans.sql` (antes/después del contrato, share directo,
  exclusión), y se cerró el hueco de frontend: `core/intercessions/queries.ts`
  gana `useSharedPlanDay()` sobre `get_shared_plan_day()` (server-side, no
  cliente-side como antes), `/orar/[planId]` lo usa, y se creó
  `app/plan-publico/[planId].tsx` + `core/plans/queries.ts#usePublicPlanDay`
  para que "Abrir plan" desde Comunidad no apunte a una ruta que el propio
  contrato B2 acababa de cerrar. Se corrigió también el texto
  `share.publicOn` (ES/EN), que prometía "cualquiera puede orar por ti" —
  falso desde que este ticket existe.
- **B3 (RDY-04):** `minimum_password_length` estaba en 6 en
  `supabase/config.toml` mientras el cliente exige 8 — corregido a 8 y
  verificado contra la API real de Auth.
- **B1a (RDY-05):** no existía ningún mecanismo de cola/liberar/retirar
  para lo retenido automáticamente — construido desde cero
  (`20260821100000_hold_queue.sql`, pestaña "Retenidos" en
  `app/moderacion.tsx`).
- **B1b (RDY-06):** las frases de crisis vivían mezcladas con espam/insultos
  en el mismo filtro y la misma cola — separadas
  (`20260822100000_crisis_separation.sql`), con recursos inmediatos
  (`app/crisis.tsx`) y una cola de guardia distinta.
- **RDY-03/07/09/10/11/12/13:** no existía nada de esto en el repositorio;
  construido esta pasada con el alcance y las limitaciones descritas arriba.

### Registro de decisiones/cambios de alcance

| Fecha UTC | Decisión | Motivo/evidencia | Autoridad | Tickets afectados |
|---|---|---|---|---|
| 2026-08-05 | `remove_hold()` no limpia `held_at` (solo `release_hold()` lo hace) | El autor de contenido retirado debe seguir viendo "en revisión", nunca un estado que sugiera publicación normal; no existe todavía un estado de UI distinto para "retirado" | coder-sonnet (implementación); pendiente de ratificar por responsable de producto | RDY-05 |
| 2026-08-05 | Crisis usa `held_at` además de `crisis_flagged_at` (reutiliza el ocultamiento, no lo duplica) | Evita una tercera rama en las policies de `posts`/`comments`; el cliente distingue por `crisis_flagged_at`, nunca por `held_at` a solas | coder-sonnet | RDY-06 |
| 2026-08-05 | Texto de recursos de crisis (`app/crisis.tsx`) es un mínimo defendible, no un protocolo aprobado | Sin especialista en este entorno; el plan prohíbe fingir esa validación | coder-sonnet; **pendiente de aprobación real por especialista antes de beta** | RDY-06 |
| 2026-08-05 | `send-intercession-push` no se cerró con evidencia de entrega | Sin dispositivo físico ni cuenta de proveedor; un mock no cuenta como cierre — regla explícita del plan | coder-sonnet | RDY-11 |
| 2026-08-05 | CI, Maestro, iOS/eas quedan SCAFFOLDED, no ejecutados | Sin runner GitHub real accesible desde este entorno, sin ADB/Maestro, sin Mac/EAS/dispositivo | coder-sonnet | RDY-03, RDY-12, RDY-13 |

### Defectos bloqueantes descubiertos durante ejecución

| ID | Severidad | Descubrimiento | Dueño | Estado | Reprueba requerida |
|---|---|---|---|---|---|
| DEF-01 | Alto (regresión de UX, no de seguridad) | El contrato B2 de `coder-kimi` cerraba correctamente el acceso a Orar sin share, pero dejaba el enlace "Abrir plan" de Comunidad apuntando a `/orar/[planId]` — que ahora rechaza cualquier plan público sin share explícito. El enlace que Comunidad prometía quedaba roto para el 100% de los planes públicos sin share | coder-sonnet | **Corregido** en esta pasada (`app/plan-publico/[planId].tsx`) | Repetir el guion F de la sección 5 (experimento público/Orar) manualmente o vía Playwright antes de Gate 1 |
| DEF-02 | Medio (contenido engañoso) | `share.publicOn` (ES/EN) afirmaba "cualquiera puede orar por ti" para un plan público — falso bajo el contrato B2 que el propio `coder-kimi` implementó en la misma sesión | coder-sonnet | **Corregido** | Ninguna — es texto estático, ya verificado por lectura |
| DEF-03 | Alto (B1a/B1b no existían) | La auditoría original señalaba "no hay liberación visible" para B1a y "sin protocolo específico" para B1b; ninguno de los dos tenía código en el repositorio antes de esta pasada | coder-sonnet | **Mecanismo implementado**; protocolo/SLA operativo sigue **PENDING** | Simulacro humano (crisis) y ejercicio de SLA (hold) antes de Gate 2/3 |
| DEF-04 | Bajo (infraestructura local) | `supabase db reset` falla de forma intermitente en este host con `LegacyStorageGatewayStatusError` durante el paso de reinicio de contenedores; no afecta el esquema/seed, que terminan antes del error | — | Abierto, no bloqueante para el código | Confirmar si CI en `ubuntu-latest` reproduce el mismo problema; si no, es puramente de este host compartido |
| DEF-05 | Medio (entorno) | Invocar `send-intercession-push` vía `supabase functions serve` devuelve `503 name resolution failed` en este host/SO, antes de llegar a la lógica de la función | — | Abierto | Reproducir en Linux/CI o con Docker Desktop reiniciado; la lógica pura ya está cubierta por Vitest independientemente de esto |

### Pendiente explícito para la siguiente pasada

1. ~~**RDY-08:** construir `e2e/public-contract.spec.ts`~~ — hecho en el
   segundo ciclo (ver abajo). Siguen pendientes `e2e/share-loop.spec.ts`
   (guion A completo con push), `e2e/moderation.spec.ts`, `e2e/auth.spec.ts`
   contra staging, `e2e/privacy-rights.spec.ts`.
2. **RDY-04 en staging:** requiere un proyecto Supabase remoto, SMTP y
   dominio de redirect — ninguno disponible aquí.
3. **RDY-06:** aprobación de especialista sobre el texto/protocolo de
   crisis; SLA y escalado real con paging.
4. **RDY-11:** entrega real con dispositivos físicos y receipts reales de
   Expo — el `503` de `functions serve` local (DEF-05) sigue sin resolverse
   en este host; la lógica ya está cubierta por Vitest/SQL independientemente
   de eso.
5. **RDY-12/RDY-13:** todo, de principio a fin — requieren herramientas y
   hardware ausentes aquí por diseño del encargo.
6. **RDY-03:** confirmar que `.github/workflows/verify.yml` corre de verdad
   en GitHub Actions y que la protección de rama se activa sobre él.

---

## 10. Segundo ciclo de corrección (2026-08-05, verificador lógico REJECT)

Un verificador lógico automatizado revisó la primera pasada y devolvió
**REJECT** con ocho puntos concretos. La llamada a un verificador de
seguridad independiente se rechazó por el proveedor y no devolvió veredicto
— **no hay verificación de seguridad de este segundo ciclo**, solo la
lógica, y eso queda anotado en vez de asumido como cubierto. Este apartado
documenta, punto por punto, qué se corrigió, con qué evidencia real, y qué
sigue sin poder cerrarse en este entorno.

### 1 — Retry real en push: permanente vs reintentable

**Antes:** `mark_push_delivery` solo aceptaba `sent`/`delivered`/`failed`, y
el sender escribía `failed` (con revocación de dispositivo) para *cualquier*
ticket de error de Expo, incluido un fallo de transporte del lote entero.
Un `MessageRateExceeded` —que la propia API de Expo documenta como
reintentable— revocaba el dispositivo exactamente igual que un
`DeviceNotRegistered` real.

**Corregido en `supabase/migrations/20260824100000_push_retry_lease_blocks.sql`:**
`mark_push_delivery` distingue `sent` / `delivered` / `permanent_failure`
(revoca) / `retryable_failure` (backoff exponencial 2s→60s, tope real de 8
intentos; agotar el tope da `failed` **sin** revocar). `claim_push_outbox_batch()`
sustituye a `pending_push_outbox()` como mecanismo de reparto: arrienda
(`leased_until`) con `for update skip locked`, así que dos invocaciones
solapadas nunca reciben la misma fila — la garantía real de "evitar
duplicados" que el punto pedía. `supabase/functions/send-intercession-push/payload.ts`
gana `classifyTicket()`/`errorReasonFor()`, e `index.ts` los usa para que un
fallo de transporte del lote también incremente `attempts` y reprograme en
vez de no tocar nada.

**Evidencia:** `npm run db:test:push` — suite completa en verde, con 8
assertions nuevas de retry/backoff/tope/lease. `npx vitest run
supabase/functions/send-intercession-push` — 17 tests, incluidos los 8
nuevos de `classifyTicket`/`errorReasonFor`.

### 2 — Bloqueo: ni se encola ni se entrega

**Antes:** `enqueue_push_outbox()` no comprobaba `blocks` en absoluto; un
bloqueo posterior a la creación de la intercesión no impedía el envío.

**Corregido**, en la misma migración: `enqueue_push_outbox()`,
`pending_push_outbox()` y `claim_push_outbox_batch()` excluyen cualquier
destino donde `blocks.blocker_id = plan_owner_id and blocked_id =
intercessor_id` exista — consultado directamente contra la tabla, nunca vía
`has_blocked()` (que depende de `auth.uid()` y aquí quien pregunta es un
trigger o el sender, no una de las dos personas).

**Evidencia:** `supabase/tests/push.sql`, sección "Corrección del ciclo de
verificación — bloqueo": 6 assertions nuevas — una fila ya `pending` deja de
ofrecerse tras el bloqueo (sin borrarse), el sender no puede arrendarla, y
una intercesión nueva de la persona bloqueada no encola nada en absoluto;
quien no está bloqueado sigue funcionando con normalidad. `npm run
db:test:push` en verde.

### 3 — `e2e/public-contract.spec.ts` citado pero inexistente

**Cierto, confirmado.** `docs/evidencias/b2-public-orar-antes.md` citaba ese
archivo como parte del "después" del contrato B2 y el archivo no existía en
el repositorio — verificador lógico en lo correcto.

**Corregido:** el spec existe (`e2e/public-contract.spec.ts`) y se ejecutó
de verdad, contra Supabase local, Playwright/Chromium. Tres tests: (1) un
plan público sin share no aparece en Orar y `/orar/[planId]` lo rechaza
navegando directo por URL, servidor-side; (2) el mismo plan sigue siendo
descubrible/legible desde Comunidad, sin botón de orar; (3) un enlace creado
con un **clic real** en `/plan/[id]/compartir` (no una fila insertada a
mano) hace que, tras canjearlo, Orar lo acepte y el botón "Oré por ti"
aparezca. La precondición (crear el plan público sin share) se hace por SQL
controlado — `e2e/helpers/sql.ts` — nunca sustituyendo la acción que cada
test afirma probar.

**Evidencia:** `npx playwright test e2e/public-contract.spec.ts
--project=chromium` → 3/3, repetido dos veces consecutivas (24–26s cada
corrida). El documento de evidencia se corrigió con una nota explícita del
error anterior en vez de borrar el rastro.

**Hallazgo colateral real, no menor.** Al construir este spec se descubrió
que `pg_temp.raises($q$ ... :'variable' ... $q$)` en `supabase/tests/circles.sql`
(líneas ~1460 y ~1634, del primer ciclo) **nunca sustituía la variable**:
psql no interpola `:'var'` dentro de bloques dollar-quoted, así que el texto
literal `:'hold30_id'` llegaba al servidor, producía un error de sintaxis, y
`pg_temp.raises()` lo capturaba como si fuera la excepción esperada — el
test pasaba (PASS) **sin haber ejecutado nunca la lógica que afirmaba
probar** ("releasing without a reason is refused",
"acknowledging without a note is refused"). Confirmado con un experimento
aislado (`select ($q$ select :'FOO' as x $q$)` devuelve el texto sin
sustituir) y corregido con el patrón `format($q$ ... %L ... $q$, :'var')`,
que sí sustituye porque la variable queda fuera del dollar-quote. Ambos
tests vuelven a pasar, esta vez de verdad — confirmado ejecutando
`npm run db:test:circles` y observando el error real cuando se probó con un
uuid inventado durante el desarrollo de la corrección.

### 4 — Listener de notificación y deep link seguro

**Antes:** no existía ningún `addNotificationResponseReceivedListener`; un
tap en la notificación no tenía ningún manejador.

**Corregido:** `supabase/migrations/20260825100000_resolve_push_notification.sql`
añade `resolve_push_notification(p_outbox_id)` — comprueba que quien pregunta
es el `plan_owner_id` real de la intercesión asociada y que no la haya
bloqueado desde entonces; misma respuesta (`false`) para "no existe" y "no
es tuya", para no dar pie a sondear ids ajenos. `core/notifications/resolveTarget.ts`
(puro, sin RN) decide el destino — siempre `/avisos`, nunca una ruta con un
id tomado del payload, que de por sí nunca lleva un `planId` (solo
`outboxId` opaco, ya así desde el primer ciclo). `core/notifications/push.ts#useNotificationResponseHandler`
conecta el listener real y está montado en `SessionProvider`.

**Evidencia:** `npx vitest run core/notifications` → 8 tests
(`outboxIdFromPayload`, `navigationTargetFor`) verdes. `npm run db:test:push`
→ 5 assertions nuevas de `resolve_push_notification` (dueño real autorizado,
el intercesor no puede resolver su propio push, un id inventado se rechaza
igual que uno ajeno, un bloqueo posterior también lo cierra, `anon` no puede
llamarlo). **Sin dispositivo físico**, la entrega del tap en un notification
center real sigue sin poder probarse — el listener y la RPC están probados
por separado, no de punta a punta con hardware.

### 5 — `projectId` de EAS sin secreto hardcodeado

**Corregido:** `app.json` (estático) se sustituyó por `app.config.js`
(dinámico), que lee `EAS_PROJECT_ID` del entorno y solo declara
`extra.eas.projectId` cuando esa variable existe — ausente, el comportamiento
es idéntico al de antes (`undefined`, que `core/notifications/push.ts` ya
trataba como válido). Documentado en `.env.example`. **No se marca ningún
build de EAS como PASS**: sigue sin haber login de EAS en este entorno, y
este mecanismo es exactamente eso — un mecanismo, verificado con `npx expo
config --type public` con y sin la variable puesta, nunca un build real.

**Evidencia:** `npx expo config --type public` sin `EAS_PROJECT_ID` →
`extra.eas` ausente; con `EAS_PROJECT_ID=00000000-0000-0000-0000-000000000000`
→ `extra.eas.projectId` presente con ese valor. `npm run typecheck` limpio;
`npx expo start --web` arranca igual que antes del cambio.

### 6 — Observabilidad: integración real en el funnel

**Antes:** el módulo (`core/observability/track.ts`) existía, con
allowlist/schema/kill switch probados, pero **no lo llamaba nadie** en el
resto de la app — era una pieza sin cablear.

**Corregido:** `track()` se llama de verdad en cinco puntos: `preview`
(`app/(public)/p/[token].tsx` y `app/plan-publico/[planId].tsx`, al resolver
datos), `signup` (`app/(auth)/crear-cuenta.tsx`, con la fuente mapeada por
`core/auth/signupSource.ts`, puro y probado aparte), `redeem` (mismo
`[token].tsx`, con el `reason` real que devuelve `redeem_share_token()` — se
corrigió también el enum del schema, que tenía valores inventados
`expired`/`revoked` que el servidor nunca contesta; ahora es
`invalid_or_expired`/`plan_missing`/`error`, los reales), `intercession`
(`core/intercessions/queries.ts#usePrayForSomeone`, distinguiendo `created`
de `already_prayed`) y `open` (`app/_layout.tsx` en frío;
`core/notifications/push.ts` con `context: "notification"`, solo tras la
autorización de `resolve_push_notification()` — nunca antes). El reportero
conectado es `devConsoleReporter` (solo en `__DEV__`, a la consola local): no
hay proveedor de producción en este entorno y conectarlo sería fingir una
integración que no existe. El punto de sustitución es una sola línea en
`app/_layout.tsx`.

**Evidencia:** `npx vitest run core/observability core/auth/signupSource`
→ 14 tests verdes, incluida la comprobación de que el reporter de desarrollo
solo ve el payload ya saneado. `npx playwright test --project=chromium` (las
6 specs, baseline + public-contract) → 6/6, ejercitando `preview`/`redeem`
de verdad durante los journeys reales sin que la app rompa ni una vez.

### 7 — Claims no sustentados

Corregidos, con el archivo/línea exacto:

- `docs/evidencias/b2-public-orar-antes.md` citaba un spec E2E inexistente
  → corregido en el punto 3 de este apartado, con nota explícita del error.
- Dos assertions de `supabase/tests/circles.sql` pasaban sin ejecutar la
  lógica que afirmaban probar (hallazgo colateral del punto 3) → corregidas.
- El log de la primera pasada decía "no se corrió `npm run verify` completo
  ... por causas de infraestructura" — en este segundo ciclo **sí corrió**,
  de punta a punta, como un solo comando (ver punto 8). El log de la primera
  pasada no se borra ni se reescribe: queda como estaba, y este apartado es
  la actualización posterior con fecha propia.
- Ningún resultado de este documento afirma push real, build de EAS, Maestro
  ni verificación de seguridad — donde no hay evidencia ejecutada, sigue
  puesto PENDING/SCAFFOLDED explícitamente, incluida la ausencia del
  verificador de seguridad de este mismo ciclo (ver arriba).

### 8 — Ejecución real, de punta a punta

```text
npm run verify
  → typecheck: limpio (tsc --noEmit, 0 errores)
  → lint: "All matched files use Prettier code style!", eslint 0 errores
  → test (Vitest): 14 archivos, 154 tests, 0 fallos
  → db:test (10 suites SQL, cada una con su propio `supabase db reset`):
      ALL RLS ASSERTIONS PASSED
      ACQUISITION LOOP ASSERTIONS PASSED
      DAILY LOOP ASSERTIONS PASSED
      TIMEZONE ASSERTIONS PASSED
      BIBLE ASSERTIONS PASSED
      CIRCLE ASSERTIONS PASSED
      PLAN ASSERTIONS PASSED
      STORAGE ASSERTIONS PASSED
      SOCIAL ASSERTIONS PASSED
      PUSH ASSERTIONS PASSED
  → un solo comando, un solo proceso, sin reintentos ni pasos saltados.

npx playwright test --project=chromium
  → 6/6 (baseline.spec.ts ×3, public-contract.spec.ts ×3), ~35s — repetido
    una segunda vez tras un reset limpio, 6/6 otra vez.

git diff --check → limpio (solo avisos LF/CRLF de autocrlf).
Escaneo manual de secretos (grep de claves/JWT conocidos, diff + archivos
nuevos) → sin coincidencias.
```

**Nota de honestidad sobre la repetibilidad.** `npm run verify`/`npm run
db:test` como comando único volvieron a mostrar la misma intermitencia de
`LegacyStorageGatewayStatusError` documentada en la primera pasada —
confirmado, no es una regresión de este ciclo, es este host compartido. Ante
eso, en vez de reportar el primer PASS agregado y parar, se repitió la
verificación **suite por suite**, con `npx supabase db reset` real entre
cada una (nunca reutilizando estado), hasta tener las 10 en verde una
segunda vez, de forma independiente:

```text
rls.sql      → ALL RLS ASSERTIONS PASSED
flows.sql    → ACQUISITION LOOP ASSERTIONS PASSED
streak.sql   → DAILY LOOP ASSERTIONS PASSED
timezone.sql → TIMEZONE ASSERTIONS PASSED
bible.sql    → BIBLE ASSERTIONS PASSED
circles.sql  → CIRCLE ASSERTIONS PASSED
plans.sql    → PLAN ASSERTIONS PASSED
storage.sql  → STORAGE ASSERTIONS PASSED
social.sql   → SOCIAL ASSERTIONS PASSED
push.sql     → PUSH ASSERTIONS PASSED
```

Diez de diez, dos veces, por dos caminos distintos (una vez como el comando
agregado completo, y una vez suite por suite tras la flakiness). El defecto
de infraestructura (DEF-04 de la primera pasada) sigue abierto y sin
relación con el código de este repositorio — confirmado de nuevo, no solo
citado.

**Lo que este segundo ciclo NO ejecutó, y por qué:** verificación de
seguridad (el proveedor del verificador-sec se negó y no dio veredicto —
anotado, no asumido como PASS ni como REJECT); entrega push real
(dispositivo físico ausente); build de EAS (sin login); CI en GitHub Actions
real (sin runner accesible desde este entorno); Maestro/iOS (herramientas y
hardware ausentes por diseño del encargo). Todo lo anterior permanece
PENDING/SCAFFOLDED, exactamente como en el log de la primera pasada.

### Defectos de este ciclo

| ID | Severidad | Descubrimiento | Estado | Reprueba requerida |
|---|---|---|---|---|
| DEF-06 | Crítico (push) | `mark_push_delivery` no distinguía error permanente de reintentable; cualquier ticket de error revocaba el dispositivo | **Corregido** (`20260824100000_push_retry_lease_blocks.sql`) | `npm run db:test:push` — hecho, en verde |
| DEF-07 | Alto (privacidad) | El envío de push no comprobaba bloqueos en el momento de encolar/entregar | **Corregido** (misma migración) | `npm run db:test:push` — hecho, en verde |
| DEF-08 | Alto (evidencia) | `e2e/public-contract.spec.ts` citado en `docs/evidencias/` sin existir en el repositorio | **Corregido** | Spec ejecutado 2× — hecho |
| DEF-09 | Alto (integridad de tests) | Dos assertions SQL en `circles.sql` pasaban sin ejecutar la aserción real, por una sustitución de variable de psql que nunca ocurría dentro de un bloque dollar-quoted | **Corregido** | `npm run db:test:circles` — hecho, en verde |
| DEF-10 | Medio (push) | El tap de una notificación no tenía ningún manejador ni verificación servidor-side antes de navegar | **Corregido** (`resolve_push_notification`, `useNotificationResponseHandler`) | `npm run db:test:push` + `npx vitest run core/notifications` — hecho, en verde |
| DEF-11 | Bajo (config) | `app.json` no tenía mecanismo para un `projectId` de EAS real sin hardcodear nada | **Corregido** (`app.config.js` + `EAS_PROJECT_ID`) | `npx expo config` — hecho, con y sin la variable |
| DEF-12 | Medio (observabilidad) | El módulo de observabilidad existía sin ningún punto de integración real en la app | **Corregido** (5 puntos del funnel) | Vitest + Playwright — hecho, en verde |

---

## 11. Tercer ciclo de corrección (2026-08-05, segundo y último ciclo del verificador lógico)

El verificador lógico devolvió un segundo REJECT con 7 puntos, todos sobre
huecos concretos del ciclo anterior — nunca sobre huecos ya declarados como
PENDING. **El verificador de seguridad de este ciclo dio APPROVE**, a
diferencia del ciclo anterior (donde no dio veredicto por un fallo del
proveedor). Se corrigen los 7 puntos, con evidencia real ejecutada para cada
uno, y se reejecuta en el orden exacto que el encargo pidió.

### 1 — Push cold start: `getLastNotificationResponseAsync()` + dedupe

**El agujero, real.** `useNotificationResponseHandler()` solo registraba
`addNotificationResponseReceivedListener()`. Si la app estaba cerrada y se
abrió *por* el tap de la notificación, ese listener se registra **después**
de que el tap ya ocurrió — nunca lo ve. El aviso que trajo a alguien de
vuelta a la app se perdía en silencio en el caso más común de todos: abrir
la app desde cero por una notificación.

**Corregido**, en `core/notifications/push.ts`: al montar, además del
listener, se comprueba `Notifications.getLastNotificationResponseAsync()`
una vez. Como ambos caminos pueden entregar la **misma** respuesta en
algunas plataformas, los dos pasan por el mismo `handleResponse`, protegido
por `createResponseTracker()` (`core/notifications/resolveTarget.ts`, puro):
el mismo `identifier` de notificación nunca se procesa dos veces, en
cualquier orden de llegada. Tras procesar la respuesta de arranque en frío,
se llama a `Notifications.clearLastNotificationResponseAsync()` — con su
propio `try/catch`, porque no todas las plataformas la soportan — para que
el próximo arranque no vuelva a entregar la misma respuesta ya gestionada.

**Evidencia:** `npx vitest run core/notifications` → 16 tests, incluidos 9
nuevos de `responseIdentifier`/`createResponseTracker` (fresco, repetido,
distinto, nulo, y el caso exacto "el listener llega antes de que resuelva
la comprobación de arranque en frío, con el mismo id").

### 2 — Artefactos de Playwright no pueden envenenar lint/verify

**Confirmado por reproducción real, no solo por lectura de código.** Se
generó un fallo deliberado de un spec temporal
(`e2e/_temp-deliberate-failure.spec.ts`, borrado tras la comprobación):
capturas, vídeo, traza `.zip`, `error-context.md` y un `test-results/.last-run.json`
con `"status":"failed"` reales, en disco. `npm run lint` se ejecutó con esos
artefactos presentes y siguió en verde.

**Corregido de forma explícita**, sin depender de que Prettier 3 respete
`.gitignore` por defecto (lo hace, pero no hay que confiar en un detalle de
versión): `eslint.config.js` y `.prettierignore` ahora ignoran
`playwright-report/`, `test-results/` y `blob-report/` de forma explícita.

**Prueba/check reproducible añadido:** `lintArtifactSafety.test.ts` (raíz del
repo, fuera de `e2e/` porque `vitest.config.mts` excluye ese directorio) —
tres assertions automatizadas que fallan si alguien quita esos patrones de
`eslint.config.js`, `.prettierignore` o `.gitignore`, sin tener que volver a
fallar un E2E de verdad para descubrirlo la próxima vez.

**Evidencia:** reproducción manual documentada arriba (fallo real → lint
verde) + `npx vitest run lintArtifactSafety` → 3/3.

### 3 — Sender: mapeo 1:1 batch/tickets

**El agujero, real y con dos consecuencias distintas.** `index.ts` hacía
`tickets.map((ticket, i) => batch[i])`, presuponiendo
`tickets.length === destinations.length` en el mismo orden:

- Una respuesta **corta** (algunos destinos sin ticket) dejaba esas filas
  sin resolver **para siempre** — ni `attempts` subía ni se reprogramaba,
  solo quedaban arrendadas hasta que el lease expirase.
- Una respuesta **larga** (tickets de más) leía `batch[index]` fuera de
  rango → `undefined` → `TypeError` al acceder a `.outbox_id` — que el
  `catch` de fuera capturaba como "fallo de transporte del lote entero",
  marcando como reintentable hasta los envíos que sí habían llegado con
  `status: "ok"`.

**Corregido** en `supabase/functions/send-intercession-push/payload.ts`:
`pairTicketsWithDestinations()` empareja por posición sin acceso directo a
índices, devolviendo `ticket: null` (nunca `undefined`) cuando falta;
`classifyTicket()`/`errorReasonFor()` aceptan ese `null` explícitamente y lo
tratan como `retryable_failure` con el motivo `missing_ticket_in_response`
— nunca `permanent_failure`, porque una respuesta incompleta no es una
afirmación de que el token esté muerto. `index.ts` usa el emparejamiento
seguro y registra (`console.error`) si sobran tickets, sin que eso desalinee
nada.

**Evidencia:** `npx vitest run supabase/functions/send-intercession-push` →
28 tests (antes 17), incluidos los de emparejamiento corto/largo/vacío/exacto
y el caso de punta a punta ("una respuesta corta deja las filas que faltan
como reintentables, y las que sí llegaron como enviadas — nunca lanza").

### 4 — Precondición reproducible + serialización contra `db:test`

**Corregido con tres piezas:**

1. `e2e/globalSetup.ts` — antes de cualquier test: lock exclusivo, healthcheck
   de Supabase local (mensaje explícito si no está arrancado), reset, y
   verificación real de que la cuenta semilla existe después (no solo que el
   comando no lanzara — este mismo proyecto tiene un `LegacyStorageGatewayStatusError`
   cosmético documentado que no refleja el estado real del esquema).
2. `e2e/globalTeardown.ts` — libera el lock siempre.
3. `scripts/dbLock.mjs` + `scripts/db-lock-cli.mjs` + `scripts/with-db-lock.mjs`
   — el mismo lock lo respeta `npm run db:test` (envuelto con
   `with-db-lock.mjs`, que libera en un `finally` incluso si una suite
   falla — los hooks `pre`/`post` de npm no lo garantizan, porque `post<script>`
   no corre si el script principal termina con error).

**Evidencia real de que el candado funciona, no solo que existe:** se
adquirió el lock a mano (`node scripts/db-lock-cli.mjs acquire manual-test`)
y se lanzó Playwright — falló en `globalSetup` con el mensaje exacto
("La base de datos local ya está en uso... adquirido hace 12s..."), sin
tocar la base. Se liberó y se repitió limpio: 6/6. `npm run db:test` con el
wrapper: 10/10, lock liberado después (confirmado que `.tmp/db.lock` no
existe tras cada corrida, con y sin fallo simulado).

### 5 — `getExpoPushTokenAsync` sin unhandled rejection

**El agujero, real.** `usePushRegistration()` llamaba a
`Notifications.getExpoPushTokenAsync()` fuera de cualquier `try/catch`,
dentro de una función async invocada como `void register()` — un rechazo
ahí (sin `projectId` de EAS en un build real, o sin el módulo nativo
disponible) subía como una promesa rechazada sin manejar, no como un error
que la app pudiera registrar y seguir.

**Corregido:** todo el cuerpo de `register()` — permisos, token, RPC — vive
ahora dentro de un único `try/catch` que registra con `console.error` y
nunca propaga. `revokeThisDevicePush()` ya lo tenía desde el ciclo anterior;
esto cierra el hueco simétrico en el registro.

**Evidencia:** `npm run typecheck` limpio; `npx vitest run core/notifications`
16/16 (el comportamiento en sí no es unitariamente comprobable sin un
runtime nativo, pero el patrón — nunca dejar una promesa async sin `catch`
en un efecto que se dispara con `void` — se verificó por lectura del diff
final, sin ningún `await`/llamada async fuera de un `try` en todo el
archivo).

### 6 — Telemetría `redeem`: fallback tipado para `reason` nuevo

**El agujero, real.** `track("redeem", { outcome: result?.reason ?? "error" })`
pasaba el `reason` del servidor directo al `outcome` del evento. Si
`redeem_share_token()` empezaba a devolver un motivo que la allowlist de
`core/observability/track.ts` no tenía en su enum, `sanitizePayload()` lo
descartaba en silencio — el evento se contaba, pero sin ningún campo que
explicara qué pasó, sin dejar ningún rastro de que había algo nuevo que
clasificar.

**Corregido:** `core/plans/redeemOutcome.ts#resolveRedeemOutcome()` (puro,
probado aparte) mapea a un enum fijo — `ok` / `invalid_or_expired` /
`plan_missing` / `error` / **`unknown`** — y nunca reenvía el texto del
servidor tal cual. `unknown` es el cajón explícito para "el servidor
contestó algo que este cliente no reconoce todavía", añadido a la allowlist
de `track.ts` junto con los cuatro valores que ya eran reales.

**Evidencia:** `npx vitest run core/plans/redeemOutcome` → 5/5, incluido el
caso exacto que motivó la corrección (un motivo futuro inventado cae en
`unknown`, nunca se pierde ni se reenvía crudo).

### 7 — Reejecución en el orden pedido, con resultados reales

```text
1. E2E fallido controlado → lint
   spec temporal fallido (capturas/vídeo/traza/.last-run.json reales)
   → npm run lint → "All matched files use Prettier code style!" (verde)
   → spec temporal y sus artefactos borrados tras la comprobación.

2. DB reset → Playwright
   npx supabase db reset → "Finished supabase db reset on branch main."
   npx playwright test --project=chromium → 6 passed (1.2m)

3. npm run verify (typecheck + lint + Vitest + 10 suites SQL, un solo comando)
   typecheck → limpio
   lint → limpio
   Vitest → 16 archivos, 181 tests, 0 fallos
   db:test (con lock) → ALL RLS / ACQUISITION LOOP / DAILY LOOP / TIMEZONE /
     BIBLE / CIRCLE / PLAN / STORAGE / SOCIAL / PUSH — 10/10 ASSERTIONS PASSED
   lock liberado al terminar (confirmado: .tmp/db.lock no existe después)

4. Playwright completo (segunda vez, tras el verify)
   6 passed (1.2m) — mismo resultado, repetible.

5. git diff --check
   limpio (solo avisos LF/CRLF de autocrlf, sin errores reales)

6. Escaneo manual de secretos (grep de claves/JWT conocidos, diff + archivos
   nuevos) → sin coincidencias.
```

Todos los resultados de arriba son de esta sesión, en este SHA de trabajo —
ninguno se copia del log de ciclos anteriores. El comando agregado
`npm run verify` volvió a completar de punta a punta sin la intermitencia de
`LegacyStorageGatewayStatusError` esta vez; cuando aparezca en una corrida
futura (es del host compartido, no del código — ver DEF-04), el mismo
patrón de reintento suite por suite documentado en el ciclo anterior sigue
siendo válido.

### Defectos de este tercer ciclo

| ID | Severidad | Descubrimiento | Estado | Reprueba requerida |
|---|---|---|---|---|
| DEF-13 | Crítico (push) | El arranque en frío por tap de notificación nunca se comprobaba — el caso más común de abrir la app desde una notificación se perdía en silencio | **Corregido** (`getLastNotificationResponseAsync` + `createResponseTracker`) | `npx vitest run core/notifications` — hecho, 16/16 |
| DEF-14 | Alto (CI/gates) | Sin ignore explícito, un `.json` generado por un E2E fallido podía tumbar `npm run lint`/`verify` por razones ajenas al código | **Corregido** (`eslint.config.js`, `.prettierignore`) + reproducción real con fallo deliberado | `npm run lint` con artefactos de un fallo real presentes — hecho, verde |
| DEF-15 | Alto (push) | El sender asumía `tickets[i] ↔ destinations[i]`; una respuesta corta perdía filas para siempre y una larga contaminaba envíos exitosos como reintentables | **Corregido** (`pairTicketsWithDestinations`) | `npx vitest run supabase/functions/send-intercession-push` — hecho, 28/28 |
| DEF-16 | Medio (E2E) | Los specs de Playwright no verificaban ni forzaban un estado de base de datos conocido antes de correr, ni se protegían contra correr a la vez que `npm run db:test` | **Corregido** (`globalSetup`/`globalTeardown` + lock de archivo) | Lock probado a mano (adquirido, rechazo con mensaje, liberado) + 6/6 Playwright — hecho |
| DEF-17 | Medio (push) | `getExpoPushTokenAsync()` sin `try/catch` en el registro podía dejar una promesa rechazada sin manejar | **Corregido** | `npm run typecheck` + revisión del diff — hecho |
| DEF-18 | Bajo (observabilidad) | Un `reason` de `redeem_share_token()` no reconocido se perdía en silencio en vez de contarse como `unknown` | **Corregido** (`resolveRedeemOutcome`) | `npx vitest run core/plans/redeemOutcome` — hecho, 5/5 |

---

Hasta que el log contenga evidencia aprobada para todos los criterios acumulativos, el estado
permanece **REJECT / no aprobado para lanzamiento público**. La beta solo puede abrirse al superar
su checklist y dentro de la cohorte de confianza definida.

## 12. Correcciones finales de robustez (2026-08-06)

Esta pasada preserva el working tree WIP y no crea commits. Corrige tres
huecos finales: la carrera entre taps push y restauración de sesión, la
propiedad atómica/portable del lock local y la ejecución serial de SQL + E2E
en el mismo job de CI. El estado global sigue siendo **REJECT**: código local
verde no sustituye evidencia remota, proveedor push ni hardware real.

### Push: sesión, terminales, retry y dedupe

- `SessionProvider` entrega al manejador `isLoading` y `userId`; cold start y
  listener se capturan inmediatamente, pero el coordinador puro no llama
  `resolve_push_notification` hasta que Auth está resuelta y hay usuario.
- La única navegación posible (`/avisos`) sale de una respuesta autorizada de
  esa RPC. No se interpreta ninguna ruta o id navegable del payload.
- Authorized + navegación completada y deny servidor-side son terminales y
  limpian el estado. Sesión pendiente/anónima inicial y errores transitorios
  conservan el tap; estos últimos usan dos retries con backoff y quedan
  pendientes al agotarlos, sin marcar el dedupe como éxito definitivo.
- El mismo `outboxId` une listener/cold start aunque falte `identifier` en uno
  o ambos caminos. Logout/cambio de cuenta invalida trabajo pendiente y una
  respuesta en vuelo ya no puede navegar para la cuenta siguiente.

**Evidencia local:** `core/notifications/responseCoordinator.test.ts`, 13/13
casos (sesión tardía, null→login, retry, deny, navegación, ambos órdenes,
identifier ausente/mixto, cold duplicado tardío y logout), incluidos en el
run completo de Vitest descrito abajo. Entrega/tap en dispositivo físico:
**PENDING**.

### Lock DB: dueño vivo, heartbeat y token

- `scripts/dbLock.mjs` adquiere con `wx` (`O_CREAT|O_EXCL`) y escribe
  token aleatorio, pid, hostname, owner, `acquiredAt` y `heartbeatAt`.
  Recupera PID muerto en el mismo host o heartbeat stale de otro host
  mediante quarantine/rename y comparación de los bytes inspeccionados, no
  mediante `exists → unlink → create`. Release vuelve a verificar el token
  sobre el fichero movido y nunca borra un token ajeno.
- `with-db-lock.mjs` usa `spawn` async, heartbeat (15 s por defecto), reenvío
  de señales, `finally` token-safe y conserva el exit code del hijo.
- Playwright usa un proceso holder que permanece vivo desde global setup
  hasta el teardown devuelto por ese setup, con heartbeat durante toda la
  suite. Ya no atribuye el lock a un CLI que termina antes de los tests.
- `DB_LOCK_PATH`, `DB_LOCK_STALE_MS` y `DB_LOCK_HEARTBEAT_MS` permiten pruebas
  aisladas; `.tmp/` está excluido. `scripts/dbLock.test.ts` ejecuta contención
  multiproceso real, token ajeno, PID muerto, heartbeat stale y una operación
  de 350 ms con threshold de 80 ms.

### CI

`.github/workflows/verify.yml` mantiene un único job y una única instancia de
Supabase viva: instala Chromium con dependencias, ejecuta `npm run verify`
(cuyo último paso es `db:test`), después Playwright con `--workers=1`, sube
reporte/resultados al fallo, para Supabase con `if: always()` y dispone de 60
minutos. `playwright.config.ts` mantiene `fullyParallel: false` y `workers: 1`.

**GitHub Actions remoto: PENDING.** El workflow se validó por lectura y por
los mismos comandos localmente; esta pasada no afirma ningún run remoto.

### Ejecución real de esta pasada

```text
npm run typecheck
  → PASS, tsc --noEmit sin errores.

npm run lint
  → PASS, ESLint sin errores y Prettier: "All matched files use Prettier code style!".

npm run test
  → PASS, 18 archivos / 194 tests; incluye scripts/dbLock.test.ts 5/5
    (contención multiproceso real y operación > threshold) y coordinador push 13/13.

npm run verify
  → PASS de punta a punta: typecheck, lint, 18 archivos / 194 tests y las
    10 suites SQL (RLS, acquisition loop, daily loop, timezone, Bible,
    circles, plans, storage, social y push), todas con su banner ASSERTIONS PASSED.

npx playwright test --project=chromium --workers=1
  → PASS, 6/6 en Chromium, un worker, 1.2 min; holder vivo durante reset y suite
    y `.tmp/db.lock` ausente tras el teardown token-safe.

npx vitest run scripts/dbLock.test.ts
  → PASS, 5/5; evidencia enfocada de contención real multiproceso.

git diff --check
  → PASS, sin errores de whitespace (solo avisos LF/CRLF de autocrlf).
```

Siguen **PENDING** todos los externos ya declarados: run real de GitHub
Actions/protección de rama, entrega push/receipts y taps en dispositivos
físicos, EAS/builds, Maestro/ADB, iOS, SMTP/config remota, proveedor de
observabilidad y aprobación/simulacro de safety. Ninguno se infiere de estos
resultados locales.

## 13. Primer ciclo de hallazgos sobre las correcciones finales (2026-08-06)

Se corrigieron los cinco hallazgos recibidos sin commits y preservando el WIP.
El estado global continúa **REJECT** por las dependencias externas ya
enumeradas; esta sección acredita únicamente ejecución local.

### Coordinador push: redrain estable y desmontaje

- Cada entrada pendiente tiene ahora un estado explícito `attemptReady`. Una
  llamada a `drain()` mientras existe otro drain no se limita a coalescer su
  promesa: activa `redrainRequested`, y el mismo drain itera hasta que no haya
  señales nuevas. Así, si vence el retry de A mientras el iterador procesa B,
  vuelve a A en una segunda vuelta sin repetir entradas no listas.
- El test exacto en `responseCoordinator.test.ts` prepara A y B antes de
  restaurar sesión, hace retryable A, dispara su callback desde la resolución
  de B y comprueba la secuencia A → B → A, dos navegaciones y cero pendientes.
- El cleanup de `useNotificationResponseHandler` llama `dispose()`, elimina
  timers y borra la referencia. `ensureCoordinator()` permite que React Strict
  Mode lo recree durante su ciclo setup/cleanup/setup. Dos tests comprueban
  cancelación de retry y ausencia de navegación al terminar una RPC después
  del dispose.

### CI: únicamente configuración pública local

- Tras `supabase start`, el workflow ejecuta `scripts/supabaseCiEnv.mjs`. El
  script consume `supabase status -o env`, selecciona exclusivamente
  `API_URL` y `ANON_KEY`, y escribe mediante delimitadores aleatorios en
  `GITHUB_ENV` como `EXPO_PUBLIC_SUPABASE_URL` y
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- No evalúa ni reenvía el resto de la salida; `SERVICE_ROLE_KEY`, `SECRET_KEY`
  y demás valores privilegiados no forman parte del objeto exportable.
- Verificación local segura: `node scripts/supabaseCiEnv.mjs --check` confirmó
  la presencia de las dos variables seleccionadas sin imprimir sus valores.
  Tres tests sintéticos comprueban selección, formato de `GITHUB_ENV`,
  exclusión de claves privilegiadas y fallo cerrado si falta un valor.
- **Runner GitHub real: PENDING**. No se infiere un run remoto a partir de la
  comprobación local del parser/CLI.

### Pérdida de ownership durante heartbeat

`with-db-lock.mjs` termina inmediatamente el árbol protegido cuando el
heartbeat deja de reconocer el token. En POSIX crea un process group y lo
señala; en Windows usa `taskkill /t /f`, con `child.kill()` como fallback.
El resultado queda fijado en exit 1 y el `finally` conserva el release
token-safe. El test reemplaza el lock durante una operación de 5 s: el wrapper
sale 1 en menos de 2 s y deja intacto el token nuevo.

### Ejecución real de este ciclo

```text
npm run typecheck
  → PASS, tsc --noEmit sin errores.

npm run lint
  → PASS, ESLint y Prettier limpios.

npm run test
  → PASS, 19 archivos / 201 tests.

npx vitest run core/notifications/responseCoordinator.test.ts \
  scripts/dbLock.test.ts scripts/supabaseCiEnv.test.ts
  → PASS, 25/25: coordinador 16/16, lock 6/6, entorno CI 3/3.

node scripts/supabaseCiEnv.mjs --check
  → PASS; detectó solo los nombres públicos seleccionados, sin mostrar valores.

npm run verify
  → PASS completo: typecheck, lint, 19 archivos / 201 tests y 10/10 suites SQL
    (RLS, acquisition loop, daily loop, timezone, Bible, circles, plans,
    storage, social y push), todas con ASSERTIONS PASSED.

npx playwright test --project=chromium --workers=1
  → PASS, 6/6, 1.1 min; `.tmp/db.lock` ausente tras teardown.

git diff --check
  → PASS, sin errores de whitespace; solo avisos LF/CRLF de autocrlf.
```

No se ejecutó GitHub Actions remoto, push en hardware, EAS, Maestro/iOS,
SMTP remoto ni validaciones humanas/operativas. Todos permanecen **PENDING**.
