# Amanecer 3.0 — Plan maestro de mejora UI/UX de Ammen

> **Progreso** (2026-08-28):
> - ✅ F0 baseline: visual 4/4 verde; funcional 18/18 verde en aislamiento (la suite completa flakea en esta máquina bajo carga — usar CI como árbitro).
> - ✅ FB.0 motion v2 (`SPRING`/`AMBIENT`/`PRESS`/`enterSheet`/`enterCelebrate`/`enterFadeAfter` + token `scrim` unificado; hardcodes migrados en Tap/sheets/Skeleton/celebración).
> - ✅ FB.1 la bolita: deriva de luz por rotación de capas (±10°/∓7°, 24 s), variantes `dawn`/`burst`/`working`, IDs con `useId`, anillo de vidrio en la tab. Verificado en web: frame estático idéntico, deriva visible entre frames, celebración y sheet correctos.
> - ✅ FB.2 splash: `SplashScreen.setOptions({fade})` + `AuthGate.Loading` con `variant="dawn"` y wordmark `enterFadeAfter(250)`.
> - ✅ FB.3 navegación: fade 180 ms entre tabs; `fade_from_bottom` en aceptar/crisis/versiculo; fix del título duplicado de crisis (`headerTitle: ""`).
> - ✅ FB.4 gestos: `GestureHandlerRootView` en el root + swipe-to-dismiss con asa (`useSheetDrag`/`SheetGrabHandle`) en PlanOptionsSheet y ActionMenu. Verificado con arrastre real.
> - ⏸️ Pendiente FB: spike `formSheet` (cuando haya un sheet nuevo que lo pida).
> - ✅ Snapshots tras FB: el anillo (~0.3 % px) y crisis caen dentro del 2 % de tolerancia — cero churn, suite verde. Metro degradado (3.2 GB tras días) reiniciado con el override de Supabase; suite pasó de 6.7 a 2.6 min.
> - ✅ F1 núcleo: `ScreenScaffold` (patrón retornos tempranos), `ListRow` (leading/meta/badge/dot/chevron), `EmptyState size="inline"`, `TextField skin=form|dawn|chrome` + `hideLabel`, claves i18n muertas fuera, `Avatar` importa `ORB_COLORS` del Orb. Pilotos migrados y verificados: `avisos` (ListRow+scaffold, gran mejora) y `versiculo` (idéntico vía scaffold). 326 vitest verdes.
> - ✅ O1: orbe (84, halo) en `AuthScreen` — las 4 pantallas de acceso con la marca; `crear-cuenta` añadida al spec visual. Decisión #1 (onboarding→plan directo) SIGUE PENDIENTE de OK de Jaime.
> - ✅ O5 (parcial): Orar — plan propio como `NavRow` con meta "Plan de N días" (+plural i18n), "Orar mi lista" como fila, empty "Por otros" con `EmptyState` inline; clave huérfana `pray.forOthersEmpty` retirada. Pendiente O5: lista/index (links subrayados→acciones), FormSummary en formularios.
> - ✅ O2 (parcial): `plan/dias` en ASC + botón "Continuar en el día N" (+clave `plan.continueDay` es/en) + tarjetas a `Glass flat`; título de día ya unificado vía `Txt.title`; rama vacía de Hoy → `EmptyState` con orbe. Pendiente O2: nada crítico (initialScrollIndex descartado por el botón Continuar).
> - 🛠️ Infra: Metro moría con ENOENT al borrar vitest `.tmp/db-lock-tests` — añadido `.tmp/` al blockList de `metro.config.js` (mismo patrón que test-results). Metro corre en background con override de Supabase.
> - ✅ O5 completa: lista (acciones táctiles sin subrayados, input a `TextField skin=dawn`), resumen junto al CTA en plan/nuevo, peticiones/nueva (`feed.summaryNamed/Anonymous`) y testimonios/nuevo.
> - ✅ O3 completa: `ReaderToolbar` (versión + A−/A+ persistido en `core/bible/readerPrefs.ts` vía AsyncStorage), panel de lectura a sangre en móvil (`md:rounded-card`), números de versículo en mist-ink, `libro/index` marca el capítulo por el que vas, tarjeta "Ir a Juan 3" al vidrio del sistema.
> - ✅ O4 completa (versión mínima del mapa social): Círculos con `ListRow`+Avatar+badge y CTAs arriba + bloque "Más allá de tus círculos" (`circles.beyond`) con accesos a Comunidad y Peticiones; chat (empty del sistema con contra-volteo del inverted, rachas de autor, moderación ≥44px); comunidad/buscar/peticiones-[id] a `TextField`; tarjetas a mano restantes a vidrio; invitar con Card+toast (adopción `useToast`); las tarjetas de dominio YA estaban en Card flat (audit parcialmente desactualizado). Spec visual +5 pantallas (comunidad, peticiones, persona, chat, avisos) con `test.setTimeout(360s)`.
> - ✅ O6: `/plus` ya usaba `goBackOr`; pantallas con un solo Stack.Screen (sin fragilidad); las pills de horario ya envolvían (el escalonado es del largo del copy — Pill única manda).
> - ✅ O7: `NavRail` md+ (vidrio, absoluto, `RAIL_WIDTH` en sceneStyle; tipo desde el bottom-tabs vendorizado de expo-router), `TabHeader` alineado al ancho de lectura en md+, columna de contexto lg+ en Hoy (VerseOfTheDay) y aside de capítulos en el lector.
> - Decisión #1: la alternativa ligera YA estaba de serie (plan/nuevo precarga temas del onboarding). Decisión #2: aplicada la versión mínima; la tab "Juntos" sigue esperando OK.
> - ✅ Cierre: 15 capturas de verificación por pantalla sin errores; baselines regeneradas y **suite visual verde 6/6** (18 pantallas × 2 viewports tras añadir también libro-index y plan-dias); informe antes/después actualizado (artifact "Amanecer 3.0"). Vitest 326/326, typecheck y lint verdes en todo momento.
> - ✅ Decisiones de producto resueltas por Jaime: (1) onboarding→plan directo — resultó estar YA implementado en `bienvenida.tsx` (encadena la generación de 7 días con caída elegante) y cubierto por `fresh-account.spec`; la doc estaba desactualizada. (2) Tab social **"Juntos"** implementada: `(tabs)/circulos.tsx` como hub con segmentos Pill y el contenido en `components/panes/{CirclesPane,CommunityPane,RequestsPane}` compartidos con las rutas clásicas `/comunidad` y `/peticiones` (vivas para enlaces y avisos).
> - ✅ Fix raíz de Metro: los scratch de `dbLock.test.ts` van a `os.tmpdir()` — el blockList del resolver no protege el recorrido del FallbackWatcher.
> - ✅ **Commit `539e225`** con todo el uplift (verify verde: 326 vitest, typecheck, lint, visual 6/6 con 25 baselines regeneradas con Juntos) y **deploy a staging** por la vía REST: https://ammen-staging.web.app (verificado sirviendo el build nuevo).
> - Pendiente real tras el plan: spike formSheet, CI visual con baselines Linux (Jaime: "más adelante"), adopción incremental de Txt, háptica/gestos en dispositivo físico, snapshot visual del onboarding.

