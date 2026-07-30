import { Pressable, Text, View } from "react-native";

export type ChoiceOption = {
  value: string;
  label: string;
};

interface ChoiceChipsProps {
  options: ChoiceOption[];
  selected: string[];
  onToggle: (value: string) => void;
}

export const ChoiceChips = ({
  options,
  selected,
  onToggle,
}: ChoiceChipsProps) => {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option.value);

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
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
