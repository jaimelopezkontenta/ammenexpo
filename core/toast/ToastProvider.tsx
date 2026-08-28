import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { ToastHost, toastHaptic } from "@/components/ui/Toast";

/**
 * El sistema de avisos transitorios: "listo", "no volverás a ver a esta
 * persona", "no se pudo".
 *
 * Antes cada pantalla tenía su `const [notice, setNotice]` con un `setTimeout`
 * de 6 s copiado a mano (dos veces, literal, entre el círculo y su chat) y el
 * aviso se pintaba como un Text suelto que empujaba el layout: el contenido
 * saltaba justo cuando la app quería decir "todo bien".
 *
 * Esto NO es para errores de validación de formulario: un campo mal escrito
 * se señala junto al campo y se queda hasta que se corrige. Aquí vive lo
 * efímero — el resultado de una acción que ya pasó.
 */

export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const DISMISS_MS = 4500;
/** Con más de dos a la vez, el tercero espera: una columna de avisos es ruido. */
const MAX_VISIBLE = 2;

const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast necesita un <ToastProvider> por encima.");
  }
  return api;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++;
      setItems((current) => {
        const next = [...current, { id, message, variant }];
        // Al pasarse del cupo se despide el más viejo, no el nuevo: lo último
        // que hiciste es lo que quieres ver confirmado.
        const overflow = next.length - MAX_VISIBLE;
        if (overflow > 0) {
          for (const item of next.slice(0, overflow)) {
            const timer = timers.current.get(item.id);
            if (timer) clearTimeout(timer);
            timers.current.delete(item.id);
          }
          return next.slice(overflow);
        }
        return next;
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_MS),
      );
      // La háptica acompaña al aviso — éxito, advertencia o nada de especial —
      // no al toque que lo causó, que ya tuvo la suya.
      toastHaptic(variant);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};
