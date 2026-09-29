import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";

import { ErrorState } from "@/components/ScreenState";
import { captureError } from "@/core/observability/track";

/**
 * Lo que se ve cuando una pantalla revienta al pintarse.
 *
 * No había ningún ErrorBoundary: un error de render en producción dejaba la
 * app en blanco, sin salida y sin que nadie se enterara. Expo Router pinta
 * esto en lugar de la ruta rota (se exporta como `ErrorBoundary` desde los
 * layouts), con un reintento que vuelve a montarla, y el fallo sale por
 * `captureError` sin su mensaje.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureError(error, { source: "render" });
  }, [error]);

  return <ErrorState error={error} onRetry={() => void retry()} />;
}
