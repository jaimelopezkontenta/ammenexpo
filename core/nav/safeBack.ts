import { router, type Href } from "expo-router";

/**
 * Volver con salida. `router.back()` no hace nada si se abrió la pantalla en
 * frío (notificación, deep link): quien entra así se queda atrapado.
 */
export const goBackOr = (fallback: Href) => {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
};
