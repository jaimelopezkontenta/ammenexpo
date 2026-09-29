# Auditoría end-to-end — septiembre 2026

**Fecha:** 2026-09-29 · **Alcance:** todo el repo (app Expo, `core/`, Supabase,
edge functions, tooling, CI) y UI/UX de punta a punta. **Plan:** por oleadas,
fiabilidad primero (decisión de Jaime). Este documento es el diagnóstico y el
estado de ejecución; se actualiza al cerrar cada oleada.

Método: tres exploraciones en paralelo (frontend, backend/infra, UX), los
hallazgos graves verificados a mano en el código y en la base, capturas de las
baselines visuales, y una revisión crítica adversarial del plan antes de
ejecutarlo.

---

## Estado de ejecución

| Oleada | Qué | Commit | Estado |
|---|---|---|---|
| 0a | Rescate de 8 migraciones que solo existían en la base local; guard de migraciones; tipos generados | `d2e129e`, `9cadd9d` | ✅ |
| — | Test del lock de base determinista | `67e13aa` | ✅ |
| Hotfix | U1 salida de «orar por alguien», F4 canje repetido, U2 versículos legibles | `a435728` | ✅ |
| 0b | Cliente de lo rescatado: paginación estable, colas del staff completas, fin de plan de círculo | `8309fb7` | ✅ |
| 1a | Puertas de seguridad: topes de invitación, avatares, 36 índices FK, privilegios, fail-closed | `24bb036` | ✅ (3 puntos esperan decisión) |
| 1b | Programador de colas (pg_cron + pg_net), retención, borrado de cuenta completo | `043b80c` | ✅ (encender en staging: paso de Jaime) |
| 1c | ErrorBoundary, canal de errores, red vs error, frescura, caché offline con fecha | `a14cc72` | ✅ |
| pre-2 | ESLint del contrato, red visual que detecta texto, primitivas compartidas; CTA ilegible en oscuro y fecha mal capitalizada | `259a40b` | ✅ |
| 2a | Bucle central: CTA siempre visible, cuota antes del formulario, invitación que lleva al círculo, `returnTo`, siguiente persona, copiar enlace | `c4499d1` | ✅ |
| 2b (1/2) | Onboarding y generación: pantalla de espera, error con salida, red visual estable | `745bb55` | ✅ |
| 2c | Pantallas secundarias: Orar con todos los planes, bloqueo confirmado, Perfil autoguardado, /p con marca, auth en `<form>`, flag `community_feed` | `8f20420` | ✅ |
| EN-1 | Biblia por versión: catálogo, RPC con `p_version`, World English Bible (156 INSERT) | `f96c536` | ✅ |
| EN-2 | El lector lee en la versión activa (elegida o la del idioma), selector, versículo del día por versión | `860a3f9` | ✅ |
| EN-3 | Los planes se escriben, verifican y guardan en el idioma de la persona | `f7adad4` | ✅ |
| EN-4 | e2e en inglés (interfaz + lector WEB↔RVR + búsqueda) | `e2e/english.spec.ts` | ✅ |
| 3a | Cliente Supabase tipado, fábrica `qk` de claves de caché (184 claves) con ESLint, `isLoadingError` | ver ADR 0006 | ✅ (quedan los `userId!` de `core/**/queries.ts`) |
| 3b | `SessionProvider` + `AppEffects`, Hoy y moderación partidos, `useAction`, `useUserId`, claves de almacenamiento | `1d5ce27` | ✅ |
| 3c | Feeds en `FlatList`, Comunidad partida, chat paginado, lector con `VerseRow` | `e91bc79` | ✅ |
| 3d | Paridad legal, claves versionadas y limpieza al cerrar sesión, tests de lógica pura (sin RNTL: no hay renderizador RN para Vitest) | `ffd2acd`, `1d5ce27` | ✅ parcial |
| 4a | Edge functions: helpers compartidos, validación, presupuesto de reintentos, logs con correlación, 6/6 pasan `deno check` | `65dfe22` | ✅ |
| 4b | Runner `db:test`, cobertura de correo, arreglo de un test intermitente | `01a659b` | ✅ (sin «reset suave»: descartado) |
| 4c | CI: `deno check`, expo-health, Dependabot, baselines Linux, presupuesto de bundle | `b72f610`, `37e5333` | ✅ |
| 4d | HMAC en Vault, rotación de tokens de invitación, CSP + HSTS + COOP, presupuesto de bundle | `01a659b`, `37e5333` | ✅ (sin UI de rotación) |
| Revisión | 3 revisiones adversariales (SQL, edge/CI, frontend) → 30 hallazgos corregidos | `4ac610f`, `436bcdd` | ✅ |
| 5 | Sistema visual: `ScreenScaffold` en 9 pantallas más, `GlassIconButton`, variantes de `Txt`, tope de fuente, contraste del badge, escala de espaciado | `29ebdb7` | ✅ (H1: decisión de Jaime) |
| 6 | Lote nativo (SecureStore, NetInfo, copiar enlace, exportar fichero, crisis por país, EAS y universal links preparados) | `d9a7c0a` | ✅ código, **sin verificar en dispositivo** |
| Web | Iconos por ruta: bundle de entrada 5,37 → 3,45 MB | `16dfe5f` | ✅ |

