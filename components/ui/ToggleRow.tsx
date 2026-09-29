import { View } from "react-native";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

type Props = {
  title: string;
  caption: string;
  value: boolean;
  onToggle: (next: boolean) => void;
};

/**
 * Interruptor de preferencias: Tap, no Pressable crudo ni Switch nativo.
 * El estado se lee en el label de accesibilidad; el riel es solo visual.
 */
export const ToggleRow = ({ title, caption, value, onToggle }: Props) => (
  <Tap
    accessibilityRole="switch"
    accessibilityState={{ checked: value }}
    accessibilityLabel={`${title}. ${caption}`}
    onPress={() => onToggle(!value)}
    className="min-h-12 flex-row items-center justify-between gap-4 py-2"
  >
    <View className="min-w-0 flex-1 gap-0.5">
      <Txt variant="body">{title}</Txt>
      <Txt variant="caption">{caption}</Txt>
    </View>
    <View
      className={`h-7 w-12 justify-center rounded-full px-0.5 ${
        value ? "bg-plum-chip" : "bg-mist/40"
      }`}
    >
      <View
        className={`h-6 w-6 rounded-full bg-surface ${
          value ? "self-end" : "self-start"
        }`}
      />
    </View>
  </Tap>
);
