import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { classifyError } from "@/core/net/classifyError";
import { useToast } from "@/core/toast/ToastProvider";

/**
 * Hacer algo que puede fallar y decir cómo fue.
 *
 * El mismo `run(action, done)` estaba copiado en nueve pantallas, cada una con
 * su `[notice, setNotice]` y su `[error, setError]` locales pintados en línea,
 * aunque el toast existía justo para esto. Aquí: el éxito es un toast (si hay
 * algo que decir), el fallo es un toast que distingue «sin conexión» de «algo
 * salió mal», y `pending` sirve para el spinner del botón.
 *
 * Devuelve si salió bien, para quien tenga que hacer algo después.
 */
export const useAction = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (action: () => Promise<unknown>, done?: string): Promise<boolean> => {
      setPending(true);
      try {
        await action();
        if (done) toast.success(done);
        return true;
      } catch (error) {
        toast.error(
          classifyError(error) === "network"
            ? t("common.errorNetwork")
            : t("common.errorGeneric"),
        );
        return false;
      } finally {
        setPending(false);
      }
    },
    [t, toast],
  );

  return { run, pending };
};
