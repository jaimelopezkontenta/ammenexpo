import { View } from "react-native";

import { Pill } from "@/components/ui/Pill";

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
        const isDisabled = atLimit && !isSelected;

        return (
          <Pill
            key={option.value}
            label={option.label}
            selected={isSelected}
            disabled={isDisabled}
            role={multiple ? "checkbox" : "radio"}
            onPress={() => onToggle(option.value)}
          />
        );
      })}
    </View>
  );
};
