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
}

export const ChoiceChips = ({
  options,
  selected,
  onToggle,
  multiple = false,
}: ChoiceChipsProps) => {
  return (
    <View
      className="flex-row flex-wrap gap-2"
      accessibilityRole={multiple ? undefined : "radiogroup"}
    >
      {options.map((option) => {
        const isSelected = selected.includes(option.value);

        return (
          <Pressable
            key={option.value}
            // A plain button never announces which chips are on: react-native-web
            // only maps `checked` for roles that have a checked state, so a
            // screen reader user was told nothing about the selection.
            accessibilityRole={multiple ? "checkbox" : "radio"}
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={option.label}
            onPress={() => onToggle(option.value)}
            className={`rounded-full border px-4 py-2.5 ${
              isSelected
                ? "border-slate-900 bg-slate-900"
                : "border-slate-200 bg-white"
            }`}
          >
            <Text
              className={
                isSelected ? "font-semibold text-white" : "text-slate-700"
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
