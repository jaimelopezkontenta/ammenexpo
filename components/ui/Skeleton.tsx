import { ReactNode, useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * El esqueleto de carga del sistema: la silueta de lo que viene, latiendo.
 *
 * **Opacidad pulsante y no shimmer.** El brillo que barre en diagonal es caro
 * de animar en web/RN-web y es el gesto de otra familia de apps; el pulso es
 * barato, y es el mismo respirar del orbe. Con menos movimiento pedido en el
 * sistema, la silueta se queda quieta a media opacidad: sigue contando qué
 * viene, sin latir.
 *
 * Los bloques son plum al 10 % — la sombra del contenido sobre el amanecer,
 * no un gris de otra paleta.
 */

const PULSE_MS = 1100;
const PULSE_MIN = 0.45;
const PULSE_MAX = 0.9;
const STATIC_OPACITY = 0.6;

const usePulse = () => {
  const phase = useSharedValue(PULSE_MIN);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      phase.value = STATIC_OPACITY;
      return;
    }
    phase.value = PULSE_MIN;
    phase.value = withRepeat(
      withTiming(PULSE_MAX, {
        duration: PULSE_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [phase, reduceMotion]);

  return useAnimatedStyle(() => ({ opacity: phase.value }));
};

type BlockProps = {
  className?: string;
};

/** Un bloque de esqueleto suelto: dale forma con `className` (alto, ancho, radio). */
export const Skeleton = ({ className }: BlockProps) => {
  const pulse = usePulse();
  return (
    <Animated.View
      style={pulse}
      className={`rounded-chip bg-plum/10 ${className ?? ""}`}
    />
  );
};

/** El grupo marca una región viva para el lector de pantalla; los bloques, no. */
const Group = ({ children }: { children: ReactNode }) => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    {children}
  </View>
);

/** Varias líneas de texto por venir. La última, más corta, como un párrafo real. */
const Lines = ({ count = 3 }: { count?: number }) => (
  <Group>
    <View className="gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === count - 1 ? "w-3/5" : "w-full"}`}
        />
      ))}
    </View>
  </Group>
);

/** La silueta de una tarjeta del sistema: label editorial + cuerpo. */
const CardShape = ({ lines = 3 }: { lines?: number }) => (
  <Group>
    <View className="gap-3 rounded-card border border-glassedge/60 bg-glass/40 p-5">
      <Skeleton className="h-4 w-28" />
      <View className="gap-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton
            key={i}
            className={`h-4 ${i === lines - 1 ? "w-3/5" : "w-full"}`}
          />
        ))}
      </View>
    </View>
  </Group>
);

/** Un avatar con nombre al lado, como en las filas de personas. */
const AvatarRow = () => (
  <Group>
    <View className="flex-row items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </View>
    </View>
  </Group>
);

Skeleton.Lines = Lines;
Skeleton.Card = CardShape;
Skeleton.AvatarRow = AvatarRow;
