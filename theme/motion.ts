import { Easing, FadeInDown, FadeIn } from "react-native-reanimated";

/**
 * El vocabulario de movimiento del sistema — para que las duraciones y las
 * curvas no se re-inventen pantalla a pantalla como pasaba con los radios.
 *
 * Reglas que protegen los e2e y el rendimiento:
 * - nada dura más de 300 ms (Playwright las absorbe con su auto-wait);
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

const STAGGER_MS = 40;
const STAGGER_CAP = 6;

/** Entrada escalonada para los bloques de una pantalla: `entering={enterStagger(i)}`. */
export const enterStagger = (index: number) =>
  FadeInDown.duration(DURATION.enter)
    .delay(Math.min(index, STAGGER_CAP) * STAGGER_MS)
    .easing(EASE);

/** Entrada simple, sin desplazamiento: para contenido que cambia in situ. */
export const enterFade = FadeIn.duration(DURATION.enter).easing(EASE);

/** Entrada de filas en `FlatList`: solo las primeras, el resto llega por scroll. */
export const enterListItem = (index: number) =>
  index < 8 ? enterStagger(index) : undefined;
