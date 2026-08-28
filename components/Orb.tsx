import { ReactNode, useEffect, useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";

import { useThemeColors } from "@/theme";
import { AMBIENT, EASE, SPRING } from "@/theme/motion";

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
 *
 * **La deriva de luz** viene del montaje (`diseno/ANIMACIÓN ISOTIPO`): la luz
 * interior gira como en una perla, la silueta no se mueve. Como cada capa es
 * un círculo recortado por un clip centrado, girar su contenedor mueve la luz
 * sin tocar el borde — un transform de View, idéntico en iOS/Android/web. Las
 * props de los gradientes SVG no se animan nunca: en Android no invalidan el
 * brush y en web no pasan por Reanimated.
 */

/**
 * Los colores del orbe, por capa. Exportados para el único otro sitio que
 * puede pintar con la marca: los tonos de `Avatar`. Nadie más los copia.
 */
export const ORB_COLORS = {
  orbBase: "#EDE6F6",
  orbBlue: "#CFECF9",
  orbLilac: "#D3CEF0",
  orbLavender: "#D4D0EF",
  orbPeach: "#F8E2D1",
} as const;

/** Las cinco capas del orbe, de abajo a arriba, sobre un lienzo de 100×100. */
const LAYERS = [
  {
    id: "orbBase",
    cx: 50,
    cy: 50,
    r: 70.7,
    color: ORB_COLORS.orbBase,
    edge: "#BFC3EF",
  },
  { id: "orbBlue", cx: 50, cy: 82, r: 57.6, color: ORB_COLORS.orbBlue },
  { id: "orbLilac", cx: 78, cy: 45, r: 52.5, color: ORB_COLORS.orbLilac },
  {
    id: "orbLavender",
    cx: 22,
    cy: 45,
    r: 52.5,
    color: ORB_COLORS.orbLavender,
  },
  { id: "orbPeach", cx: 50, cy: 22, r: 38.9, color: ORB_COLORS.orbPeach },
] as const;

type Layer = (typeof LAYERS)[number];

const BREATHE_SCALE = 1.055;
const BREATHE_SCALE_BUSY = 1.07;
/** Cuánto gira cada eje de luz en un extremo de la deriva. */
const DRIFT_A_DEG = 10;
const DRIFT_B_DEG = -7;
/** El amanecer del arranque: la luz cálida nace abajo y sube hasta su sitio. */
const DAWN_FROM_DEG = 150;
/** El destello del amén: un cuarto de giro corto que asienta con muelle. */
const BURST_FROM_DEG = 24;

export type OrbVariant = "idle" | "dawn" | "burst" | "working";

type Props = {
  size: number;
  /** El halo crema de alrededor. Sobra en tamaños pequeños. */
  halo?: boolean;
  /** Se para la respiración; también se para sola si el sistema pide menos movimiento. */
  animated?: boolean;
  /**
   * La deriva de luz. Por defecto solo en orbes grandes: a 26 px no se ve y
   * en filas de lista no paga. Con ella apagada el orbe es un solo SVG, el
   * render de siempre.
   */
  drift?: boolean;
  /**
   * Qué está haciendo el orbe: `dawn` amanece una vez al montar (el
   * arranque), `burst` da un cuarto de giro y destella (el amén del día),
   * `working` respira más corto y hondo (generando el plan).
   */
  variant?: OrbVariant;
  /** El wordmark, cuando el orbe lo lleva dentro. */
  children?: ReactNode;
};

/** `useId` devuelve `:r1:` y los dos puntos rompen `url(#…)`. */
const useSvgId = () => useId().replace(/[^a-zA-Z0-9_-]/g, "");

const GradientDef = ({ layer, uid }: { layer: Layer; uid: string }) => (
  <RadialGradient
    id={`${uid}-${layer.id}`}
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
);

/** Un SVG con algunas capas del orbe, recortadas por la esfera. */
const LayerDisc = ({
  size,
  layers,
  uid,
  rim = false,
}: {
  size: number;
  layers: readonly Layer[];
  uid: string;
  rim?: boolean;
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    style={StyleSheet.absoluteFill}
  >
    <Defs>
      {layers.map((layer) => (
        <GradientDef key={layer.id} layer={layer} uid={uid} />
      ))}
      {rim ? (
        <RadialGradient id={`${uid}-orbRim`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.38" />
        </RadialGradient>
      ) : null}
      {/* Las capas se salen de la esfera: sin esto, el orbe sería un cuadrado. */}
      <ClipPath id={`${uid}-orbClip`}>
        <Circle cx="50" cy="50" r="50" />
      </ClipPath>
    </Defs>
    {layers.map((layer) => (
      <Circle
        key={layer.id}
        cx="50"
        cy="50"
        r="50"
        fill={`url(#${uid}-${layer.id})`}
        clipPath={`url(#${uid}-orbClip)`}
      />
    ))}
    {/*
      El brillo del borde hacia dentro. En el prototipo es un
      `box-shadow: inset`, que en SVG no existe: aquí es una capa más,
      transparente en el centro y blanca en el filo. Es lo que hace que
      la esfera parezca vidrio y no un círculo de color.
    */}
    {rim ? (
      <Circle cx="50" cy="50" r="50" fill={`url(#${uid}-orbRim)`} />
    ) : null}
  </Svg>
);

export const Orb = ({
  size,
  halo = false,
  animated = true,
  drift,
  variant = "idle",
  children,
}: Props) => {
  const palette = useThemeColors();
  const uid = useSvgId();
  const phase = useSharedValue(0);
  /** −1…1: la deriva perpetua de la luz. */
  const driftPhase = useSharedValue(0);
  /** Grados extra del gesto de la variante (amanecer, destello). */
  const gesture = useSharedValue(0);
  /** Empuje puntual del halo en el destello. */
  const haloBoost = useSharedValue(0);
  // Quien ha pedido menos movimiento en el sistema no quiere una esfera
  // latiendo en cada pantalla. Se queda quieta y no pasa nada: el isotipo se
  // reconoce por el color, no por el pulso.
  const reduceMotion = useReducedMotion();
  const moving = animated && !reduceMotion;
  const drifting = (drift ?? size >= 48) && moving;

  const breatheMs =
    variant === "working" ? AMBIENT.breatheBusy : AMBIENT.breathe;
  const breatheScale =
    variant === "working" ? BREATHE_SCALE_BUSY : BREATHE_SCALE;

  useEffect(() => {
    if (!moving) {
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(1, {
        duration: breatheMs / 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [moving, phase, breatheMs]);

  useEffect(() => {
    if (!drifting) {
      driftPhase.value = 0;
      return;
    }
    driftPhase.value = withRepeat(
      withTiming(1, {
        duration: AMBIENT.drift,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [drifting, driftPhase]);

  useEffect(() => {
    // Los gestos son one-shot al montar la variante; con menos movimiento
    // pedido saltan directos al frame final (el estático de siempre).
    if (!moving) {
      gesture.value = 0;
      haloBoost.value = 0;
      return;
    }
    if (variant === "dawn") {
      gesture.value = DAWN_FROM_DEG;
      gesture.value = withTiming(0, { duration: AMBIENT.dawn, easing: EASE });
    } else if (variant === "burst") {
      gesture.value = BURST_FROM_DEG;
      gesture.value = withSpring(0, SPRING.bouncy);
      haloBoost.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 260 }),
      );
    }
  }, [variant, moving, gesture, haloBoost]);

  const sphereStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + phase.value * (breatheScale - 1) }],
  }));

  // El eje cálido/frío (melocotón arriba, celeste abajo) gira a favor; los
  // laterales, en contrafase y algo menos. Nadie ve girar nada: el orbe
  // sencillamente nunca está dos veces igual.
  const lightsAStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${gesture.value + driftPhase.value * DRIFT_A_DEG}deg` },
    ],
  }));
  const lightsBStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${gesture.value * -0.7 + driftPhase.value * DRIFT_B_DEG}deg` },
    ],
  }));

  // El halo respira en fase con la esfera, pero en opacidad: si escalara
  // también, el conjunto se vería como un solo bulto creciendo. El destello
  // del amén le da un empujón corto por encima.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.7 + phase.value * 0.3 + haloBoost.value * 0.3),
  }));

  const haloSize = size * 1.36;
  const discSize = { width: size, height: size } as const;

  return (
    <View
      style={discSize}
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
              <RadialGradient id={`${uid}-orbHalo`} cx="50%" cy="50%" r="50%">
                <Stop
                  offset="0.3"
                  stopColor={palette.dawn.cream}
                  stopOpacity="0.45"
                />
                <Stop
                  offset="0.7"
                  stopColor={palette.dawn.cream}
                  stopOpacity="0"
                />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill={`url(#${uid}-orbHalo)`} />
          </Svg>
        </Animated.View>
      ) : null}

      <Animated.View style={[discSize, sphereStyle]}>
        {drifting ? (
          // La perla por capas: base quieta, la luz girando por dentro, el
          // vidrio del borde quieto encima. El orden de pintado es el mismo
          // que el del SVG único: blue · lilac · lavender · peach.
          <>
            <LayerDisc size={size} layers={[LAYERS[0]]} uid={uid} />
            <Animated.View
              style={[StyleSheet.absoluteFill, lightsAStyle]}
              pointerEvents="none"
            >
              <LayerDisc size={size} layers={[LAYERS[1]]} uid={`${uid}a`} />
            </Animated.View>
            <Animated.View
              style={[StyleSheet.absoluteFill, lightsBStyle]}
              pointerEvents="none"
            >
              <LayerDisc
                size={size}
                layers={[LAYERS[2], LAYERS[3]]}
                uid={`${uid}b`}
              />
            </Animated.View>
            <Animated.View
              style={[StyleSheet.absoluteFill, lightsAStyle]}
              pointerEvents="none"
            >
              <LayerDisc size={size} layers={[LAYERS[4]]} uid={`${uid}c`} />
            </Animated.View>
            <LayerDisc size={size} layers={[]} uid={`${uid}r`} rim />
          </>
        ) : (
          // Sin deriva (tamaños chicos, listas, menos movimiento): un solo
          // SVG, el render de siempre, al precio de siempre.
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Defs>
              {LAYERS.map((layer) => (
                <GradientDef key={layer.id} layer={layer} uid={uid} />
              ))}
              <RadialGradient id={`${uid}-orbRim`} cx="50%" cy="50%" r="50%">
                <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.38" />
              </RadialGradient>
              <ClipPath id={`${uid}-orbClip`}>
                <Circle cx="50" cy="50" r="50" />
              </ClipPath>
            </Defs>
            {LAYERS.map((layer) => (
              <Circle
                key={layer.id}
                cx="50"
                cy="50"
                r="50"
                fill={`url(#${uid}-${layer.id})`}
                clipPath={`url(#${uid}-orbClip)`}
              />
            ))}
            <Circle cx="50" cy="50" r="50" fill={`url(#${uid}-orbRim)`} />
          </Svg>
        )}
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
