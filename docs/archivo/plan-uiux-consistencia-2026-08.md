# Plan UI/UX — Auditoría y consistencia (2026-08)

> Origen: auditoría read-only del repo completo (mapa de rutas, componentes+i18n, crítica visual contra `prototipo/TOKENS.md`, juicio UX). Nada implementado todavía.
>
> **Veredicto**: el sistema está sano. El contrato visual de `prototipo/TOKENS.md` se defiende bien en el núcleo (`Tap`, `Txt`, `Glass`, `ScreenState`, `EmptyState`, háptica centralizada con `useReducedMotion`, i18n es/en sin strings duras, a11y por construcción). La deriva está en la **periferia**, no en el material.

---

## P0 — Riesgo real de usuario (~1 día)

### P0.1 Crisis clicable
- **Hoy**: 024 y 112 son texto plano; una persona en crisis debe memorizar/teclear el número.
- **Cambio**: convertir los teléfonos en botones `tel:` (Linking) + copy que confirme que su borrador NO se publicó (queda privado).
- **Dónde**: `app/crisis.tsx:63-84`.
- **Aceptación**: tap en 024 abre marcador; copy menciona privacidad del borrador; claves i18n nuevas presentes en es/en.

### P0.2 Back seguro en pantallas alcanzables por deep link / notificación
- **Hoy**: `router.back()` ciego no hace nada si no hay historial (arranque frío).
- **Cambio**: guarda `router.canGoBack() ? router.back() : router.replace(destinoSeguro)` — patrón ya existente en `app/lista/index.tsx:79-85`.
- **Dónde**: `app/lista/orar.tsx:148,158` · `app/plus.tsx:240`.
- **Aceptación**: entrar por deep link a ambas pantallas y poder salir siempre a `/orar` y `/` respectivamente.

---

## P1 — Consolidación visual (~3 días)

### P1.1 Una sola Pill (5 copias hoy)
Desacuerdos visibles: `py-2` vs `py-2.5`; borde activo `white/30` vs `border-plum` vs ninguno; texto inactivo `plum` vs `mist-ink`; `text-sm` explícito vs heredado.
- **Cambio**: un componente `Pill` (o extender `ChoiceChips`) que decida: `py-2.5`, borde activo `white/30`, inactivo `plum`, `text-sm`.
- **Absorbe**: `components/ChoiceChips.tsx:99` · `components/PlanSwitcher.tsx:60` · `components/LanguageSwitcher.tsx:57` · `app/(tabs)/index.tsx:611` · `app/orar/[planId].tsx:167`.

### P1.2 Tarjetas de dominio → `Card` / `Glass flat`
Reconstruyen vidrio a mano: `bg-glass/60 border-glassedge/60 shadow-card` sin especular (60% vs 58% medido de `readable`, borde /60 vs .65). Se ven un escalón por debajo de las `Card` conviviendo en la misma pantalla.
- **Dónde**: `components/PrayerRequestCard.tsx:38` · `components/PrayForCard.tsx:29` · `components/CirclePlanCard.tsx:42,60` · `app/lista/index.tsx:180,240` (tarjeta pendiente solo-borde y respondida solo-fondo: ninguna coincide con el sistema).
- **Nota**: verificar si fue decisión deliberada de rendimiento en listas virtualizadas; si es así usar `Glass flat` que ya existe para eso (`Glass.tsx:31-41`).

### P1.3 Empty states unificados
`EmptyState` existe pero solo 4 pantallas lo usan (`comunidad.tsx:242`, `peticiones/index.tsx:116`, `lista/index.tsx:175`, `circulos.tsx:201`). El resto improvisa `Text` plano.
- **Migrar**: `avisos.tsx:88` · `lista/orar.tsx:81` (+CTA primario "añadir peticiones" → `/lista` y salida a `/orar`: hoy es pantalla sin salida) · `bloqueados.tsx:71` · `biblia.tsx:144` · `circulo/[id]/index.tsx:287` · `testimonios/index.tsx:137` · `circulo/buscar.tsx:100` · `persona/[id].tsx:115-128` (estado "no person").

### P1.4 Bloquear/Reportar accesibles sin scroll
- **Hoy**: único "Bloquear" es un Button ghost al final del scroll del perfil; sin deshacer en pantalla.
- **Cambio**: menú contextual en `headerRight` (bloquear/reportar/compartir), disponible al entrar.
- **Dónde**: `app/persona/[id].tsx:314-322`.

---

## P2 — Pulido (por lotes)

### P2.1 Iconos al token (<1h, 5 ficheros)
Tamaños fuera de la escala `icon.sm/md/lg` (20/24/28): `TabHeader.tsx:92` (21), `(tabs)/index.tsx:547` (22), `TabHeader.tsx:99` Wordmark (23), `(tabs)/index.tsx:651` (30). Y `strokeWidth={2}` vs token 1.7: `WizardHeader.tsx:44`, `plus.tsx:123,138`, `(tabs)/index.tsx:653`. Referencias correctas: `libro/[chapter]:405,433`, `plus.tsx:121,136`, `NavRow.tsx:35`.

### P2.2 Adoptar `Txt` (codemod-friendly, varias sesiones)
Solo 3 ficheros importan `ui/Text.tsx` (`+not-found`, `EmptyState`, `NavRow`) contra ~500 tripletas crudas `font-* text-* text-plum`.
- Añadir variante faltante **`bodySerifReading`** (serif base + `leading-reading`, 11 usos idénticos: `PrayerRequestCard:84`, `lista:182,242`, `comunidad:417`, `moderacion:185,354,557`, `testimonios:165`, `persona:259,286`, `acerca:64`).
- Decidir UNA definición de título de día (`(tabs)/index.tsx:589` usa `text-3xl leading-10` compitiendo con `Txt.title` 2xl; igual en `plan/[id]/dia/[numero]:78`).

