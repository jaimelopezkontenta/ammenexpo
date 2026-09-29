# Runbook — CI

Todo vive en `.github/`. Nada de CI despliega: los deploys los hace una persona.

## Qué corre

| Workflow / job               | Cuándo                       | Bloquea | Qué mira                                                                                                                |
| ---------------------------- | ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `verify` · `verify`          | PR y push a `main`           | sí      | Guard de migraciones, tipos de la base, `npm run verify`, Playwright bajo la CSP, el visual y el presupuesto del bundle |
| `verify` · `functions-types` | ídem, en paralelo            | sí      | `deno check` de las seis edge functions                                                                                 |
| `verify` · `expo-health`     | ídem, en paralelo            | no      | `expo-doctor` y `expo install --check` (hoy fallan los dos; ver abajo)                                                  |
| `visual-baselines`           | a mano (`workflow_dispatch`) | —       | Genera las baselines Linux de la regresión visual y las sube como artefacto                                             |
| Dependabot                   | semanal                      | —       | Acciones de GitHub; en npm solo avisos de seguridad                                                                     |

El job `verify` corre en un runner efímero con Supabase local, así que serializa
base y e2e por construcción. Los otros dos no levantan Supabase.

Pasos de `verify`, en orden: checkout con historia completa → `npm ci` → guard de
migraciones → Chromium → `AI_PROVIDER=fixture` → `supabase start` → tipos de la
base contra las migraciones → `supabaseCiEnv` → `npm run verify` (typecheck, lint,
vitest, `db:test`) → Playwright `chromium` → regresión visual (condicionada) →
presupuesto del bundle web.

## El e2e estático corre bajo la CSP de producción

`scripts/e2eWebServer.mjs` sirve `dist-e2e` con las cabeceras de `firebase.json`
(las lee `scripts/webHeaders.mjs`, que las aplica como Firebase: todas las reglas
que casan con la ruta pedida, y la última gana), CSP incluida. Solo añade, para el
e2e, el origen de `EXPO_PUBLIC_SUPABASE_URL` (`http://` y `ws://`) a `connect-src`
e `img-src`, y un `report-uri /__csp-report`. Si falta esa variable, el servidor
no arranca: sin ella la CSP bloquearía todo sin decir por qué.

- **Una violación** sale en el log de Playwright (el `webServer` enseña su stderr):
  `[e2e-web] CSP bloqueó connect-src: https://… en http://127.0.0.1:8081/…`.
  `GET http://127.0.0.1:8081/__csp-report` devuelve la lista entera, para que un
  test pueda afirmar que está vacía. Un `fetch` bloqueado rompe el flujo que lo
  usa; una imagen o una fuente bloqueadas solo se ven ahí o en el visual.
- **Qué no cubre:** el export del e2e es `single` y usa la plantilla de Expo, sin
  `app/+html.tsx`, así que no lleva los dos `<script>` inline que la CSP permite
  por hash (el del tema y la bandera de hidratación de Expo Router). Esos los
  vigilan `scripts/cspHashes.test.ts` (vitest) y `npm run csp:check` sobre el
  build de staging (`docs/runbooks/staging-web.md`).
- **Metro** (`npm run e2e`, `npm run web`) no aplica cabeceras: la CSP solo se
  ejerce contra el export.
- **Si cambias la CSP** en `firebase.json`, el e2e la hereda sin tocar nada más.
  Si cambias el script del tema, `npm run csp:hashes` da el hash nuevo.

## Presupuesto del bundle web (`npm run bundle:budget`)

Trinquete del tamaño del JS del export: `scripts/bundleBudget.mjs` mide el chunk
de entrada (`_expo/static/js/web/entry-*.js`) y el total de JS de `dist-e2e`, en
bruto y en gzip (zlib, nivel por defecto), y falla si alguno pasa de
`bundle-budget.json`. En CI corre justo después de los e2e estáticos y reutiliza su
export. En local, tras `npm run e2e:static` (o sobre otro export:
`node scripts/bundleBudget.mjs dist`).

- **Límite = lo medido + 5 %.** El 2026-09-29 (`b9fb720`): entrada 5.374.282 B
  (1.042.101 B gzip), un solo fichero JS.
- **Si falla:** mirar qué entró (el diff de `package.json` y los imports nuevos;
  «Qué pesa», abajo, dice cómo medirlo). Si el crecimiento es deliberado, subir el
  límite en el mismo PR y explicar qué entra y por qué. Nunca «hasta que pase».
- **Si baja:** el script imprime `↓ … aprieta el trinquete` con el límite nuevo
  cuando el ahorro pasa del 5 %. Copiarlo a `bundle-budget.json` en ese PR, y
  actualizar `measured`.
- Con bundle splitting (rutas asíncronas, `import()`), la entrada baja y el total
  no: por eso se miden los dos.

