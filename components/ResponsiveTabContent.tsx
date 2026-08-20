import { ReactNode } from "react";
import { View, ViewProps } from "react-native";

// Literal para que NativeWind descubra también las variantes `md:` aunque el
// componente acepte clases de layout de cada pantalla.
const RESPONSIVE_TAB_CLASSES =
  "box-border self-stretch px-7 md:w-full md:max-w-read md:self-center md:px-10";

/**
 * El ancho común de contenido para las pestañas con más texto.
 *
 * En móvil conserva el margen que ya usaban las pantallas. A partir de `md`
 * evita que tarjetas, formularios y líneas de lectura ocupen todo el monitor:
 * este es el marco de lectura, no el de página — una oración de 1152px no se
 * lee. Si Hoy en tablet decide dos columnas, puede poner `md:max-w-page` en su
 * propio `className` y anular este valor sin tocar el resto.
 */
export const ResponsiveTabContent = ({
  children,
  className,
  ...viewProps
}: ViewProps & { children: ReactNode }) => {
  const resolvedClassName = className
    ? `${RESPONSIVE_TAB_CLASSES} ${className}`
    : RESPONSIVE_TAB_CLASSES;

  return (
    <View {...viewProps} className={resolvedClassName}>
      {children}
    </View>
  );
};
