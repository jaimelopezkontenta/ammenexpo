import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Pill } from "@/components/ui/Pill";
import { Txt } from "@/components/ui/Text";
import { enterStagger } from "@/theme/motion";

export type ChoiceOption = {
  value: string;
  label: string;
};

/** Una familia de opciones con su rótulo, para las listas largas. */
export type ChoiceGroup = {
  key: string;
  label: string;
  /** Valores de `options` que pertenecen a esta familia, en su orden. */
  values: string[];
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
  /**
   * Con familias, cada grupo lleva su rótulo `overline` y sus chips debajo:
   * dieciséis píldoras de golpe se leen como inventario; en vecindarios se
   * recorren. Sin `groups`, idéntico a siempre.
   */
  groups?: ChoiceGroup[];
  /**
   * Entrada en cascada (el stagger del sistema, tope 6). Solo para pantallas
   * de primera impresión como el onboarding; con menos movimiento pedido,
   * Reanimated lo apaga solo.
   */
  stagger?: boolean;
}

export const ChoiceChips = ({
  options,
  selected,
  onToggle,
  multiple = false,
  max,
  groups,
  stagger = false,
}: ChoiceChipsProps) => {
  const atLimit = max !== undefined && selected.length >= max;

  const renderChip = (option: ChoiceOption, enterIndex: number) => {
    const isSelected = selected.includes(option.value);
    const isDisabled = atLimit && !isSelected;

    const pill = (
      <Pill
        label={option.label}
        selected={isSelected}
        disabled={isDisabled}
        role={multiple ? "checkbox" : "radio"}
        onPress={() => onToggle(option.value)}
      />
    );

    if (!stagger) {
      return <View key={option.value}>{pill}</View>;
    }

    return (
      <Animated.View key={option.value} entering={enterStagger(enterIndex)}>
        {pill}
      </Animated.View>
    );
  };

  if (!groups) {
    return (
      <View
        className="flex-row flex-wrap gap-2"
        accessibilityRole={multiple ? undefined : "radiogroup"}
      >
        {options.map(renderChip)}
      </View>
    );
  }

  const byValue = new Map(options.map((option) => [option.value, option]));
  // El escalonado cuenta a través de las familias (el tope del stagger ya lo
  // pone el sistema): índice global por valor, no por posición en su grupo.
  const flatOrder = groups.flatMap((group) => group.values);
  const enterIndexOf = new Map(flatOrder.map((value, index) => [value, index]));

  return (
    <View
      className="gap-4"
      accessibilityRole={multiple ? undefined : "radiogroup"}
    >
      {groups.map((group) => (
        <View key={group.key} className="gap-2">
          <Txt variant="overline">{group.label}</Txt>
          <View className="flex-row flex-wrap gap-2">
            {group.values
              .map((value) => byValue.get(value))
              .filter((option): option is ChoiceOption => Boolean(option))
              .map((option) =>
                renderChip(option, enterIndexOf.get(option.value) ?? 0),
              )}
          </View>
        </View>
      ))}
    </View>
  );
};
