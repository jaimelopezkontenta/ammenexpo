import { ReactNode, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";

/**
 * El isotipo. **Este fichero es el único sitio de la app donde viven sus
 * colores**, igual que `.orb` es el único del prototipo.
 *
 * La regla salió de encontrarse la pestaña Orar pintada con un degradado
 * naranja inventado: cualquier cosa que simule el isotipo —el arranque, la
 * marca de agua de la imagen que se comparte, la pestaña, un estado vacío, el
 * icono de la app— tiene que ser este componente a la escala que toque. **El
 * isotipo nunca es naranja**: el naranja vive en el CTA, el acento, el
 * progreso y el indicador de pestaña activa, y en ningún otro sitio.
 *
 * Es SVG y no un PNG a propósito. Un PNG habría que exportarlo a tres
 * resoluciones y se desincronizaría del prototipo en cuanto alguien tocara un
 * color; así hay una sola definición y escala igual en un splash de 150 px que
 * en una pestaña de 26.
 */

/** Las cinco capas del orbe, de abajo a arriba, sobre un lienzo de 100×100. */
const LAYERS = [
  { id: "orbBase", cx: 50, cy: 50, r: 70.7, color: "#EDE6F6", edge: "#BFC3EF" },
  { id: "orbBlue", cx: 50, cy: 82, r: 57.6, color: "#CFECF9" },
  { id: "orbLilac", cx: 78, cy: 45, r: 52.5, color: "#D3CEF0" },
  { id: "orbLavender", cx: 22, cy: 45, r: 52.5, color: "#D4D0EF" },
  { id: "orbPeach", cx: 50, cy: 22, r: 38.9, color: "#F8E2D1" },
] as const;

const BREATHE_MS = 4200;
const BREATHE_SCALE = 1.055;

type Props = {
  size: number;
  /** El halo crema de alrededor. Sobra en tamaños pequeños. */
  halo?: boolean;
  /** Se para la respiración; también se para sola si el sistema pide menos movimiento. */
  animated?: boolean;
  /** El wordmark, cuando el orbe lo lleva dentro. */
  children?: ReactNode;
};

export const Orb = ({
  size,
  halo = false,
  animated = true,
  children,
}: Props) => {
  const phase = useSharedValue(0);
  // Quien ha pedido menos movimiento en el sistema no quiere una esfera
  // latiendo en cada pantalla. Se queda quieta y no pasa nada: el isotipo se
  // reconoce por el color, no por el pulso.
  const reduceMotion = useReducedMotion();
  const moving = animated && !reduceMotion;

  useEffect(() => {
    if (!moving) {
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(1, {
        duration: BREATHE_MS / 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [moving, phase]);

  const sphereStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + phase.value * (BREATHE_SCALE - 1) }],
  }));

  // El halo respira en fase con la esfera, pero en opacidad: si escalara
  // también, el conjunto se vería como un solo bulto creciendo.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + phase.value * 0.3,
  }));

  const haloSize = size * 1.36;

  return (
    <View
      style={{ width: size, height: size }}
      // Es una marca, no información: quien no la ve no se pierde nada.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {halo ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            haloStyle,
            {
              width: haloSize,
              height: haloSize,
              top: (size - haloSize) / 2,
              left: (size - haloSize) / 2,
            },
          ]}
        >
          <Svg width={haloSize} height={haloSize} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="orbHalo" cx="50%" cy="50%" r="50%">
                <Stop offset="0.3" stopColor="#FFE7C3" stopOpacity="0.45" />
                <Stop offset="0.7" stopColor="#FFE7C3" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill="url(#orbHalo)" />
          </Svg>
        </Animated.View>
      ) : null}

      <Animated.View style={[{ width: size, height: size }, sphereStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            {LAYERS.map((layer) => (
              <RadialGradient
                key={layer.id}
                id={layer.id}
                cx={layer.cx}
                cy={layer.cy}
                r={layer.r}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={layer.color} stopOpacity="1" />
                <Stop
                  offset="1"
                  stopColor={"edge" in layer ? layer.edge : layer.color}
                  stopOpacity={"edge" in layer ? 1 : 0}
                />
              </RadialGradient>
            ))}
            <RadialGradient id="orbRim" cx="50%" cy="50%" r="50%">
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.38" />
            </RadialGradient>
            {/* Las capas se salen de la esfera: sin esto, el orbe sería un cuadrado. */}
            <ClipPath id="orbClip">
              <Circle cx="50" cy="50" r="50" />
            </ClipPath>
          </Defs>
          {LAYERS.map((layer) => (
            <Circle
              key={layer.id}
              cx="50"
              cy="50"
              r="50"
              fill={`url(#${layer.id})`}
              clipPath="url(#orbClip)"
            />
          ))}
          {/*
            El brillo del borde hacia dentro. En el prototipo es un
            `box-shadow: inset`, que en SVG no existe: aquí es una capa más,
            transparente en el centro y blanca en el filo. Es lo que hace que
            la esfera parezca vidrio y no un círculo de color.
          */}
          <Circle cx="50" cy="50" r="50" fill="url(#orbRim)" />
        </Svg>
        {children ? <View style={styles.center}>{children}</View> : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  halo: { position: "absolute" },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
