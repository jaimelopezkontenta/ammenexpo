/**
 * Qué hace un toque en una acción de `ActionMenu`: cerrar siempre, y la acción
 * ya o cuando el menú se haya ido del todo.
 *
 * Hasta aquí todas corrían en el mismo toque que cerraba el menú. Para
 * reportar da igual, pero una acción que abre otro Modal (la confirmación de
 * bloquear) lo montaba encima de uno que todavía se estaba yendo, y en iOS un
 * Modal que se presenta mientras otro se retira puede no llegar a salir.
 * AGENTS.md: navegar o abrir desde un overlay, después de `onClosed`.
 *
 * Compartir no espera: en web `navigator.share` y el portapapeles piden el
 * gesto del usuario, y un temporizador de por medio puede perderlo.
 *
 * Solo queda una pendiente: el menú se cierra con el primer toque, así que no
 * hay un segundo. Y al volver a abrirse se olvida, por si el cierre anterior
 * no llegó a avisar: mejor no hacer nada que hacerlo tarde y por sorpresa.
 */
export type ActionMenuRunnerItem = {
  onPress: () => void;
  /** Esperar a que el menú se haya ido: para abrir otro Modal o navegar. */
  afterClose?: boolean;
};

export type ActionMenuRunner = {
  /** El toque: `close` cierra el menú (el `onClose` del padre). */
  press: (item: ActionMenuRunnerItem, close: () => void) => void;
  /** El menú ya no está (el `onClosed` de `useSheetClosed`). */
  closed: () => void;
  /** El menú vuelve a abrirse. */
  opened: () => void;
};

export const createActionMenuRunner = (): ActionMenuRunner => {
  let pending: (() => void) | null = null;

  return {
    press: (item, close) => {
      if (item.afterClose) {
        pending = item.onPress;
        close();
        return;
      }

      close();
      item.onPress();
    },
    closed: () => {
      const next = pending;
      pending = null;
      next?.();
    },
    opened: () => {
      pending = null;
    },
  };
};
