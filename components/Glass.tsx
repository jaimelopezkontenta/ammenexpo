import { BlurView } from "expo-blur";
import { cssInterop } from "nativewind";
import { ReactNode } from "react";
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from "react-native";

// `BlurView` viene de fuera de React Native, así que NativeWind no sabe que su
// `className` se traduce a `style`. Sin esta línea las clases de la tab bar y
// de las tarjetas se quedarían sin aplicar.
cssInterop(BlurView, { className: "style" });

/**
 * El material de todo el UI: vidrio esmerilado sobre los degradados.
 *
 * Tres cosas hacen que parezca vidrio y no un blanco con opacidad, y las tres
 * viven aquí para que no se repitan mal por ahí:
 *
 *   1. el desenfoque de lo que hay detrás,
 *   2. un borde blanco muy claro, que es el canto,
 *   3. un reflejo especular en el filo de arriba, que es donde daría la luz.
 *
 * **`readable` no es decoración.** El vidrio de contenedor deja pasar el 42 %
 * de blanco y sobre el durazno del home eso baja el contraste del texto. Toda
 * superficie que lleve algo que haya que leer usa el del 58 %, que es donde los
 * pares de `tailwind.config.js` están medidos.
 *
 * **`flat` es la regla de rendimiento.** Un blur real dentro de una lista
 * virtualizada se recompone en cada fila que entra y en Android se nota: ahí se
 * degrada a translucidez sin desenfoque, que mantiene el aspecto y no el coste.
 * Vidrio estático sí; vidrio dentro de una `FlatList`, `flat`.
 */

type Props = ViewProps & {
  children?: ReactNode;
  /** Para superficies con texto: sube el blanco del 42 % al 58 %. */
  readable?: boolean;
  /** Vidrio oscuro: chips y pills activas, burbuja de mensaje propio. */
  dark?: boolean;
  /** Sin desenfoque, solo translucidez. Obligatorio dentro de listas largas. */
  flat?: boolean;
  intensity?: number;
};

const LIGHT_TINT = "rgba(255, 255, 255, 0.42)";
const LIGHT_TINT_READABLE = "rgba(255, 255, 255, 0.58)";
const DARK_TINT = "rgba(77, 64, 92, 0.60)";

const LIGHT_BORDER = "rgba(255, 255, 255, 0.65)";
const DARK_BORDER = "rgba(255, 255, 255, 0.28)";

/**
 * `className` se desestructura y se escribe a mano abajo. NativeWind compila
 * la clase donde ve el atributo escrito en el JSX; si llega por un spread, la
 * cadena se pasa sin convertir y no pinta nada en nativo.
 */
export const Glass = ({
  children,
  readable = false,
  dark = false,
  flat = false,
  intensity,
  style,
  className,
  ...viewProps
}: Props) => {
  const tint = dark ? DARK_TINT : readable ? LIGHT_TINT_READABLE : LIGHT_TINT;

  const base: ViewStyle = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark ? DARK_BORDER : LIGHT_BORDER,
    overflow: "hidden",
  };

  // El reflejo del filo superior. En web es un `inset box-shadow`; en nativo no
  // existen las sombras interiores, así que es una línea absoluta de 1 px, que
  // es exactamente lo que la sombra dibujaría.
  const specular = (
    <View
      pointerEvents="none"
      style={[
        styles.specular,
        { backgroundColor: dark ? DARK_BORDER : "rgba(255,255,255,0.78)" },
      ]}
    />
  );

  if (flat) {
    return (
      <View
        {...viewProps}
        className={className}
        style={[base, { backgroundColor: tint }, style]}
      >
        {specular}
        {children}
      </View>
    );
  }

  return (
    <BlurView
      {...viewProps}
      className={className}
      intensity={intensity ?? (dark ? 14 : 22)}
      tint={dark ? "dark" : "light"}
      // En Android el blur nativo no viene de serie; este método lo habilita.
      // Si el dispositivo no puede, `expo-blur` cae a un tinte plano, que es
      // justo lo que hace `flat` — así que el peor caso sigue siendo correcto.
      experimentalBlurMethod={
        Platform.OS === "android" ? "dimezisBlurView" : undefined
      }
      style={[base, { backgroundColor: tint }, style]}
    >
      {specular}
      {children}
    </BlurView>
  );
};

const styles = StyleSheet.create({
  specular: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});
