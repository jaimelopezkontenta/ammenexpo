import { BlurView } from "expo-blur";
import { cssInterop } from "nativewind";
import { ReactNode } from "react";
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from "react-native";

import { useDawnBlurTarget } from "@/components/DawnBackground";
import { useIsDark, useThemeColors, withAlpha } from "@/theme";

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
  /** Relleno del vidrio (0–1). La barra usa 0.55 según `prototipo/TOKENS.md`. */
  fill?: number;
};

// El vidrio "oscuro" (pills, burbuja propia) es plum en los dos temas; el
// vidrio claro y sus cantos salen de la paleta activa: blanco de día, violeta
// profundo de noche.
const DARK_TINT = "rgba(77, 64, 92, 0.60)";
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
  fill,
  style,
  className,
  ...viewProps
}: Props) => {
  const palette = useThemeColors();
  const isDark = useIsDark();

  const tint = dark
    ? DARK_TINT
    : withAlpha(palette.glass, fill ?? (readable ? 0.58 : 0.42));

  const blurTarget = useDawnBlurTarget();

  const base: ViewStyle = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark ? DARK_BORDER : withAlpha(palette.glassedge, 0.65),
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
        {
          backgroundColor: dark
            ? DARK_BORDER
            : withAlpha(palette.glassedge, 0.78),
        },
      ]}
    />
  );

  // En Android, el blur necesita un target explícito (expo-blur 56): un ref a
  // la vista que se desenfoca. Sin target (la tab bar no vive dentro de un
  // `DawnBackground`), `flat` es lo honesto: translucidez sin fingir blur.
  const effectiveFlat = flat || (Platform.OS === "android" && !blurTarget);

  if (effectiveFlat) {
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
      // De noche el desenfoque también es oscuro: un blur "light" sobre el
      // anochecer lo lavaría a gris.
      tint={dark || isDark ? "dark" : "light"}
      // `dimezisBlurViewSdk31Plus` y no `dimezisBlurView`, que es el que se
      // suele copiar. La diferencia está medida por Expo: el desenfoque solo
      // es barato con la API RenderNode, que llegó en Android 12 (SDK 31). Por
      // debajo, `dimezisBlurView` cae a RenderScript, que su propia
      // documentación llama "mucho menos eficiente"; esta variante cae a nada
      // y deja un tinte translúcido.
      //
      // O sea: en Android 12 o superior se ve el vidrio, y en un teléfono
      // viejo —que es justo donde un desenfoque por fotograma se notaría— se
      // ve exactamente lo mismo que ya hace `flat`. No hay que elegir entre el
      // efecto y el rendimiento, y no hay que adivinar el parque de
      // dispositivos.
      blurMethod={
        Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined
      }
      // El ref al fondo que se desenfoca. Solo Android lo usa: en iOS el blur
      // es el nativo del sistema y no necesita target. El `?? undefined` es
      // para TypeScript —aquí el target ya es seguro, lo cubrió `effectiveFlat`.
      blurTarget={
        Platform.OS === "android" ? (blurTarget ?? undefined) : undefined
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