## Qué pesa

Medido sobre `dist-e2e` de `b9fb720` sin source map: el bundle de Metro en
producción no lleva rutas, así que se reconstruyó el grafo de módulos (`__d(…, id,
[deps])`) y se calculó el **tamaño retenido** de cada dependencia (lo que saldría
del bundle si ese import desapareciera; árbol de dominadores). El gzip de cada fila
es aproximado (comprimida sola). KB = 1.000 bytes.

| #   | Dependencia                                                                         | Bruto    | gzip   | % bruto |
| --- | ----------------------------------------------------------------------------------- | -------- | ------ | ------- |
| 1   | `lucide-react-native` (el barril: 1.759 iconos; se usan 10)                         | 1.848 KB | 185 KB | 34 %    |
| 2   | `react-native-reanimated` (con worklets)                                            | 736 KB   | 140 KB | 14 %    |
| 3   | `@supabase/supabase-js`                                                             | 273 KB   | 68 KB  | 5 %     |
| 4   | `react-native-gesture-handler` (con hammerjs en web)                                | 246 KB   | 56 KB  | 5 %     |
| 5   | `react-native-view-shot` → html2canvas (solo «compartir versículo»)                 | 208 KB   | 49 KB  | 4 %     |
| 6   | `react-dom`                                                                         | 180 KB   | 57 KB  | 3 %     |
| 7   | i18n: `es.json` + `en.json` (66), i18next (50), react-i18next (24)                  | 140 KB   | 43 KB  | 3 %     |
| 8   | `@tanstack/react-query`                                                             | 84 KB    | 19 KB  | 2 %     |
| 9   | `expo-notifications` (en web no se usa)                                             | 62 KB    | 15 KB  | 1 %     |
| 10  | `react-native-svg`                                                                  | 50 KB    | 14 KB  | 1 %     |
| 11  | `expo-image`                                                                        | 37 KB    | 12 KB  | 1 %     |
| —   | Resto: react-native-web, expo-router y react-navigation, nativewind, React y la app | 1.500 KB | 376 KB | 28 %    |

Fuera del JS, en el camino crítico: `app/_layout.tsx` no pinta hasta cargar siete
TTF (General Sans ×4, Cormorant Garamond 400 Italic y Lora 400/600), unos 940 KB;
solo la Cormorant cursiva son 407 KB porque trae cirílico y vietnamita. Y el export
lleva otras 18 variantes que nadie pide, porque importar desde la raíz de
`@expo-google-fonts/<familia>` arrastra todas.

Recomendaciones, de más barata a menos (ninguna aplicada):

1. **Iconos por ruta.** `import ChevronLeft from "lucide-react-native/icons/chevron-left"`
   (el paquete exporta `./icons/*` con tipos) en los 14 ficheros que importan del
   barril, y una regla `no-restricted-imports` para `lucide-react-native` (con
   `allowTypeImports`, por `LucideIcon`). Mecánico: −1,8 MB en bruto (−34 %), unos
   −185 KB gzip.
2. **html2canvas bajo demanda.** `await import("react-native-view-shot")` dentro de
   `useShareVerseImage` (`core/bible/image.ts`). En el export web de producción un
   `import()` se carga con `<script src>` del mismo origen
   (`expo/src/async-require/fetchThenEval.web.ts`), compatible con la CSP; el
   `eval` de ese módulo es solo de desarrollo. −208 KB de la entrada (comprobar en
   el export que sale un chunk aparte y bajar `entry*` en el presupuesto).
3. **`expo-notifications` fuera de web.** Variantes `.web.ts` sin efecto de
   `core/notifications/push.ts` y `localReminders.ts`: −62 KB.
4. **Fuentes.** Importar cada variante por su ruta
   (`@expo-google-fonts/cormorant-garamond/400Regular_Italic`) quita las 18 que
   sobran del export; un subconjunto latino en woff2 de la Cormorant cursiva la
   dejaría en decenas de KB (pide generar el fichero con fonttools, una vez).
5. **Medio plazo: partir por rutas.** `asyncRoutes` de expo-router en web o el
   tree shaking de Expo (`EXPO_UNSTABLE_TREE_SHAKING=1` +
   `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1`, todavía «unstable» en SDK 56, que
   también podaría los barriles de reanimated). Probar en una rama y medir con
   `bundle:budget`; las rutas asíncronas también se cargan con `<script src>`.

Para repetir la medición: separar el bundle por `__d(` (cada módulo acaba en
`},<id>,[<deps>]);`), construir el grafo desde los `__r(<id>)` finales y buscar
los nodos que dominan más bytes. Con `expo export --source-maps` (y
`source-map-explorer`) sale por paquete sin reconstruir nada.

## Regenerar las baselines Linux

