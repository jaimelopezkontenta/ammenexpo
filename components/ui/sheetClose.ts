import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { DURATION } from "@/theme/motion";

/**
 * `onClosed` de las hojas: una llamada por cierre, en todas las plataformas.
 *
 * El Modal de React Native solo dispara `onDismiss` en iOS. Las hojas lo
 * simulaban con un temporizador únicamente en web, así que en Android
 * `onClosed` no llegaba nunca y lo que esperaba al cierre —ir a los días,
 * compartir— no pasaba. Fuera de iOS manda el temporizador (la duración de
 * salida); en iOS, `onDismiss`. Si en web el Modal también avisa, el primero
 * que llegue gana y el segundo no hace nada.
 *
 * Solo cuenta como cierre pasar de abierta a cerrada: una hoja que se monta
 * cerrada no «se cierra», y antes en web disparaba `onClosed` al montarse.
 */
export const closesOnDismiss = (os: string) => os === "ios";

export type SheetCloseController = {
  /** Cada vez que cambia `visible`. */
  setVisible: (visible: boolean) => void;
  /** Para `Modal.onDismiss`. */
  dismissed: () => void;
  /** Lo último que pasó el padre: el cierre llama al de ese momento. */
  setOnClosed: (onClosed: (() => void) | undefined) => void;
  /** Al desmontar: un cierre pendiente ya no navega desde una pantalla que no está. */
  dispose: () => void;
};

export const createSheetCloseController = ({
  os,
  delayMs,
  onClosed: initialOnClosed,
}: {
  os: string;
  delayMs: number;
  onClosed?: () => void;
}): SheetCloseController => {
  let onClosed = initialOnClosed;
  let open = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const dismissed = () => {
    clear();
    if (!open) return;
    open = false;
    onClosed?.();
  };

  return {
    setVisible: (visible) => {
      clear();
      if (visible) {
        open = true;
        return;
      }
      if (open && !closesOnDismiss(os)) {
        timer = setTimeout(dismissed, delayMs);
      }
    },
    dismissed,
    setOnClosed: (next) => {
      onClosed = next;
    },
    dispose: clear,
  };
};

/** El gancho de las hojas: devuelve lo que va en `Modal.onDismiss`. */
export const useSheetClosed = (visible: boolean, onClosed?: () => void) => {
  const [controller] = useState(() =>
    createSheetCloseController({ os: Platform.OS, delayMs: DURATION.exit }),
  );

  useEffect(() => {
    controller.setOnClosed(onClosed);
  }, [controller, onClosed]);

  useEffect(() => {
    controller.setVisible(visible);
  }, [controller, visible]);

  useEffect(() => () => controller.dispose(), [controller]);

  return controller.dismissed;
};
