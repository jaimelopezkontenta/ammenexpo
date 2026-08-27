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
- Texto de lectura larga: `Txt` (`bodySerifReading`, `title`, `editorial`). Referencias bíblicas en editorial / ember-ink.

## Navegación

- `router.back()` solo si hay historial; si no, `goBackOr(destinoSeguro)` (`core/nav/safeBack.ts`).
- Un overlay (sheet, menú) tiene **un** control «Cerrar» anunciado. El scrim no es un segundo botón.
- Navegar desde un sheet **después** de que el Modal se haya cerrado (`onClosed`), no en el mismo tap.

## Fuera de este contrato

- Unificar tabs sociales y modo oscuro son decisiones de roadmap, no parches locales.
