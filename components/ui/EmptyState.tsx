import { ReactNode } from "react";
import { View } from "react-native";

import { Orb } from "@/components/Orb";
import { Txt } from "@/components/ui/Text";

/**
 * El estado vacío del sistema: el orbe pequeño y quieto, un título y el
 * porqué. Antes cada pantalla vacía era dos líneas de gris flotando en el
 * amanecer — correcto, pero mudo: nada decía que el vacío era de la app y no
 * un fallo de carga.
 *
 * El orbe va estático (`animated={false}`): es una marca de lugar, no el
 * protagonista respirando en una pantalla sin contenido.
 *
 * `size="inline"` es el mismo gesto dentro de una sección (el chat vacío, el
 * bloque "Por otros", los comentarios): orbe más chico, menos aire, para que
 * el vacío local no pese tanto como el de una pantalla entera.
 */
export const EmptyState = ({
  title,
  body,
  size = "screen",
  children,
}: {
  title: string;
  body?: string;
  size?: "screen" | "inline";
  /** La acción opcional debajo del texto — un Button o un Link ya montado. */
  children?: ReactNode;
}) => (
  <View
    className={
      size === "inline"
        ? "items-center gap-2 px-4 py-5"
        : "items-center gap-3 px-6 py-10"
    }
  >
    <Orb size={size === "inline" ? 40 : 56} animated={false} />
    <Txt variant="editorial" className="pt-1 text-center">
      {title}
    </Txt>
    {body ? (
      <Txt
        tone="secondary"
        className="text-center"
        variant={size === "inline" ? "caption" : "body"}
      >
        {body}
      </Txt>
    ) : null}
    {children ? <View className="w-full pt-2">{children}</View> : null}
  </View>
);
