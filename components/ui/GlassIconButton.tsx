import type { ReactNode } from "react";

import { Tap, type TapProps } from "@/components/ui/Tap";

/**
 * El botón redondo de vidrio con un icono dentro: el `···` de Hoy, las A−/A+
 * del lector, los anterior/siguiente del día y del capítulo, «cargar más».
 *
 * Estaba copiado siete veces con las mismas clases, y cada copia podía
 * derivar sola (una ya había perdido el borde). 44×44: la zona táctil mínima.
 */
export const GlassIconButton = ({
  accessibilityLabel,
  children,
  disabled,
  className = "",
  ...tapProps
}: Omit<TapProps, "children" | "accessibilityLabel"> & {
  /** Obligatorio: un botón de solo icono no tiene otro nombre. */
  accessibilityLabel: string;
  children: ReactNode;
  className?: string;
}) => (
  <Tap
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    disabled={disabled}
    className={`h-11 w-11 items-center justify-center rounded-full border border-glassedge/60 bg-glass/60 ${
      disabled ? "opacity-40" : ""
    } ${className}`}
    {...tapProps}
  >
    {children}
  </Tap>
);
