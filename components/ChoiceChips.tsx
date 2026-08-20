import { useEffect } from "react";
import { Text, View } from "react-native";
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

export type ChoiceOption = {
  value: string;
  label: string;
};

interface ChoiceChipsProps {
  options: ChoiceOption[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Single choice renders as radios, multiple as checkboxes. */
  multiple?: boolean;
  /**
   * How many can be chosen at once. Past the limit the unchosen chips go
   * disabled rather than silently ignoring the tap — a control that stops
   * responding without saying so reads as broken, not as full.
   */
  max?: number;
}

// El borde de la pill elegida es blanco tenue en los dos temas: va sobre el
// plum-chip, que es oscuro en ambos.
const BORDER_ON = "rgba(255,255,255,0.30)";

const Chip = ({
  label,
  isSelected,
  isDisabled,
  multiple,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
  multiple: boolean;
  onPress: () => void;
}) => {
  const progress = useSharedValue(isSelected ? 1 : 0);
  const reduceMotion = useReducedMotion();
  const colors = useThemeColors();

  // Los dos estados del chip, como colores planos para poder interpolarlos:
  // vidrio del tema (claro u oscuro) ↔ pill de plum-chip.
  const bgOff = withAlpha(colors.glass, 0.6);
  const borderOff = withAlpha(colors.glassedge, 0.6);

  useEffect(() => {
    // El fundido entre estados. Con menos movimiento pedido, el cambio es
    // instantáneo, que es lo que había.
    progress.value = withTiming(isSelected ? 1 : 0, {
      duration: reduceMotion ? 0 : DURATION.state,
    });
  }, [isSelected, progress, reduceMotion]);

  const chipColor = colors.plum.chip;
  const colorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [bgOff, chipColor],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [borderOff, BORDER_ON],
    ),
  }));

  return (
    <Tap
      // Both props are needed, and neither alone is enough.
      // `accessibilityState` is what iOS and Android read. On web,
      // react-native-web 0.21 no longer maps it, so the DOM came out with
      // role="checkbox" and no aria-checked at all — which announces worse
      // than a plain button, because the reader says "checkbox" and then
      // cannot say whether it is checked. `aria-checked` fixes web.
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      aria-checked={isSelected}
      disabled={isDisabled}
      accessibilityLabel={label}
      onPress={onPress}
      // Elegida: pill de vidrio oscuro. Sin elegir: vidrio claro sobre el
      // degradado, que es el patrón del wheel-selector del diseño. El color
      // vive en `colorStyle`; la clase solo lleva forma y el apagado.
      className={`rounded-full border px-4 py-2.5 ${
        isDisabled ? "opacity-40" : ""
      }`}
      style={colorStyle}
    >
      <Text
        className={
          isSelected ? "font-sans-semibold text-white" : "font-sans text-plum"
        }
      >
        {label}
      </Text>
    </Tap>
  );
};

export const ChoiceChips = ({
  options,
  selected,
  onToggle,
  multiple = false,
  max,
}: ChoiceChipsProps) => {
  const atLimit = max !== undefined && selected.length >= max;

  return (
    <View
      className="flex-row flex-wrap gap-2"
      accessibilityRole={multiple ? undefined : "radiogroup"}
    >
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        // Deselecting has to keep working at the limit, or somebody who picked
        // three would be stuck with those three.
        const isDisabled = atLimit && !isSelected;

        return (
          <Chip
            key={option.value}
            label={option.label}
            isSelected={isSelected}
            isDisabled={isDisabled}
            multiple={multiple}
            onPress={() => onToggle(option.value)}
          />
        );
      })}
    </View>
  );
};
