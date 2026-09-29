import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Keyboard, Platform, View } from "react-native";
import Animated, { FadeInUp, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "@/components/Glass";
import { Tap, triggerHaptic } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import {
  raiseToasts,
  subscribeToastLift,
  toastBottomOffset,
  toastLift,
} from "@/components/ui/toastPlacement";
import type { ToastItem, ToastVariant } from "@/core/toast/ToastProvider";
import { DURATION } from "@/theme/motion";

/**
 * La cara visible de los avisos: tarjetas de vidrio flotando abajo, encima de
 * la barra de pestañas, fuera del flujo — el layout de la pantalla no se
 * entera. Vivían arriba y durante 4,5 s tapaban el botón de volver y el título
 * de la pantalla, justo después de una acción que suele llevar a volver.
 *
 * Suben con el teclado de iOS y con lo que una pantalla ponga flotando abajo
 * (`useToastLift`; la cuenta está en `toastPlacement.ts`).
 *
 * `accessibilityRole="alert"` + liveRegion assertive: el lector de pantalla
 * anuncia el aviso al aparecer, igual que anunciaban los textos `role="alert"`
 * que este sistema sustituye.
 */

// El acento del borde izquierdo, por variante. El texto siempre es plum
// legible; el color no es el mensaje, solo lo subraya.
const ACCENT: Record<ToastVariant, string> = {
  success: "bg-ember-accent",
  error: "bg-danger",
  info: "bg-plum-chip",
};

const HAPTIC: Record<ToastVariant, "success" | "warning" | "selection"> = {
  success: "success",
  error: "warning",
  info: "selection",
};

const ToastCard = ({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) => (
  <Animated.View
    entering={FadeInUp.duration(DURATION.enter).withInitialValues({
      transform: [{ translateY: 16 }],
    })}
    exiting={FadeOutDown.duration(DURATION.exit)}
  >
    <Tap
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      haptic="none"
      onPress={() => onDismiss(item.id)}
    >
      <Glass flat readable className="overflow-hidden rounded-card shadow-card">
        <View className="flex-row items-center gap-3 py-3 pl-3 pr-4">
          <View className={`h-8 w-1 rounded-full ${ACCENT[item.variant]}`} />
          <Txt variant="label" className="flex-1">
            {item.message}
          </Txt>
        </View>
      </Glass>
    </Tap>
  </Animated.View>
);

/**
 * La altura del teclado, solo en iOS: es el único que no empuja la ventana
 * (el mismo criterio que `KeyboardScreen`). Los `Will` para moverse a la
 * vez que él y no después.
 */
const useIosKeyboardHeight = () => {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardWillHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
};

/**
 * Para una pantalla con algo flotando abajo: los avisos suben `px` mientras
 * está enfocada (las pestañas siguen montadas al cambiar de una a otra, y el
 * hueco no debe seguirlas). Con 0 no sube nada.
 */
export const useToastLift = (px: number) => {
  useFocusEffect(
    useCallback(() => (px > 0 ? raiseToasts(px) : undefined), [px]),
  );
};

export const ToastHost = ({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useIosKeyboardHeight();
  const lift = useSyncExternalStore(subscribeToastLift, toastLift, toastLift);

  if (items.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 items-center gap-2 px-6"
      // Por encima de la barra de pestañas (62) y de la zona segura; en las
      // pantallas sin barra queda un poco más alto, que no estorba.
      style={{
        paddingBottom: toastBottomOffset({
          safeBottom: insets.bottom,
          keyboardHeight,
          lift,
        }),
      }}
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </View>
  );
};

export const toastHaptic = (variant: ToastVariant) =>
  triggerHaptic(HAPTIC[variant]);
