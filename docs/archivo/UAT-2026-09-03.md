# UAT Ammen — usuario beta (web)

**Fecha:** 2026-09-03  
**Scope:** UAT completo local + smoke staging. Journeys de usuario beta + visual claro/oscuro.  
**Fuera de alcance:** nativo (Maestro/dispositivo/EAS), cola staff/moderación interna, privacy SQL, pagos/Stripe/IAP, push real, commits.

## Gate full (cierre de sesión)

Corrido al cierre con `gate full:true`. **PASS** (ola de desbloqueo, 2026-09-03).

Salida literal (orquestador):

```
GATE: PASS
  typecheck        PASS        3.6s  npm run typecheck
  lint             PASS       12.0s  npm run lint
  test             PASS        2.4s  npm run test
  db:test          PASS      498.5s  npm run db:test
```

Revisor reprodujo el mismo gate (`db:test` 493.0s) y emitió **APPROVE**.

Qué se tocó para desbloquear (mínimo, sin terminar el feature de correo): Prettier de 20 archivos; mocks `ProcessEnv` en `scripts/secretsSync.test.ts`; JSDoc en `resolveTargets`; `shell: true` en Windows para `npx.cmd` en `scripts/supabaseDbReset.mjs` (era `EINVAL`, por eso `db:test` moría a los 0.8 s).

Redeploy de `ammen-staging`: **hecho** (2026-09-03). `build:web:staging` sin localhost; Hosting vía API REST + `gcloud auth print-access-token` (Firebase CLI no tenía sesión). Release `62272a6ce6eb59e7`. Last-Modified **Thu, 03 Sep 2026 03:56:52 GMT**. Smoke curl + navegador OK. No se desplegaron Edge Functions de correo.

## Score: 93 / 100

La app web local está lista para un beta tester: entra, reza, lee, se junta y sale sin romperse. El modo oscuro se entiende. Staging público ya es el build de hoy y no se filtra a localhost.

Se resta por dos cosas que un founder debe saber, no por drama de producto:

1. **Un aviso de accesibilidad** en login: el campo de contraseña no va dentro de un `<form>` (Chrome lo dice; no bloquea).
2. **Nativo no se tocó** (acordado). El tap de recordatorio y Maestro siguen sin evidencia en dispositivo.

El 7 que falta no es “la app web está mal”. Es “el teléfono no está certificado”, más un detalle de formulario.

---

## Qué se ejecutó

| Capa | Resultado | Evidencia |
|---|---|---|
| E2E Playwright chromium local | **24 passed (2.2 min)** | `npm run e2e` — auth, baseline seeds, círculos, correo, alta, invitar, moderación, peticiones, Orar, privacy, public-contract, share-loop |
| E2E visual + dark local | **11 passed (6.9 min)** | `npm run e2e:visual` — onboarding móvil/escritorio, entrar/crear-cuenta, pantallas con sesión en claro, subset oscuro. Cero diffs de snapshot |
| qa-visual local (usuario real) | **10/10 flujos OK** | Chrome contra `http://127.0.0.1:8081` + seed `prueba@ammen.local`. Capturas `qa-*` (no staging) |
| Smoke staging (build 28-08, luego redeploy 03-09) | **PASS** | curl 200; `robots.txt` = `Disallow: /`; `X-Robots-Tag: noindex, nofollow, noarchive`. Post-deploy Last-Modified **2026-09-03 03:56:52 GMT**. Navegador `qa-staging2-*`: 7 flujos públicos OK, red solo a `syprzdjznuppckenuaua.supabase.co` |

Infra local usada: Docker Desktop 29.7.2, `npm run db:start` (API `127.0.0.1:54421`), `npm run web` en `127.0.0.1:8081`.

---

## Journeys beta (local)

Cuenta: `prueba@ammen.local` / `ammen1234` (solo local; **nunca** en remoto).

| # | Journey | Estado | Notas |
|---|---|---|---|
| 1 | Auth (vacío, error, login OK) | OK | Error “Correo o contraseña incorrectos.” Login aterriza en Hoy |
| 2 | Hoy | OK | Plan “Confiar cuando no veo el camino”, Día 4/14. Tabs Reflexiona / Aplica / Ora. “Ya oré hoy” → racha + “Quién oró por ti” |
| 3 | Biblia | OK | Listado, Salmos 23, selector de capítulos, menú de versículo (subrayar / nota / compartir) |
| 4 | Orar | OK | Mis planes, Mi lista, Por otros. Detalle de compartir (perfil / círculos / enlace). No se disparó generación IA |
| 5 | Juntos | OK | Círculo “Familia” (2 miembros), chat, invitar, peticiones, tabs Comunidad / Peticiones |
| 6 | Perfil | OK | Identidad, horas, idioma, zona de peligro. Banner de zona horaria del host (`Asia/Singapore`) — es el PC, no un bug de producto |
| 7 | Crisis | OK | Copy de apoyo, privacidad, 024 y 112. Sin simular una crisis real |
| 8 | Plus | OK | Waitlist, “Cobro: no todavía.” Alta local: “Quedaste en la lista” |
| 9 | Oscuro | OK | Emulación `prefers-color-scheme: dark` en Hoy, Biblia, Orar, Juntos, Perfil. La barra de tabs sigue en melocotón de marca (contrato visual: marca fija) |
| 10 | Logout | OK | Vuelve a `/entrar` |

Red local: 100 % a `http://127.0.0.1:54421`. Cero llamadas a staging. Consola sin excepciones de app; warnings conocidos de Reanimated easing en web y de `expo-notifications` en web.

---

## Staging (público)

Hosting: `https://ammen-staging.web.app` · Last-Modified **Thu, 03 Sep 2026 03:56:52 GMT** (antes: 28 Aug 2026). ETag nuevo `29cf44cf3bf84f3b…`.

