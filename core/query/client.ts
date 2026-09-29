import {
  focusManager,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

import { captureError, isExpectedError } from "@/core/observability/track";

/** La raíz de una query key (`["todayDay", planId]` → `"todayDay"`). */
const keyRoot = (key: readonly unknown[] | undefined): string | undefined =>
  typeof key?.[0] === "string" ? key[0] : undefined;

/**
 * El cliente de React Query de la app.
 *
 * Todo error de una query o una mutación pasa por `captureError`: hasta aquí
 * ninguno se reportaba en ningún sitio, y un fallo que solo ve quien lo sufre
 * no se arregla. Solo sale la raíz de la clave, nunca sus parámetros.
 *
 * Menos los esperados (`isExpectedError`): «ya oraste», «límite de planes»…
 * son respuestas que la pantalla ya explica, no fallos.
 */
export const createQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isExpectedError(error)) return;
        captureError(error, { source: "query", key: keyRoot(query.queryKey) });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (isExpectedError(error)) return;
        captureError(error, {
          source: "mutation",
          key: keyRoot(mutation.options.mutationKey),
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  });

/**
 * Volver a la app cuenta como volver a mirar.
 *
 * En web React Query ya escucha el foco de la ventana; en nativo no hay
 * ventana, y sin esto nada se refrescaba al volver del fondo: tras una noche,
 * Hoy seguía enseñando el día de ayer. Devuelve la función que lo desengancha.
 */
export const wireAppFocus = (): (() => void) => {
  if (Platform.OS === "web") return () => {};

  const subscription = AppState.addEventListener("change", (status) => {
    focusManager.setFocused(status === "active");
  });

  return () => subscription.remove();
};
