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
            // Both props are needed, and neither alone is enough.
            // `accessibilityState` is what iOS and Android read. On web,
            // react-native-web 0.21 no longer maps it, so the DOM came out with
            // role="checkbox" and no aria-checked at all — which announces worse
            // than a plain button, because the reader says "checkbox" and then
            // cannot say whether it is checked. `aria-checked` fixes web.
            accessibilityRole={multiple ? "checkbox" : "radio"}
            accessibilityState={{ checked: isSelected }}
            aria-checked={isSelected}
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
