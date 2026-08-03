import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

/**
 * El amanecer, en seis variantes.
 *
 * Las paradas están aquí y no en cada pantalla por el mismo motivo que los
 * colores viven en `tailwind.config.js`: un degradado repetido a mano en
 * veinte ficheros deja de ser un degradado y pasa a ser veinte degradados
 * parecidos. La fuente es `prototipo/TOKENS.md`.
 *
 * Ninguno llega al naranja pleno. Los del montaje de diseño sí, y sostenidos
 * durante una lectura larga cansaban: están despastelados ~40 % hacia el tono
 * de Círculos, que es `comm` y sirve de referencia.
 */
export type DawnVariant =
  /** Splash, acceso y perfil: halo crema al centro sobre periwinkle. */
  | "radial"
  /** Onboarding: cálido arriba, frío abajo. */
  | "warm"
  /** El inverso, para las pantallas que van después de una cálida. */
  | "cool"
  /** Hoy: crema arriba y rubor durazno abajo. */
  | "home"
  /** La imagen 9:16 que se comparte. */
  | "story"
  /** Círculos y comunidad: plano, sin degradado. */
  | "comm";

const LINEAR: Record<
  Exclude<DawnVariant, "radial" | "comm">,
  {
    colors: readonly [string, string, string];
    locations: readonly [number, number, number];
  }
> = {
  warm: { colors: ["#FFF1DD", "#F8EDDE", "#D8E1F1"], locations: [0, 0.55, 1] },
  cool: { colors: ["#D8E1F1", "#F8EDDE", "#FFF1DD"], locations: [0, 0.45, 1] },
  home: { colors: ["#FFF6EA", "#FCEBD8", "#F9DBBF"], locations: [0, 0.55, 1] },
  story: { colors: ["#FFF1DD", "#FCEBD8", "#F9DBBF"], locations: [0, 0.6, 1] },
};

/** El periwinkle de fondo del radial, que se abre un poco por el centro. */
const RADIAL_BASE = ["#C7D6F2", "#D2DEF4", "#C7D6F2"] as const;

type Props = ViewProps & {
  variant: DawnVariant;
  children?: ReactNode;
};

export const DawnBackground = ({
  variant,
  children,
  style,
  ...viewProps
}: Props) => {
  if (variant === "comm") {
    return (
      <View
        {...viewProps}
        style={[styles.fill, { backgroundColor: "#FDF3E9" }, style]}
      >
        {children}
      </View>
    );
  }

  if (variant === "radial") {
    return (
      <View {...viewProps} style={[styles.fill, style]}>
        <LinearGradient
          colors={RADIAL_BASE}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/*
          `expo-linear-gradient` no hace radiales, así que el halo va en SVG.
          Es una elipse ancha y baja, como en el diseño: no un círculo, que
          deja el centro con forma de foco.
        */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="dawnGlow" cx="50%" cy="47%" rx="90%" ry="55%">
              <Stop offset="0" stopColor="#FFF1DD" stopOpacity="1" />
              <Stop offset="0.45" stopColor="#FFF1DD" stopOpacity="0.55" />
              <Stop offset="0.72" stopColor="#FFF1DD" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="47%" rx="90%" ry="55%" fill="url(#dawnGlow)" />
        </Svg>
        {children}
      </View>
    );
  }

  const { colors, locations } = LINEAR[variant];

  return (
    <LinearGradient
      {...viewProps}
      colors={colors}
      locations={locations}
      style={[styles.fill, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