Lo que quedó **fuera de esta auditoría** o solo a medias está en
`docs/runbooks/pendientes-del-dueno.md` (staging, decisiones, cuentas y
dispositivos). Hallazgos del propio proceso de ejecución: el CLI de Supabase
(JavaScript) parte mal una migración con una etiqueta de dollar-quote en un
comentario (colgó `supabase start` en CI); el `deno.lock` de CI rompía el
edge-runtime local; las fechas del día real caducaban las baselines visuales cada
medianoche. Los tres están corregidos y con guard o test.

### Lo que depende de Jaime

- **Staging** (estaba pausado el 2026-09-29): restaurarlo, `db push` según
  `docs/runbooks/staging-web.md` (sección «Migraciones rescatadas»),
  desplegar las funciones de correo y push, crear en Vault
  `ammen_email_invoke_secret` / `ammen_push_invoke_secret` y encender
  `scheduler_settings`. Hasta ese push sigue abierta en staging la fuga del
  chat de círculos para quien sale.
- **`AMMEN_EMAIL_INVOKE_SECRET` y `AMMEN_PUSH_INVOKE_SECRET` son obligatorios**
  fuera de local desde la 1a (fail-closed).
- Decisiones abiertas: captcha en el alta (Turnstile), tope de gasto de
  Anthropic, confirmación de email, plazos de retención definitivos, opt-in
  por defecto del correo no transaccional (LSSI), datos de categoría especial
  (Art. 9) y región de producción.

---

## Hallazgo urgente (resuelto en 0a)

La base local tenía aplicadas ocho migraciones sin fichero en el repo ni en
git: `export_personal_collections`, `circle_chat_membership` (quien salía de
un círculo seguía leyendo y escribiendo el chat), `visible_comment_counts`,
`reservation_owner_date`, `circle_plan_completion`,
`reported_content_moderation`, `open_crisis_queue` y `stable_list_pagination`.
Su SQL solo vivía en `schema_migrations.statements`; un `db reset` lo habría
borrado. Rescatado en `supabase/rescue/2026-09-29/`, reintegrado como
migraciones idempotentes, cubierto por `supabase/tests/rescued.sql` y blindado
con `npm run migrations:check` (también en CI) y un chequeo en `npm run doctor`.

---

## Hallazgos — UI/UX

Lo ya hecho en Amanecer 2.0–4.0 no se re-propone.

**Críticos**
- U1 · Tras canjear un enlace e iniciar sesión, «orar por alguien» no tenía
  salida (`router.back()` sin historial). ✅ hotfix.
- U2 · El label de cada versículo sustituía su texto: un lector de pantalla
  no leía la Escritura. ✅ hotfix.
- U3 · La cuota de planes (3) se descubre al enviar el formulario entero; un
  plan de círculo gasta cupo sin decirlo.
- U4 · «Ya oré hoy» queda bajo el pliegue en 390×844; «Quién oró por ti» solo
  aparece tras marcar.
- U5 · Compartir (el bucle social) solo vive en el sheet `···`; no hay «Copiar
  enlace» en nativo.
