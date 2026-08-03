import { Pressable, Text, View } from "react-native";

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
          <Pressable
            key={option.value}
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
            accessibilityLabel={option.label}
            onPress={() => onToggle(option.value)}
            // Elegida: pill de vidrio oscuro. Sin elegir: vidrio claro sobre el
            // degradado, que es el patrón del wheel-selector del diseño.
            className={`rounded-full border px-4 py-2.5 ${
              isSelected
                ? "border-white/30 bg-plum-chip"
                : "border-white/60 bg-white/60"
            } ${isDisabled ? "opacity-40" : ""}`}
          >
            <Text
              className={
                isSelected
                  ? "font-sans-semibold text-white"
                  : "font-sans text-plum"
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
