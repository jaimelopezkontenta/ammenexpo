import { ChevronRight } from "lucide-react-native";
import { forwardRef } from "react";
import { View } from "react-native";

import { Tap, TapProps } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { icon, useThemeColors } from "@/theme";

/**
 * Una fila de navegación: label a la izquierda, chevron a la derecha.
 *
 * Existe porque "Comunidad y soporte" era una pila de seis `Button ghost`
 * idénticos — seis CTAs del mismo peso para seis enlaces que solo llevan a
 * otra pantalla. Una lista con chevrons dice "esto navega" sin gritar seis
 * veces.
 *
 * `forwardRef` para poder vivir dentro de `<Link asChild>`.
 */
export const NavRow = forwardRef<View, TapProps & { label: string }>(
  ({ label, ...tapProps }, ref) => {
    const colors = useThemeColors();

    return (
      <Tap
        ref={ref}
        accessibilityRole="link"
        accessibilityLabel={label}
        className="min-h-12 flex-row items-center justify-between gap-3 py-2"
        {...tapProps}
      >
        <Txt variant="body" className="flex-1">
          {label}
        </Txt>
        <ChevronRight
          size={icon.sm}
          color={colors.mist.ink}
          strokeWidth={icon.strokeWidth}
        />
      </Tap>
    );
  },
);

NavRow.displayName = "NavRow";