Las baselines de `e2e/**-snapshots/` son `*-win32.png`; Playwright añade la
plataforma al nombre y en Linux ninguna casa. Por eso la suite visual solo corre
en CI cuando existen `*-linux.png` (`hashFiles('e2e/**/*-linux.png') != ''` en
`verify.yml`). Se generan en el propio runner de CI, no a mano:

```bash
gh workflow run visual-baselines.yml --ref <rama>
gh run watch                                    # elige el run recién lanzado
gh run download <id> -n visual-baselines-linux -D .
git status                                      # e2e/**-snapshots/*-linux.png
```

El artefacto trae las rutas relativas a la raíz (`e2e/visual.spec.ts-snapshots/…`),
así que `-D .` las deja en su sitio. Después:

1. **Revisar cada captura** contra la baseline de Windows (ADR 0003: las baselines
   se regeneran a propósito, con el diff revisado, nunca «hasta que pase»).
2. Commitear **el juego completo** (`git add e2e`). Con capturas sueltas, las que
   falten se escriben y dan el test por fallado.
3. Las `*-win32.png` se quedan: son las de quien corre `npm run e2e:visual` en Windows.

Notas:

- El workflow hace una **segunda pasada sin actualizar**. Si falla, las baselines
  recién generadas no se reproducen contra sí mismas: no commitear, mirar el
  artefacto `playwright-visual-failure-<id>`.
- `gh workflow run` solo encuentra el workflow si el fichero está en la rama por
  defecto; la rama a probar va en `--ref`.
- Regenerar cuando cambie a propósito algo visible y cuando GitHub cambie el
  contenido de `ubuntu-latest` (fuentes, Chromium): un fallo visual sin cambio de
  código en el diff huele a eso. Se puede fijar `ubuntu-24.04` en los dos
  workflows para no depender de ello.
- Las capturas de un run visual fallido en `verify` están en el artefacto
  `playwright-failure-<id>` (`test-results/`, con el diff).

## Leer un fallo del guard de migraciones

`node scripts/checkMigrations.mjs --base <sha>` (en CI, la base del PR o el commit
anterior al push; en local, `npm run migrations:check` contra `origin/main`). Cada
línea `✗` es un problema; ADR 0001 explica el porqué.

| Mensaje                                                           | Qué pasó                                              | Qué hacer                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `el nombre no es <14 dígitos>_<snake_case>.sql`                   | Fichero a mano o mal nombrado                         | Borrarlo y generarlo con `npx supabase migration new <nombre>`              |
| `repite la versión … de …`                                        | Dos ficheros con el mismo número (típico de un merge) | `db push` compara versiones: renombrar el nuevo con un timestamp posterior  |
| `ya estaba publicada y se ha editado — añade una migración nueva` | Se tocó una migración que ya está en `main`           | Revertir el cambio en ese fichero y poner el arreglo en una migración nueva |
| `ya estaba publicada y se ha borrado`                             | Se borró una migración de `main`                      | Restaurarla                                                                 |
| `es nueva pero su versión no es posterior a la última publicada`  | La rama nació antes que otra migración ya mergeada    | Renombrar la nueva con un timestamp posterior a `main` y rebasar            |
| `No se pudo leer la ref base «…»`                                 | Falta historia (fetch superficial)                    | El checkout de CI lleva `fetch-depth: 0`; en local, `git fetch origin`      |

Una excepción real (un `migration repair` en staging) va en
`IMMUTABILITY_EXCEPTIONS`, con su motivo, dentro del propio script.

## `functions-types`: el `deno check` de las edge functions

`npm run typecheck` y ESLint no miran `supabase/functions/` (es Deno), así que
un error de tipos ahí solo aparecía al desplegar. El job hace `deno check
--frozen` sobre el `index.ts` de cada función, sin Supabase ni `npm ci`.

- **Deno 2.1.4, fijo.** Es la línea del edge-runtime que ejecuta las funciones
  (`deno_version = 2` en `supabase/config.toml`; su `Cargo.toml` depende de
  `deno_core` 0.324, de la época de Deno 2.1: es una deducción, no una versión
  publicada). El chequeo de tipos cambia con el TypeScript de cada Deno: subirlo es
  una decisión.
- **`supabase/functions/deno.json`** solo fija `nodeModulesDir: none`. Sin él, con
  el `package.json` de la raíz a la vista, Deno resolvía los `npm:` contra el
  `node_modules` de la app (`@anthropic-ai/sdk` ni resolvía y `supabase-js` salía
  de la versión de la raíz, no de la del especificador).