## Contexto

Ammen tiene una base visual sólida ("Amanecer", congelado en `prototipo/TOKENS.md` + contrato duro en `AGENTS.md`, uplift "Amanecer 2.0" commiteado en `8e8382c`), pero Jaime siente deuda de UI/UX y quiere un salto de calidad end-to-end: sistema de diseño más profundo, animaciones modernas, navegación fluida al nivel de las mejores apps de 2026 (Calm/Hallow/Duolingo), y **animar la bolita del logo** (el Orbe).

Auditoría realizada para este plan:
- **86 capturas reales** de las 43 rutas (móvil 390×844 + escritorio 1280×800 + estados interactivos con cuenta nueva), analizadas visualmente en varias oleadas.
- Lectura de todo lo documental: `TOKENS.md`, `AGENTS.md`, `docs/plan-uiux-consistencia-2026-08.md` (backlog previo), `UIammen` (canvas con plan UX y 3 mockups), el diseño original (`diseno/MONTAJE FINAL`, 73 JPG) y **los 2 .fig de `diseno/ANIMACIÓN ISOTIPO`** (la animación del isotipo diseñada y nunca implementada).
- Auditoría de código: sistema de tokens/motion, primitivas UI, navegación, dependencias.
- Investigación web del estado del arte 2026 en RN/Expo (Reanimated 4 CSS, native tabs, sheets, Rive/Lottie/Skia, splash animado).

