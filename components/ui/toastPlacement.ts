/**
 * Dónde flotan los avisos: la parte pura, para probarla sin React Native.
 *
 * Abajo, encima de la barra de pestañas (62) y de la zona segura, con dos
 * excepciones que los tapaban:
 *
 * - El teclado en iOS, que no empuja la ventana: el aviso quedaba debajo. Con
 *   el teclado abierto se apoya encima de él.
 * - Lo que una pantalla pone flotando abajo, como el «Ya oré hoy» gemelo de
 *   Hoy: el aviso se le montaba encima. La pantalla lo declara con
 *   `raiseToasts(px)` mientras está a la vista y los avisos suben eso.
 */

/** Por encima de la barra de pestañas (62) con un poco de aire. */
export const TOAST_BOTTOM_OFFSET = 76;
/** El aire entre el aviso y el borde del teclado. */
export const TOAST_KEYBOARD_GAP = 12;

export const toastBottomOffset = ({
  safeBottom,
  keyboardHeight,
  lift,
}: {
  safeBottom: number;
  keyboardHeight: number;
  lift: number;
}): number =>
  // El teclado tapa la barra y lo que flote sobre ella: con él abierto solo
  // cuenta su borde (su altura ya incluye la zona segura).
  keyboardHeight > 0
    ? keyboardHeight + TOAST_KEYBOARD_GAP
    : safeBottom + TOAST_BOTTOM_OFFSET + Math.max(0, lift);

type Listener = () => void;

const raises = new Map<number, number>();
const listeners = new Set<Listener>();
let nextId = 1;

const notify = () => {
  for (const listener of listeners) listener();
};

/** Cuánto suben ahora los avisos: lo más alto que se haya pedido. */
export const toastLift = (): number => Math.max(0, ...raises.values());

export const subscribeToastLift = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Sube los avisos `px`; devuelve con qué deshacerlo. */
export const raiseToasts = (px: number): (() => void) => {
  const id = nextId++;
  raises.set(id, px);
  notify();

  return () => {
    if (raises.delete(id)) notify();
  };
};