- U6 · Tras `/c/{token}` se aterriza en Hoy, no en el círculo; invitar queda
  bajo el pliegue; «Unirme» se muestra a miembros.
- U7 · UI en inglés con Biblia y planes solo en español; recursos de crisis
  solo de España.

**Importantes**: el login pierde el destino (`returnTo`); la generación del
primer plan es un spinner sin copy y su error se traga; permiso push sin
explicación previa; Orar lista solo el primer plan; bloquear sin
confirmación; tres modelos de guardado en Perfil; «Exportar mis datos»
escondido; `/p/[token]` (la página de adquisición) sin marca; `ErrorState` no
distinguía red en nativo (✅ 1c); push solo resuelve a `/` o `/avisos`.

**Sistema visual**: 27 pantallas montan su scaffold a mano; el botón redondo
de vidrio está copiado 7 veces; H1 inconsistente; sin `maxFontSizeMultiplier`;
sin `<form>` en auth web; y **la red visual no detecta cambios de texto**
(`maxDiffPixelRatio: 0.02`: baselines con «Buenas tardes» y «Círculos»
pasaban).

---

## Hallazgos — arquitectura del frontend

Se conserva: `core/` por dominio, React Query como único estado de servidor,
cero `any`, cero `<Text>` crudo, paridad i18n con test, `Tap` con rol en todos
los usos.

- Sin ErrorBoundary ni reporte de errores. ✅ 1c.
- Sin refresco al volver del fondo; versículo del día sin caducidad. ✅ 1c.
- Tipos de la base escritos a mano (~96 `userId!`, 26 `as unknown as`).
  `types/supabase.ts` ya se genera y CI vigila la deriva (0a); adoptarlo es 3a.
- Token de share re-canjeado en cada arranque. ✅ hotfix.
- `nativewind: "latest"`. ✅ 1a.
- God components: `app/(tabs)/index.tsx` 847 líneas, `moderacion.tsx`,
  `CommunityPane.tsx`.
- Sin fábrica de query keys (173 claves inline); errores mixtos; `SessionProvider`
  con demasiadas responsabilidades; `run()` copiado 9 veces; feeds paginados con
  `ScrollView` + `.map`; chat sin paginar; 0 tests de `queries.ts` y de
  componentes; ESLint no protege el contrato; sin universal links.

## Hallazgos — backend, infra y tooling

Se conserva: RLS en todas las tablas, `SECURITY DEFINER` con `search_path`
vacío, `anon` sin acceso a tablas, `service_role` nunca en el cliente,
generación con el JWT del usuario.

- Nada enviaba las colas en ningún entorno. ✅ 1b.
- Versionado de migraciones roto (contador a mano, colisión). ✅ 0a (guard).
- Abuso de invitaciones por email (sin tope por remitente). ✅ 1a.
- Drenajes fail-open sin secreto. ✅ 1a.
- Avatares: bucket listable, URL con cualquier host. ✅ 1a (queda el resquicio
  de otro proyecto de Supabase; cerrarlo = guardar solo la ruta).
- 36 claves foráneas sin índice. ✅ 1a.
- `delete_my_account` dejaba correo y la foto. ✅ 1b.
- El edge runtime local no servía las funciones de correo (contenedor del
  28-08). ✅ 1b (`doctor` lo avisa).
- Pendiente: validación con esquema y presupuesto de reintentos en la
  generación, `claude-sonnet-5-5`, `deno.lock` y `deno check` en CI, helpers
  duplicados entre funciones, 13 resets de base por `verify` (pgTAP), CSP en
  Hosting, tamaño del bundle web, secreto HMAC del correo en Vault.
- Nativo: `usesCleartextTraffic` y `allowBackup` en release ✅ 1a; queda el
  lote nativo (NetInfo, clipboard, SecureStore, file-system), EAS y Maestro.

---

## Verificación de lo ejecutado

Cada oleada: `typecheck`, `lint`, `test` (vitest), `db:test` (15 suites),
`e2e` (Playwright, 25 tests) y CI en verde tras el push. Los arreglos de bugs
llevan un test que falla con el código anterior (share-loop para U1,
`pendingToken.test.ts` para F4, la mutación de `is_conversation_member` para
la fuga del chat).