- **`supabase/functions/deno.ci.lock`** fija lo que resuelven los rangos
  (`^2.58.0`, `^0.70.0`). Con `--frozen`, un especificador nuevo o cambiado hace
  fallar el job con «The lockfile is out of date». Se actualiza desde
  `supabase/functions/`:

  ```bash
  npx --yes deno@2.1.4 check --lock=deno.ci.lock --frozen=false send-email/index.ts enqueue-emails/index.ts \
    email-unsubscribe/index.ts resend-webhook/index.ts send-intercession-push/index.ts \
    generate-prayer-plan/index.ts
  ```

  Para subir versiones dentro del rango, borrar `deno.ci.lock` antes; revisar el diff:
  un `supabase-js` o un SDK más nuevo puede destapar errores nuevos. Dependabot no
  toca este lock.

- **Por qué no se llama `deno.lock`:** el edge-runtime de `supabase start` lee `deno.lock` al arrancar
  cada worker y muere si no puede resolver una versión que fija («failed reading lockfile … Could
  not find '@supabase/postgrest-js@2.117.2'»): con el lock de CI, `generate-prayer-plan` no arrancaba
  en local y el e2e `fresh-account` fallaba. Con otro nombre, más `"lock": false` en `deno.json`,
  el runtime lo ignora y CI lo pasa con `--lock=deno.ci.lock` (2026-09-29).
- **Sin `--frozen` local:** `npx --yes deno@2.1.4 check <entradas>` baja el binario
  a la caché de npx (no a `node_modules`) y sirve para comprobar antes de subir.
- Los `*.test.ts` no se chequean aquí: son de Vitest.

### Estado de los tipos (a fecha 2026-09-29)

Las seis funciones pasan `deno check --frozen` y todas son bloqueantes. Antes,
`generate-prayer-plan` traía 3 errores y su paso era un trinquete (`KNOWN_ERRORS`);
se arreglaron: uno con el tipo de `title` y dos declarando en
`providers/anthropic.ts` los tipos de `output_config`, `thinking: adaptive` y
`stop_details`, que el SDK fijado (`@anthropic-ai/sdk@0.70.1`) aún no conoce pero
la API sí (viajan en el cuerpo y en la respuesta tal cual; no se ha probado contra
la API real). Al subir el SDK a una versión que los tipe, esos tipos locales sobran.

**Latente con un Deno más nuevo:** con Deno ≥ 2.5 (TypeScript 5.9)
`resend-webhook/svix.ts:55` deja de compilar (TS2769: `Uint8Array<ArrayBufferLike>`
no es `BufferSource` en `crypto.subtle.importKey`). Medido con 2.5.7, 2.7.14 y
2.9.6; con 2.1.4, 2.3.7 y 2.4.4 pasa. Habrá que arreglarlo antes de subir la versión
de Deno del job.

## `expo-health`

`expo-doctor` y `expo install --check` con `continue-on-error` y una anotación
`::warning::` si fallan. A 2026-09-29 los dos fallan sobre `main`:

- `expo install --check`: 10 paquetes de SDK 56 con parches por detrás
  (`expo` 56.0.18 vs `~56.0.23`, `expo-router` 56.2.17 vs `~56.2.21`, `expo-image`,
  `expo-image-picker`, `expo-linking`, `expo-notifications`, `expo-sharing`,
  `expo-splash-screen`, `expo-constants`, `@expo/metro-runtime`). Se arregla con
  `npx expo install --fix` (toca `package.json` y el lock).
- `expo-doctor` (20 de 22): esa misma comprobación de versiones y una que consulta
  un aviso remoto («Hermes V1 con regresión de memoria» en `expo@56.0.18`; lo
  arregla `expo` ≥ 57.0.9 o React Native ≥ 0.86.2).

Al dejar el repo al día, quitar el `continue-on-error` de `expo install --check`
(es determinista). `expo-doctor` no debería ser bloqueante: parte de su resultado
depende de datos remotos.

## Dependabot

`.github/dependabot.yml`: acciones semanales agrupadas; npm con
`open-pull-requests-limit: 0`, es decir, solo avisos de seguridad. El bloque
`ignore` (Expo, React Native, React, NativeWind) solo afecta a las actualizaciones
de versión: hoy no filtra nada, y un aviso de seguridad de un paquete de Expo sí
abrirá su PR.

## Abierto

- **`supabase start -x studio,vector,logflare`** en `verify.yml` es un experimento
  (commit aparte, revertible) que no se pudo probar sin Docker. Mirar en el primer
  run: que arranque (con `[analytics] enabled = true`, excluir `vector` podría
  dejar contenedores esperando su driver de logs) y que `supabase status -o env`
  siga devolviendo `API_URL` y `ANON_KEY`. Si falla: volver a `npx supabase start`.
  `visual-baselines.yml` usa el arranque completo a propósito.
- **Baselines Linux:** todavía no hay ninguna commiteada; el paso visual de
  `verify` está inactivo hasta entonces.
