# Contrato visual — Ammen

Reglas duras para no romper el sistema de `prototipo/TOKENS.md`. Si un cambio las contradice, el cambio está mal.

## Superficies

- **Pill única:** `components/ui/Pill.tsx`. No rehacer chips (`py-2.5`, borde activo `white/30`, texto inactivo plum, `text-sm`).
- **Tarjeta = `Card` o `Glass flat`.** No reconstruir vidrio a mano (`bg-glass/60`, borde `/60`, `shadow-card`).
- **Vacío = `EmptyState`.** No improvisar dos líneas de texto.
- **Error = `ErrorState`.** Distinguir red (`common.errorNetwork`) de error genérico.
- **Cargando = `LoadingState`** con skeleton del dominio, no pantalla en blanco.

## Tacto y texto

- Todo lo tocable pasa por **`Tap`** (o `Button`, que ya lo usa). Nada de `Pressable` crudo.
- Iconos: escala `icon.sm` / `icon.md` / `icon.lg` y `icon.strokeWidth` (1.7). No `size={21}` ni `strokeWidth={2}`.
- Copy de UI siempre con **`t()`**. Claves nuevas en `translation/es.json` y `translation/en.json` en la misma ola.
- **Todo texto pasa por `Txt`** (`components/ui/Text.tsx`), con su `variant`/`tone`. Nada de `<Text>` crudo de React Native con la tripleta `font-* text-*` a mano; el `className` de `Txt` es para afinar (centrado, márgenes, `flex-1`), no para reconstruir variantes. Guard: `theme/txt-adoption.test.ts`. Referencias bíblicas en editorial / ember-ink.

## Navegación

- `router.back()` solo si hay historial; si no, `goBackOr(destinoSeguro)` (`core/nav/safeBack.ts`).
- Un overlay (sheet, menú) tiene **un** control «Cerrar» anunciado. El scrim no es un segundo botón.
- Navegar desde un sheet **después** de que el Modal se haya cerrado (`onClosed`), no en el mismo tap.

## El anochecer (modo oscuro)

Encendido con Amanecer 4.0 (2026-08-28). **El default es Sistema** (sigue al OS). El toggle de usuario vive en Perfil → Apariencia: Sistema / Oscuro / Claro, persistido en `ammen.theme.v1`. La única vía de forzar el tema es `colorScheme.set()` de NativeWind, llamada desde `theme/ThemeProvider.tsx`.

- **Qué voltea solo:** toda clase de token (`text-plum`, `bg-glass/60`, …) vía las variables CSS de `tailwind.config.js`; la rama JS (iconos, placeholders, opciones de navegación) vía `useThemeColors()`; los degradados con gemelo (`dawnDark`, `dayActionDark`) vía `useIsDark()`.
- **Marca fija, a propósito:** el Orb, el Avatar, `VerseCard`/`VerseStory`, `gradients.cta` y `gradients.story`, `cta-ink` y el splash no cambian de tema. El melocotón es la marca.
- **Invariante:** el `scrim` deriva de `scrimBase` (plum tinta) en los DOS temas — en oscuro `plum` es casi blanco y un velo derivado de la paleta activa iluminaría en vez de atenuar.
- **Reglas para código nuevo:** nada de `colors` importado estático en componentes (siempre `useThemeColors()`); un degradado nuevo trae gemelo oscuro o un comentario «marca» que explique por qué no; una pantalla nueva entra en la baseline clara (`@visual`) y también en la oscura (`@dark`, `e2e/visual-dark.spec.ts`) si estrena un primitivo ciego al volteo CSS (vidrio, scrim, gradiente JS, blur). Ojo: el tag es `@dark`, nunca `@visual-dark` — `/@visual/` lo matchearía por substring.
- **Limitaciones aceptadas:** en web, el body llega con el tema correcto desde el primer byte (`app/+html.tsx` + script de `ammen.theme.v1`) pero los degradados JS hidratan después — hay un parpadeo menor en el arranque. Y si el scheme del sistema cambia con la pestaña oculta, la rama JS queda desfasada hasta volver a primer plano con otro cambio o recargar (css-interop descarta eventos con `AppState !== "active"`).
- **No sustituir Amanecer por la paleta violeta del prototipo Vite** (`C:\ammen`). Esa SPA no es este producto. El lenguaje visual de esta app es `prototipo/TOKENS.md`.

## Fuera de este contrato

- (Las tabs sociales ya se unificaron en «Juntos» con Amanecer 3.0; el modo oscuro llegó con Amanecer 4.0.)

## Verificación (comandos, cwd raíz)

| Check | Comando | Notas |
|---|---|---|
| typecheck | `npm run typecheck` | bloqueante |
| lint | `npm run lint` | bloqueante (eslint + prettier -c) |
| unit | `npm run test` | bloqueante |
| db | `npm run db:test` | lento; requiere Supabase local (`npm run db:start`) |

Nada de `npm run deploy:web:staging` ni `firebase deploy`: los deploys los hace el usuario.

## Tipos en `supabase/functions` (Deno)

`npm run typecheck` no mira `supabase/functions/` (está excluido del `tsconfig`: lo compila Deno) y eslint tampoco, así que un error de tipos ahí solo aparece al desplegar. Tras tocar un fichero de esa carpeta, compruébalo aparte:

```bash
npx tsc --noEmit --ignoreConfig --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --allowImportingTsExtensions supabase/functions/<ruta>.ts
```

- **Módulos puros** (`schema.ts`, `bounds.ts`, `prompt.ts`, `sanitize.ts`, `providers/types.ts`, `send-intercession-push/payload.ts`…): **0 errores**.
- **Entradas con runtime Deno** (`index.ts`, `providers/anthropic.ts`, `scripture.ts`): `TS2304 Cannot find name 'Deno'` y `TS2307` de imports `npm:` son esperables sin Deno instalado. Cualquier otro error no lo es: compara con el mismo comando sobre el fichero sin tu cambio.
- Un cambio en esa carpeta trae su propio `*.test.ts`: Vitest es lo único del pipeline que sí lo ejecuta.
