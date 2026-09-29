import type { ReactNode } from "react";

import { ErrorState, LoadingState } from "@/components/ScreenState";
import { Txt } from "@/components/ui/Text";

/**
 * Lo que las tres colas pintan igual: cargando, error con reintento, vacía
 * con su frase, o sus filas.
 */
export const QueueBody = ({
  loading,
  failed,
  onRetry,
  empty,
  emptyText,
  children,
}: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) =>
  loading ? (
    <LoadingState />
  ) : failed ? (
    <ErrorState onRetry={onRetry} />
  ) : empty ? (
    <Txt variant="body" tone="secondary">
      {emptyText}
    </Txt>
  ) : (
    <>{children}</>
  );
