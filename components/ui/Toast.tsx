import { View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "@/components/Glass";
import { Tap, triggerHaptic } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import type { ToastItem, ToastVariant } from "@/core/toast/ToastProvider";
import { DURATION } from "@/theme/motion";

/**
 * La cara visible de los avisos: tarjetas de vidrio flotando bajo la isla del
 * reloj, fuera del flujo — el layout de la pantalla no se entera.
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
    entering={FadeInDown.duration(DURATION.enter).withInitialValues({
      transform: [{ translateY: -16 }],
    })}
    exiting={FadeOutUp.duration(DURATION.exit)}
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

export const ToastHost = ({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) => {
  const insets = useSafeAreaInsets();

  if (items.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 items-center gap-2 px-6"
      style={{ paddingTop: insets.top + 8 }}
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </View>
  );
};

export const toastHaptic = (variant: ToastVariant) =>
  triggerHaptic(HAPTIC[variant]);
