import {
  Easing,
  FadeInDown,
  FadeIn,
  SlideInDown,
  ZoomIn,
} from "react-native-reanimated";

/**
 * El vocabulario de movimiento del sistema — para que las duraciones y las
 * curvas no se re-inventen pantalla a pantalla como pasaba con los radios.
 *
 * Reglas que protegen los e2e y el rendimiento:
 * - nada que responda a una interacción dura más de 300 ms (Playwright las
 *   absorbe con su auto-wait); los **bucles ambientales** (`AMBIENT`) son la
 *   excepción medida: respiraciones y derivas que no bloquean nada, y que se
 *   apagan siempre con `useReducedMotion()` — el harness visual los congela
 *   con `reducedMotion: "reduce"`;
 * - el escalonado se capa a 6 elementos: a partir de ahí el ojo ya no separa
 *   la entrada y solo se estaría retrasando el contenido;
 * - en listas virtualizadas (`FlatList`) la entrada se aplica solo a los
 *   primeros elementos (`index < 8`) y nunca `LinearTransition` en listas
 *   largas ni `itemLayoutAnimation` con paginación;
 * - todo componente que anime consulta `useReducedMotion()` (Reanimated
 *   silencia `entering` solo, pero las animaciones manuales no).
 */

export const DURATION = {
  /** Cambios de estado in situ: chips, toggles, focus. */
  state: 150,
  /** Entradas de contenido. */
  enter: 220,
  /** Salidas — siempre más rápidas que las entradas. */
  exit: 180,
} as const;

export const EASE = Easing.out(Easing.cubic);

/**
 * La física del sistema. Tres muelles y ya: la respuesta al dedo, el
 * asentarse de una hoja y la única celebración que rebota. Antes cada
 * componente traía sus números y el tacto de la app era de tres apps.
 */
export const SPRING = {
  /** Hojas y asentamientos suaves. */
  gentle: { damping: 18, stiffness: 160 },
  /** La respuesta al dedo (el muelle de `Tap`). */
  standard: { damping: 20, stiffness: 350 },
  /** Celebración — el único muelle que rebota. */
  bouncy: { damping: 14, stiffness: 180 },
} as const;

/**
 * Los bucles y gestos ambientales, en milisegundos. Son la excepción medida a
 * la regla de 300 ms (ver arriba): no responden a ninguna interacción y se
 * apagan con `useReducedMotion()`.
 */
export const AMBIENT = {
  /** El pulso del esqueleto de carga. */
  pulse: 1100,
  /** La respiración del orbe en reposo. */
  breathe: 4200,
  /** La respiración del orbe trabajando (generando el plan): más corta. */
  breatheBusy: 2600,
  /** Medio ciclo de la deriva de luz del orbe (va y vuelve: 24 s el giro). */
  drift: 12000,
  /** El amanecer del arranque: la luz sube a su sitio una sola vez. */
  dawn: 700,
} as const;

/** Hasta dónde se hunde y se atenúa lo tocable (los defaults de `Tap`). */
export const PRESS = { scaleTo: 0.97, dimTo: 0.92 } as const;

/** La entrada de una hoja (ActionMenu, PlanOptionsSheet y las que vengan). */
export const enterSheet = SlideInDown.springify().damping(
  SPRING.gentle.damping,
);

/** La entrada de una celebración (el amén del día). */
export const enterCelebrate = ZoomIn.springify()
  .damping(SPRING.bouncy.damping)
  .stiffness(SPRING.bouncy.stiffness);

const STAGGER_MS = 40;
const STAGGER_CAP = 6;

/** Entrada escalonada para los bloques de una pantalla: `entering={enterStagger(i)}`. */
export const enterStagger = (index: number) =>
  FadeInDown.duration(DURATION.enter)
    .delay(Math.min(index, STAGGER_CAP) * STAGGER_MS)
    .easing(EASE);

/** Entrada simple, sin desplazamiento: para contenido que cambia in situ. */
export const enterFade = FadeIn.duration(DURATION.enter).easing(EASE);

/**
 * `enterFade` con retardo, construida fresca: los builders de Reanimated son
 * instancias mutables, y un `.delay()` sobre el compartido retrasaría todas
 * las entradas de la app.
 */
export const enterFadeAfter = (delayMs: number) =>
  FadeIn.duration(DURATION.enter).easing(EASE).delay(delayMs);

/** Entrada de filas en `FlatList`: solo las primeras, el resto llega por scroll. */
export const enterListItem = (index: number) =>
  index < 8 ? enterStagger(index) : undefined;