### P2.3 Teclado en formularios
`KeyboardAvoidingView` solo en 3 sitios (`AuthScreen.tsx:42`, `PlanOptionsSheet.tsx:100`, `chat.tsx:182`). Falta en: `plan/nuevo.tsx` · `perfil.tsx` · `circulos.tsx` · `testimonios/nuevo.tsx` · `peticiones/nueva.tsx` · `plus.tsx` · `lista/orar.tsx`.

### P2.4 Errores de red diferenciados
Copy tranquilizador "Sin conexión" vs genérico alarmista. `ErrorState` debe distinguir fallo de red (Supabase fetch fail) de error real.
- Referencia: `(tabs)/index.tsx:262` · `(tabs)/orar.tsx:46` · `(public)/p/[token].tsx:115-132`.

### P2.5 Zona táctil ≥44px en enlaces-texto
`Tap` no aplica hitSlop por defecto. Patrón conocido pero aplicado solo en `perfil.tsx:207,221` (`hitSlop={12}`).
- **Opción A**: hitSlop automático en `Tap` cuando el hijo es texto pequeño. **Opción B**: patrón `min-h-11` (ya usado en `orar.tsx:230`).
- Dónde: `PrayerRequestCard.tsx:115-184` · `peticiones/[id].tsx:171-221` · `circulo/[id]/index.tsx:252-272` · `chat.tsx:286-330` · `DayView.tsx:59-79` · `VerseOfTheDay.tsx:48-70` · `lista/index.tsx:187-226`.
- Además: subrayar enlaces de moderación del chat (`chat.tsx:296,310,325`) como el resto del sistema.

### P2.6 Literales del contrato
- `DayView.tsx:51`: referencia bíblica en sans/mist-ink → debe ir en Cormorant ember-ink como `VerseOfTheDay.tsx:49` y `biblia.tsx:172`.
- `Avatar.tsx:18-25`: duplica 5 tonos del orbe en duro e inventa `#D8E1F1` (no existe en el orbe) → derivar de tokens/Orb.

### P2.7 Limpieza
- `CardDark` huérfano (`Card.tsx:46`, 0 imports) → eliminar.
- Claves i18n muertas: `notifications.intercessorReminder`, `notifications.dailyDigest` (+`_plural`) en ambos JSON → eliminar o dejar documentadas para push remoto futuro.
- Cosméticos: `text-[11px]` chat (`chat.tsx:274`) · `rounded-xl` fuera de escala en lector (`libro/[chapter].tsx:257`) · opacidades de vidrio ad-hoc `/60`,`/70` en ~15 sitios (pills, `index.tsx:544`, `chat.tsx:261`, `WizardHeader.tsx:42,53`, `TextField.tsx:41`, `orar.tsx:133`) → consolidar en `Glass` · inputs con tres pieles (`TextField bg-glass/70` vs `bg-dawn-cream-bg` lista/peticiones vs `bg-surface` libro/chat) → definir cuál va en cuál · `Pressable` crudos sin hundido/háptica en lector (`libro/[chapter].tsx:250,294,324,346,371`) → pasar por `Tap` · tarjeta "Ir a Juan 3" en vidrio oscuro sólido a tamaño card (`biblia.tsx:118`, material fuera de catálogo) · tab bar 58% vs 55% del contrato (`(tabs)/_layout.tsx:66`) · halo del Orb con crema retirada pre-despastelado (`Orb.tsx:122-123` `#FFE7C3`).

---

## Decisiones de producto (antes de tocar código)

1. **Onboarding → Hoy vacío**: tras los 4 pasos se aterriza en Hoy vacío que pide re-confirmar temas en otro formulario (`bienvenida.tsx:86-115` vs `(tabs)/index.tsx:318-362` vs `plan/nuevo.tsx:43-55`). Propuesta: generar el plan con los datos del onboarding y aterrizar en Hoy mostrando el estado activo de generación (orbe). Toca backend/generation — decidir alcance primero.
2. **Mapa social fragmentado**: comunidad viva al pie de Orar (`orar.tsx:240-245`), peticiones en otra ruta, círculos con tab. Unificar navegación social implica rediseño de tabs — NO-GOAL actual, decidir roadmap.
3. **Modo oscuro**: paleta completa existe (`colorsDark`, `dawnDark`), apagada a propósito en `tailwind.config.js:71-75` (solo emite vars light). Encenderlo es barato gracias a CSS vars — decidir si entra en roadmap.
4. **Salida serena al terminar oración guiada** (`lista/orar.tsx:147-154`): cierre de ~2s ("Has orado por tus X peticiones") con háptica suave antes de volver. Bajo coste, buen cierre de hábito.

## Gobernanza

- No hay `AGENTS.md` local en el repo: escribir ahí (o en `prototipo/TOKENS.md` anexo) las reglas duras para que ningún agente rompa el contrato: pill única, superficie de card = `Card`/`Glass flat`, iconos por token `icon.*` trazo 1.7, empty state siempre `EmptyState`, todo tocable por `Tap`, texto UI siempre `t()`.
- Verificar antes de arreglar: `PrayerRequestCard` puede llevar hitSlop interno en sus acciones reportar/bloquear (no confirmado en auditoría).
