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
 */
export const EmptyState = ({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  /** La acción opcional debajo del texto — un Button o un Link ya montado. */
  children?: ReactNode;
}) => (
  <View className="items-center gap-3 px-6 py-10">
    <Orb size={56} animated={false} />
    <Txt variant="editorial" className="pt-1 text-center">
      {title}
    </Txt>
    {body ? (
      <Txt tone="secondary" className="text-center">
        {body}
      </Txt>
    ) : null}
    {children ? <View className="w-full pt-2">{children}</View> : null}
  </View>
);