**Restricciones que mandan** (no se discuten en este plan):
- La paleta, el fondo único (`DawnBackground` sin props) y el contrato `AGENTS.md` se respetan: esto ejecuta MEJOR el sistema, no lo sustituye.
- **Modo oscuro sigue apagado** (decisión de producto explícita de Jaime; la capa existe y no se toca).
- Animaciones ≤300 ms para estados (las de ambiente tipo respiración van aparte y bajo `reducedMotion`), háptica solo vía `Tap`/`triggerHaptic`, copy con `t()` en es+en en la misma ola.
- Los e2e dependen del copy español real; cambiar copy ⇒ actualizar tests en la misma ola. Cambio visual deliberado ⇒ `npm run e2e:visual:update`.

## Qué encontró la auditoría (resumen)

### La bolita (Orbe) — la petición estrella
- `components/Orb.tsx`: SVG inline con 5 `RadialGradient` (peach arriba, blue abajo, lilac/lavender a los lados, base lavanda) + rim especular + halo. Hoy solo "respira" (scale 1→1.055, 4.2 s).
- Los `.fig` de `diseno/ANIMACIÓN ISOTIPO` muestran la animación que el diseñador quería: **4 keyframes donde la luz interna del orbe rota lentamente** (el melocotón viaja del norte al este, el celeste gira en contrafase) — una perla nacarada girando, no un morph. Nunca se implementó. Es perfectamente implementable animando `cx/cy` de los gradientes con Reanimated (props animadas de `react-native-svg`) — sin dependencias nuevas.
- Bug latente detectado: los IDs de gradiente son constantes de módulo → en web, con varios orbes montados, todos resuelven contra el primer `<defs>` del DOM (arreglar con `useId`).
- El "anillo de vidrio" del orbe en la pestaña Orar está en el contrato (`TOKENS.md:81`) y sin implementar.

### Sistema
- `theme/motion.ts` solo cubre entradas (3 duraciones + 1 easing + stagger). **Toda la física está hardcodeada** en 7 sitios (Tap 20/350, sheets damping 18, celebración 14/180, Skeleton 1100 ms, Orb 4200 ms). Sin tokens de spring, press, scrim ni loops.
- **Una sola transición de navegación en toda la app** (`slide_from_right`). Sin `presentation:"modal"`, sin transición de tabs, sin shared elements. Sheets = `Modal` RN (sin URL en web, sin swipe-to-dismiss).
- `react-native-gesture-handler` instalado y **sin un solo uso**.
- Adopción de `Txt` incompleta: 15/60 ficheros; ~350 tripletas tipográficas crudas.
- 29 sitios reconstruyen el vidrio a mano (`border-glassedge/60` sin especular/blur); 3 pieles de input sin encapsular; 2 scrims distintos (0.28/0.38) sin token.
- ~20 pantallas repiten `<Stack.Screen headerShown:true>` en cada rama temprana (frágil, ya causó bugs).

