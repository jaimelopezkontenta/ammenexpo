import { useEffect } from "react";
import { Text } from "react-native";
import {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Tap } from "@/components/ui/Tap";
import { useThemeColors, withAlpha } from "@/theme";
import { DURATION } from "@/theme/motion";

export type PillRole = "radio" | "checkbox" | "tab";

const BORDER_ON = "rgba(255,255,255,0.30)";

/**
 * La píldora del sistema: `py-2.5`, borde activo `white/30`, texto inactivo
 * plum, `text-sm`. Cinco copias se habían desalineado; esta es la única.
 */
export const Pill = ({
  label,
  selected,
  disabled = false,
  role = "radio",
  onPress,
  numberOfLines,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  role?: PillRole;
  onPress: () => void;
  numberOfLines?: number;
  accessibilityLabel?: string;
}) => {
  const progress = useSharedValue(selected ? 1 : 0);
  const reduceMotion = useReducedMotion();
  const colors = useThemeColors();

  const bgOff = withAlpha(colors.glass, 0.6);
  const borderOff = withAlpha(colors.glassedge, 0.6);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : DURATION.state,
    });
  }, [selected, progress, reduceMotion]);

  const chipColor = colors.plum.chip;
  const colorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [bgOff, chipColor],
    ),
    borderColor: interpolateColor(progress.value, [0, 1], [borderOff, BORDER_ON]),
  }));

  const a11yRole = role === "tab" ? "tab" : role;

  return (
    <Tap
      accessibilityRole={a11yRole}
      accessibilityState={
        role === "tab"
          ? { selected, disabled }
          : { checked: selected, disabled }
      }
      aria-checked={role === "tab" ? undefined : selected}
      aria-selected={role === "tab" ? selected : undefined}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      className={`min-h-11 items-center justify-center rounded-full border px-4 py-2.5 ${
        disabled ? "opacity-40" : ""
      }`}
      style={colorStyle}
    >
      <Text
        numberOfLines={numberOfLines}
        className={
          selected
            ? "font-sans-semibold text-sm text-white"
            : "font-sans text-sm text-plum"
        }
      >
        {label}
      </Text>
    </Tap>
  );
};
