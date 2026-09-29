import { router, usePathname, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState } from "@/components/ScreenState";
import { captureError } from "@/core/observability/track";

/**
 * Lo que se ve cuando una pantalla revienta al pintarse.
 *
 * No había ningún ErrorBoundary: un error de render en producción dejaba la
 * app en blanco, sin salida y sin que nadie se enterara. Expo Router pinta
 * esto en lugar de la ruta rota (se exporta como `ErrorBoundary` desde las
 * pestañas), con un reintento que vuelve a montarla, y el fallo sale por
 * `captureError` sin su mensaje.
 *
 * Reintentar no arregla un error que se repite al pintar, así que además hay
 * una salida: «Ir a Hoy». No se ofrece en Hoy mismo, donde sería ir al sitio
 * que acaba de fallar.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  useEffect(() => {
    captureError(error, { source: "render" });
  }, [error]);

  return (
    <ErrorState
      error={error}
      onRetry={() => void retry()}
      secondaryAction={
        pathname === "/"
          ? undefined
          : { title: t("common.goToday"), onPress: () => router.replace("/") }
      }
    />
  );
}

/**
 * La del layout raíz (`app/_layout.tsx`), solo con reintento.
 *
 * Esta envuelve el propio layout: cuando revienta, el `Stack` y los
 * proveedores (sesión, consultas) no están montados, así que no hay
 * navegador al que pedirle «Ir a Hoy» — y aunque lo hubiera, el error seguiría
 * pintado hasta reintentar, porque el que falla es el layout y no una ruta.
 */
export function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureError(error, { source: "render" });
  }, [error]);

  return <ErrorState error={error} onRetry={() => void retry()} />;
}