### UX por pantalla (capturas)
- **La puerta (entrar/crear-cuenta/aceptar) no tiene la marca**: H1 sans bold + wordmark abajo; el diseño original pone el orbe como protagonista del acceso.
- **Pantallas "esqueléticas"** (cards blancas flotando + aire muerto + CTA huérfano): Círculos (sin avatares/preview/badge), Orar (hub de botones apilados), Comunidad, Peticiones, Avisos, Persona, Invitar (URL cruda), Lista (links subrayados estilo web viejo "Se respondió/Quitar").
- **Empty states inconsistentes**: unos con `EmptyState`+orbe, otros texto itálico naranja suelto (comunidad, peticiones, testimonios) — P1.3 del backlog previo sigue vivo.
- **Lector bíblico** sin herramientas de lectura (tamaño/versión), números de versículo naranja fuerte repetidos, grid de capítulos sin estado leído/continuar; panel de nota con links subrayados.
- **`plan/[id]/dias` lista DESC**: el día 14 bloqueado arriba, hay que scrollear para llegar a hoy.
- **Crisis duplica el título** (header + H1 "Antes de seguir").
- **Escritorio = móvil estirado**: header pegado arriba-izquierda desconectado del contenido centrado, tab bar de 5 iconos repartidos en todo el ancho. `max-w-page` (72rem) existe y nadie lo usa.
- Onboarding correcto y bonito, pero al terminar aterriza en un Hoy vacío que re-pide confirmar temas (decisión de producto #1 del backlog previo, con evidencia en `.tmp/pw-fail`).

### Estado del harness
- Baselines visuales desactualizadas en 5–9 pantallas (fallos del 27-ago sin regenerar en `test-results/`).
- El proyecto `visual` no corre en CI (baselines `-win32`).
- Sin cobertura visual: onboarding, chat, comunidad, peticiones, persona, compartir, públicos.

## Dirección

**"Amanecer 3.0: el mismo amanecer, pero vivo."** Tres apuestas:
1. **El orbe como alma de la app**: implementar por fin la animación diseñada (deriva de luz nacarada), con variantes por contexto (arranque, generar, celebrar, tab), y llevar la marca a la puerta.
2. **Motion como sistema**: vocabulario completo en `theme/motion.ts` (springs, press, scrim, loops), transiciones de navegación por jerarquía, sheets con gesto, todo multiplataforma (Reanimated 4 → CSS en web) y bajo `reducedMotion`.
3. **Densidad y oficio pantalla a pantalla**: matar las pantallas esqueléticas con patrones de fila/tarjeta social, empty states del sistema en todas, lector bíblico inmersivo, y un shell de escritorio real.

## Reconciliación del backlog previo (verificado contra el código, 2026-08-28)

**Ya hecho (no re-proponer)**: P0.1 crisis con `tel:` · P0.2 back seguro (`goBackOr`; solo verificar `/plus`) · P1.1 Pill única · P1.4 ActionMenu en persona · P2.3 KeyboardScreen en 9 formularios · `CardDark` eliminado · **salida serena de `/lista/orar` ya implementada** (`done` + háptica + 2 s).

**Sigue vivo**: P1.2 vidrio a mano en ~29 sitios · P1.3 empties locales improvisados (chat, "Por otros") · P2.2 Txt en 15/60 ficheros · P2.5 zona táctil en enlaces-texto · P2.7 parcial (3 pieles de input documentadas pero sin encapsular, scrims 0.28/0.38, claves i18n muertas, tonos de Avatar duplicados del orbe). Nuevo: **72 repeticiones de `<Stack.Screen headerShown>` en 31 ficheros** y **título duplicado en Crisis** (`crisis.tsx:36` + `:51`).

**Decisiones de producto** (marcadas en su oleada): (1) onboarding→generación directa del plan — recomendada, requiere OK; (2) unificación del mapa social — solo versión mínima ahora, la tab unificada requiere OK; (4) `plan/dias` en orden ascendente arrancando en el día actual — pura usabilidad, se hace.

## Fase F1 — Sistema (habilitadora, antes de tocar pantallas)

1. **`ScreenScaffold`** (nuevo, `components/ScreenScaffold.tsx`): emite una vez `Stack.Screen` + `DawnBackground` + scroll con `useScreenPadding` + ancho de lectura, y delega `loading/error/skeleton` en `ScreenState`. Mata las 72 repeticiones y la clase literal `md:max-w-read` copiada en ~15 pantallas. (M)
2. **`TextField` con `skin="form" | "dawn" | "chrome"`** mapeando las 3 pieles ya documentadas en `TextField.tsx:41-46`, + `multiline` auto-grow (chat/comunidad). Absorbe los `TextInput` sueltos de `comunidad.tsx:132`, `circulo/buscar.tsx:76`, `lista/index.tsx:136`, `peticiones/[id].tsx:229`, chat. (S/M)
3. **`ListRow`** (nuevo, `components/ui/ListRow.tsx`): fila social del sistema — `Glass flat` + avatar/icono + título + meta + chevron/badge, táctil ≥44px. Cierra P1.2 de una vez (círculos, avisos, feed, persona, miembros, moderación, plan/dias). (M)
4. **`EmptyState size="inline"`** para vacíos de sección (chat, "Por otros", comentarios). Cierra P1.3. (S)
5. **Adopción de `useToast`**: migrar notices inline y `Text role="alert"` restantes; inline solo errores de campo. (S/M)
6. Micro-cierres P2.7: claves i18n muertas, scrim → token, `Avatar` derivando tonos del Orb. (S)
7. Regla transversal de todas las oleadas: pantalla tocada sale con `Txt` adoptado y zona táctil ≥44px.

## Oleadas de ejecución por flujo

### O1 — La puerta (S; +M/L si entra la decisión #1)
- **Orbe en `AuthScreen.tsx`** (~size 72–88 sobre el título): la marca vuelve a la puerta en entrar/crear-cuenta/recuperar/nueva-contraseña de golpe, como el diseño original.
- Crisis: `headerTitle:""` y conservar el H1 serif (fix del duplicado).
- **Decisión #1 (requiere OK)**: al acabar el wizard, generar el plan con lo contado y aterrizar en Hoy "generando" (el estado del orbe ya existe). Alternativa S sin backend: el CTA del Hoy vacío precarga `/plan/nuevo` con los temas del onboarding.
- e2e: no tocar labels "Correo electrónico"/"Contraseña"/"Entrar"; si entra #1, actualizar `fresh-account.spec.ts` en la misma ola. Snapshots: regenerar `entrar`; añadir `crear-cuenta` y `onboarding` al spec visual.

### O2 — Hoy / journey (M)
- `plan/[id]/dias`: orden ASC + arranque en el día actual (`FlatList` + `initialScrollIndex` o botón "Continuar en el día N"); tarjetas a `ListRow` conservando el dashed de bloqueado.
- Unificar el título de día vía `Txt.title` (Hoy y `plan/[id]/dia/[numero]`).
- Rama vacía de Hoy → `EmptyState` del sistema con CTA dentro.
- Snapshots: `hoy`; añadir `plan-dias`.

### O3 — Biblia / lector (M/L)
- Lector: fuera la Card-envoltorio → panel de lectura limpio a sangre en `max-w-read`; **`ReaderToolbar` nueva** (chip de versión + A−/A+ persistido); números de versículo de naranja a `mist-ink` superíndice; `Pressable` crudos → `Tap`.
- `libro/[book]/index`: grid con estado leído/actual ("Continuar" destacado) usando datos de `core/bible`.
- `biblia.tsx`: tarjeta "Ir a Juan 3" a `Card` estándar.
- Snapshots: `biblia`, `capitulo`; añadir `libro-index`.

### O4 — Social: círculos + chat + comunidad + peticiones + persona + avisos + invitar (L)
- Círculos: `ListRow` con avatares apilados + preview del último mensaje + badge de no leídos (dato ya disponible en `useUnreadCounts`); CTA "Crear círculo" arriba.
- Chat: `EmptyState` inline; compositor `TextField skin="chrome" multiline` auto-grow; agrupar mensajes consecutivos del mismo autor; acciones de moderación ≥44px.
- Comunidad/Peticiones: compositor e inputs a `TextField`; `PrayerRequestCard`/`PrayForCard`/`CirclePlanCard` a `Glass flat`; empties del sistema.
- Persona: cabecera Avatar grande + secciones en `ListRow`.
- Invitar: URL cruda → Card con "Copiar"/"Compartir" + toast.
- **Mapa social mínimo (recomendado, sin tocar tabs)**: Comunidad y Peticiones como accesos `ListRow` coherentes; misma fila en las tres superficies. **Opcional con OK**: tab "Juntos" (5→4 tabs) — rompe el NO-GOAL, solo si Jaime lo bendice.
- e2e: `moderation`/`share-loop`/`privacy-rights` localizan por copy — actualizar en el mismo commit. Snapshots: regenerar `circulos`; **añadir `comunidad`, `peticiones`, `persona`, `chat`, `avisos`** (hoy sin red).

### O5 — Orar / lista / formularios (M)
- Orar: bloques con contenido real (plan + progreso) en vez de botones apilados; un solo CTA primario; empty de "Por otros" a `EmptyState` inline.
- Lista: links subrayados "Se respondió/Quitar" → acciones por fila con `min-h-11`; input de alta a `TextField skin="dawn"`; tarjetas a `Glass flat`.
- Formularios (plan/nuevo, peticiones/nueva, testimonios/nuevo): resumen compacto de lo elegido junto al CTA anclado.
- e2e: `pray-hub.spec.ts`. Snapshots: `orar`, `lista`.

### O6 — Perfil / ajustes / legales / plus (S)
- Perfil: pills de horario en fila con wrap (`ChoiceChips`).
- Plus: verificar `goBackOr`; bloqueados/acerca/legal/moderación por `ScreenScaffold` + `Txt`.
- Snapshots: `perfil`, `plus`.

### O7 — Web shell de escritorio (M/L; deliberadamente la última)
1. **Rail lateral md+** en `(tabs)/_layout.tsx` vía prop `tabBar`: `NavRail` (columna ~88 px, vidrio con borde hairline, iconos+labels, badges gratis de react-navigation) en `width>=768`, `BottomTabBar` en móvil. Mismo árbol de rutas.
2. **`TabHeader` alineado al ancho de lectura** en md+ (una línea de clases; hoy queda pegado arriba-izquierda).
3. **Columna de contexto lg+** en Hoy (versículo/progreso/racha) y capítulo (navegación de capítulos) vía `lg:max-w-page lg:flex-row` — solo clases NativeWind, sin layouts paralelos.
4. Única ola que regenera TODOS los snapshots `escritorio` (deliberado, revisado uno a uno); los `movil` deben quedar en diff cero.

## Orden, dependencias y verificación

| Fase | Contenido | Tamaño | Depende de |
|---|---|---|---|
| F0 | Baseline verde: `e2e` + `e2e:visual`, regenerar las 5–9 baselines desactualizadas ANTES de tocar nada. Decisión CI visual: local-only durante el uplift; al cerrar O7, baselines `-linux` en contenedor y encender `visual` en CI | S | — |
| F1 | Sistema (ScreenScaffold, TextField skins, ListRow, EmptyState inline, useToast, limpiezas) | M | F0 |
| FB | **La bolita + motion v2 + navegación** (sección siguiente) | M/L | F0 (paralelo a F1) |
| O1 | Puerta | S (+M/L) | F1, FB (orbe nuevo) |
| O5 | Orar/lista | M | F1 |
| O2 | Hoy/journey | M | F1 |
| O3 | Biblia/lector | M/L | F1 |
| O4 | Social | L | F1; tras O5 (ListRow rodada) |
| O6 | Perfil/ajustes | S | F1 |
| O7 | Web shell | M/L | todas (regeneración masiva escritorio) |

**Verificación idéntica por fase**: (1) `npm run typecheck && lint && test` (contraste vitest incluido); (2) `npm run e2e` — copy cambiado ⇒ specs + `es.json`/`en.json` en la misma ola; (3) `npm run e2e:visual` → revisar diff png a png → `e2e:visual:update` deliberado; (4) cada ola añade sus pantallas al array `SCREENS` de `e2e/visual.spec.ts`.

## Fase FB — La bolita, motion v2 y navegación fluida

Verificado contra el código: expo-router 56 vendoriza bottom-tabs v7 (soporta `animation: "fade"` + `transitionSpec`, web incluida) y native-stack con `presentation:"formSheet"` + detents; falta `GestureHandlerRootView` en el root (sin él no hay gestos).

### FB.0 — `theme/motion.ts` v2 (S)
Aditivo, sin renombrar lo existente (Playwright estable):
- `SPRING = { gentle: {damping 18, stiffness 160}, standard: {20, 350}, bouncy: {14, 180} }`.
- `AMBIENT = { pulse: 1100, breathe: 4200, breatheBusy: 2600, drift: 12000, dawn: 700 }` — bucles ambientales exentos de la regla de 300 ms, siempre apagados por `useReducedMotion` (documentarlo en el header).
- `PRESS = { scaleTo: 0.97, dimTo: 0.92 }`, `enterSheet` (SlideInDown gentle), `enterCelebrate` (ZoomIn bouncy).
- `scrim` como token de theme (`withAlpha(plum, 0.35)`) — hoy 0.28 y 0.38 a mano.
- Migrar los hardcodes: `Tap.tsx:63`, `ActionMenu.tsx:62`, `PlanOptionsSheet.tsx:162`, `(tabs)/index.tsx:637`, `Skeleton.tsx:25`, `Orb.tsx:47`.

### FB.1 — La bolita: deriva de luz en `components/Orb.tsx` (M) 🌟
**Vía elegida: rotación de grupos de capas** (la vía de animar `cx/cy` de los `RadialGradient` con `useAnimatedProps` se descarta: los updates sobre hijos de `<Defs>` no invalidan el brush de forma fiable en Android ni pasan por la ruta de animatedProps en web).

Como cada capa de luz es un círculo recortado por un `ClipPath` centrado, **rotar el contenedor mueve la luz interior sin tocar la silueta** — exactamente el efecto "perla girando" de los `.fig`, con `transform: rotate` de View que funciona idéntico en iOS/Android/web:
- Dividir el Svg en 4 apilados: `base` (estática) · `lightsA` (orbBlue+orbPeach, el eje frío/cálido, rota +) · `lightsB` (orbLilac+orbLavender, contrafase −) · `rim` (estático encima).
- Deriva: ±10°/∓7° con `withRepeat(withTiming(1, {duration: AMBIENT.drift, easing: inOut(sin)}), -1, true)` — 24 s el ciclo: imperceptiblemente vivo. (Flag de diseño opcional: rotación continua literal 360°/48 s.)
- **API**: `variant?: "idle" | "dawn" | "burst" | "working"` + `drift?: boolean` (default `animated && size >= 48`).

| Contexto | Variante |
|---|---|
| Splash (`AuthGate`, 150) | `dawn`: one-shot — la luz melocotón nace abajo (offset 150°) y "amanece" hasta arriba en 700 ms, luego empalma el loop; halo 0→1 |
| Hoy generando (110) | `working`: respiración 2600 ms + escala 1.07 |
| Celebración del amén (92) | `burst`: `enterCelebrate` + cuarto de vuelta de luz con spring bouncy + destello de halo (subida 120 ms, bajada 260 ms) |
| Tab Orar (26) | `drift={false}` (invisible a ese tamaño) + **anillo de vidrio del contrato** (View 32–34 px, fondo blanco/50, borde hairline glassedge/65) |
| EmptyState/404/listas | estático = un solo Svg, render actual (cero coste añadido) |

- Arreglo del bug latente: IDs de gradiente por instancia con `useId` (sanitizado — `:r1:` rompe `url(#…)`).
- Reduced motion ⇒ `drift = 0`, `dawn` salta al frame final: el frame es exactamente el estático de hoy, los snapshots no cambian por la deriva.

### FB.2 — Splash animado (M)
1. `SplashScreen.setOptions({ fade: true, duration: 220 })` junto al `preventAutoHideAsync` de `_layout.tsx`; verificar que el fondo del splash nativo empalma con el arranque del degradado.
2. `AuthGate.Loading` = segunda mitad de la secuencia: `DawnBackground` + `Orb variant="dawn"` + `Wordmark` con `enterFade.delay(250)`.
3. Los e2e ya esperan a que `Loading` desaparezca; con reduce motion salta al frame final.

### FB.3 — Navegación (S)
- **Tabs con fade suave**: `animation: "fade"` + `transitionSpec` timing 180 ms en `(tabs)/_layout.tsx` — web y nativo, sin tocar pantallas.
- **Stack**: mantener `slide_from_right`; `fade_from_bottom` puntual para ceremonias (`aceptar`, `crisis`, `versiculo`).
- **Sheets nuevos**: spike S de `presentation:"formSheet"` + detents (expo-router 56 tiene render web de modales de ruta); los 2 sheets existentes (Modal RN) NO se migran.
- **NO hacer**: shared elements con `react-native-screen-transitions` ahora (dev build, sin web — reevaluar como fase opcional solo-nativo), interpoladores custom de stack en web, tabs "shift".

### FB.4 — Gestos (M)
1. `GestureHandlerRootView` en el root (falta hoy).
2. Swipe-to-dismiss en `PlanOptionsSheet` y `ActionMenu`: `Gesture.Pan()`, umbral 80 px / 800 de velocidad, settle con `SPRING.gentle`, grab-handle visual. Funciona en web (pointer events).

### FB.5 — Dependencias: qué se instala
**Nada nuevo para las fases FB.0–FB.4** — todo sale de Reanimated 4 + svg + gesture-handler ya instalados. Decisiones: NO Moti (muerto), NO Lottie (el orbe es código y un JSON se desincroniza de la paleta), NO @gorhom/bottom-sheet (Modal + Pan cubren), NO react-native-screen-transitions ahora, NO Skia ahora (2.9 MB WASM en web; solo si llega una fase "aurora", diferida y con fallback), Rive = opción futura si el orbe evoluciona a mascota con estados.

### Riesgos FB
Interacciones nuevas todas ≤220 ms; bucles ambientales apagados por el harness (`reducedMotion:"reduce"`); máximo un orbe con deriva por pantalla; cero bytes nuevos de bundle; el anillo de tab y el scrim unificado ⇒ una regeneración deliberada de snapshots.

## Resultado esperado

- **La bolita vive**: deriva nacarada continua, amanece en el arranque, celebra el amén, trabaja cuando genera — la animación que el diseñador dejó en Figma, por fin en producción y en las tres plataformas.
- Motion con vocabulario único en `theme/` (como ya lo tienen color y radio), navegación con transiciones coherentes y sheets con gesto.
- Cero pantallas esqueléticas: filas sociales con contenido real, empties del sistema en todas, formularios con resumen, lector bíblico inmersivo con herramientas.
- Escritorio con shell propio (rail + header alineado + columna de contexto) sin bifurcar el árbol de rutas.
- Harness visual ampliado (de 11 a ~19 pantallas cubiertas) y baselines regeneradas deliberadamente por ola; al cierre, decisión de encender `visual` en CI con baselines Linux.

## Primer paso al ejecutar

Guardar este plan en el repo como `docs/plan-amanecer-3-2026-08.md` (el .md robusto pedido, junto a los planes anteriores) y correr la F0 (baseline verde).

## Verificación end-to-end del plan completo

1. Por fase: `npm run typecheck && npm run lint && npm run test` → `npm run e2e` → `npm run e2e:visual` (diff revisado png a png antes de `e2e:visual:update`).
2. Recorrido manual con la cuenta seed (`prueba@ammen.local` / web en `http://127.0.0.1:8081` con `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421`) + capturas antes/después por ola para presentar la evidencia visual.
3. Háptica y gestos: prueba en dispositivo físico (pendiente ya conocido del rebuild del dev client).
4. Al cierre: `npm run build:web:staging` + deploy a `ammen-staging.web.app` para revisión real en móvil.