| Ruta | HTTP | Navegador |
|---|---|---|
| `/` | 200 → redirige a `/entrar` | OK |
| `/entrar` | 200 | OK — validación + error de credenciales contra Supabase remoto |
| `/crear-cuenta` | — | OK — solo UI, sin alta real |
| `/recuperar` | — | OK |
| `/nueva-contrasena` | 200 | OK — mínimo 8 caracteres |
| `/p/token-invalido` | 200 | OK — “Este enlace ya no está disponible” |
| `/crisis`, `/plus`, `/legal/privacidad` sin sesión | — | Redirigen a `/entrar` (esperado) |

`robots.txt`: `User-agent: *` / `Disallow: /`.  
Red: `syprzdjznuppckenuaua.supabase.co` sí; localhost no.

No hay sesión autenticada en staging (regla: no reutilizar seeds locales en remoto).

---

## Hallazgos

### Bloqueantes

Ninguno en el scope de este UAT.

### Menores (no bloquean beta web local)

1. **Login: password fuera de `<form>`.** Chrome: `[DOM] Password field is not contained in a form`. Repro: abrir `/entrar` o `/crear-cuenta` con consola. Captura: `.opencode/capturas/qa-staging-entrar-01-inicial.png`. No impide entrar.
2. **Reanimated easing no soportado en web.** Warning de consola, no crash.

### Fuera de alcance (no son fallos de este UAT)

- Push real / tap de recordatorio en dispositivo (`docs/runbooks/push-b4.md`).
- Maestro Android (`maestro/android/*` scaffold, nunca ejecutado).
- Cola staff, export SQL, Stripe/IAP.
- Generación de plan con IA (no se invocó a propósito).

---

## Capturas

Directorio: `.opencode/capturas/`

### Local

`qa-auth-1-entrar.png`, `qa-auth-1-error-vacio.png`, `qa-auth-2-error.png`, `qa-auth-2-error-invalido.png`, `qa-auth-3-login-ok.png`, `qa-hoy-1-home.png`, `qa-hoy-1-landing.png`, `qa-hoy-2-tab-aplica.png`, `qa-hoy-3-tab-ora.png`, `qa-hoy-4-modal-este-plan.png`, `qa-hoy-5-oraste-hoy.png`, `qa-biblia-1-libros.png`, `qa-biblia-2-capitulo.png`, `qa-biblia-3-selector-capitulos.png`, `qa-biblia-4-salmos-23.png`, `qa-biblia-5-acciones-versiculo.png`, `qa-orar-1-tab.png`, `qa-orar-2-detalle.png`, `qa-juntos-1-circulos.png`, `qa-juntos-2-circulo-detalle.png`, `qa-juntos-3-invitar.png`, `qa-juntos-4-peticiones.png`, `qa-juntos-5-tab-peticiones.png`, `qa-juntos-6-tab-comunidad.png`, `qa-perfil-1-opciones.png`, `qa-crisis-1-ui.png`, `qa-plus-1-waitlist.png`, `qa-plus-2-confirmacion.png`, `qa-oscuro-1-hoy.png`, `qa-oscuro-2-biblia.png`, `qa-oscuro-3-orar.png`, `qa-oscuro-4-juntos.png`, `qa-oscuro-5-perfil.png`, `qa-logout-1-entrar.png`

### Staging

Pre-redeploy (28-08): `qa-staging-home-01.png`, `qa-staging-entrar-01-inicial.png`, `qa-staging-entrar-02-validacion-vacio.png`, `qa-staging-entrar-03-campos-rellenos.png`, `qa-staging-entrar-04-error-credenciales.png`, `qa-staging-entrar-mobile.png`, `qa-staging-crear-cuenta-01.png`, `qa-staging-crear-cuenta-02-validacion-vacio.png`, `qa-staging-recuperar-01.png`, `qa-staging-recuperar-02-validacion-vacio.png`, `qa-staging-nueva-contrasena-01.png`, `qa-staging-nueva-contrasena-02-validacion-vacio.png`, `qa-staging-plan-invalido-01.png`, `qa-staging-ruta-crisis-redirect.png`

Post-redeploy (03-09): `qa-staging2-raiz-redirect.png`, `qa-staging2-entrar-validacion-vacia.png`, `qa-staging2-entrar-credenciales-invalidas.png`, `qa-staging2-crear-cuenta-ui.png`, `qa-staging2-crear-cuenta-validacion.png`, `qa-staging2-recuperar-ui.png`, `qa-staging2-recuperar-validacion.png`, `qa-staging2-nueva-contrasena-ui.png`, `qa-staging2-nueva-contrasena-validacion.png`, `qa-staging2-token-invalido-ui.png`, `qa-staging2-correo-redirect-entrar.png`

---

## Cómo repetirlo

```powershell
npx supabase start          # o npm run db:start
npm run web                 # nunca npm run dev
npm run e2e
npm run e2e:visual
```

Staging (sin seeds):

```powershell
curl.exe -I https://ammen-staging.web.app/
curl.exe -I https://ammen-staging.web.app/entrar
curl.exe -I https://ammen-staging.web.app/p/token-invalido
curl.exe -I https://ammen-staging.web.app/nueva-contrasena
curl.exe https://ammen-staging.web.app/robots.txt
```

---

## Veredicto

**Go para beta privada en web local.**  
**Go para staging público** (auth anónima / landing; sin seeds locales). Hosting al día (03-09). Edge Functions de correo no iban en este deploy.  
**No-go nativo** hasta dispositivo/EAS.

Si el siguiente paso es arreglar algo de esta lista, hay que pedirlo: este UAT no cambia código a propósito.
