import { ChevronRight } from "lucide-react-native";
import { forwardRef, ReactNode } from "react";
import { View } from "react-native";

import { Glass } from "@/components/Glass";
import { Tap, TapProps } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { icon, useThemeColors } from "@/theme";

type Props = Omit<TapProps, "children"> & {
  /** Avatar, icono o pila de avatares — lo que identifica la fila. */
  leading?: ReactNode;
  title: string;
  /** La línea secundaria: último mensaje, fecha, censo… */
  meta?: string;
  /** Contador de no leídos, a la derecha. */
  badge?: number;
  /** El punto mudo de "hay algo nuevo", cuando el número exacto no ayuda. */
  dot?: boolean;
  /** Líneas del título antes de cortar; sin ella, el título fluye entero. */
  titleLines?: number;
  /** El chevron de "esto navega". Apagado para filas de acción in situ. */
  chevron?: boolean;
  /** Contenido extra bajo el título (previews más ricas que una línea). */
  children?: ReactNode;
};

/**
 * La fila social del sistema: vidrio plano, algo que la identifica, título,
 * meta y a dónde va. Círculos, avisos, feed, censo, moderación — todas las
 * listas de "cosas con gente dentro" hablaban dialectos distintos del mismo
 * patrón, cada una con su `border-glassedge/60` a mano.
 *
 * `Glass flat` a propósito: estas filas viven en listas y el contrato manda
 * translucidez sin blur dentro de lo que scrollea.
 */
export const ListRow = forwardRef<View, Props>(
  (
    {
      leading,
      title,
      meta,
      badge,
      dot = false,
      titleLines,
      chevron = true,
      children,
      ...tapProps
    },
    ref,
  ) => {
    const colors = useThemeColors();

    return (
      <Tap
        ref={ref}
        accessibilityRole={tapProps.accessibilityRole ?? "button"}
        {...tapProps}
      >
        <Glass
          flat
          readable
          className="min-h-14 flex-row items-center gap-3 rounded-card px-4 py-3 shadow-soft"
        >
          {leading ? <View>{leading}</View> : null}
          <View className="flex-1 gap-0.5">
            <Txt variant="subheading" numberOfLines={titleLines}>
              {title}
            </Txt>
            {meta ? (
              <Txt variant="caption" tone="secondary" numberOfLines={1}>
                {meta}
              </Txt>
            ) : null}
            {children}
          </View>
          {badge ? (
            // El mismo trato que el badge de la tab bar (ember.accent con
            // blanco): son el mismo aviso en dos sitios y deben leerse igual.
            <View className="min-w-6 items-center justify-center rounded-full bg-ember-accent px-2 py-0.5">
              <Txt
                variant="caption"
                tone="onDark"
                className="font-sans-semibold"
              >
                {badge}
              </Txt>
            </View>
          ) : null}
          {dot ? (
            <View className="h-2 w-2 rounded-full bg-ember-accent" />
          ) : null}
          {chevron ? (
            <ChevronRight
              size={icon.sm}
              color={colors.mist.ink}
              strokeWidth={icon.strokeWidth}
            />
          ) : null}
        </Glass>
      </Tap>
    );
  },
);

ListRow.displayName = "ListRow";
