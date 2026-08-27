import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { SlideInDown } from "react-native-reanimated";

import { Glass } from "@/components/Glass";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { icon, useThemeColors } from "@/theme";

export type ActionMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/**
 * Menú contextual de cabecera: bloquear, reportar, compartir.
 *
 * El patrón es el del cajón del plan — Modal + scrim mudo + tarjeta de vidrio —
 * para que las acciones de un perfil no vivan al final de un scroll.
 */
export const ActionMenu = ({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  actions: ActionMenuItem[];
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...(Platform.OS === "web"
            ? { "aria-hidden": true, tabIndex: -1 }
            : null)}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.scrim]}
        />

        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          className="max-h-full"
        >
          <Glass
            flat
            readable
            className="mx-4 rounded-card p-5 shadow-card"
            style={{ marginBottom: Math.max(insets.bottom + 8, 16) }}
          >
            <View className="flex-row items-center justify-between">
              <Txt variant="editorial" className="flex-1 pr-3">
                {title}
              </Txt>
              <Tap
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                onPress={onClose}
                className="-mr-2 h-11 w-11 items-center justify-center"
              >
                <X
                  size={icon.sm}
                  color={colors.plum.DEFAULT}
                  strokeWidth={icon.strokeWidth}
                />
              </Tap>
            </View>

            <View className="gap-1 pt-2">
              {actions.map((item) => (
                <Tap
                  key={item.key}
                  accessibilityRole="button"
                  disabled={item.disabled}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                  className="min-h-11 justify-center py-2"
                >
                  <Txt
                    variant="subheading"
                    tone={item.danger ? "danger" : "primary"}
                  >
                    {item.label}
                  </Txt>
                </Tap>
              ))}
            </View>
          </Glass>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { backgroundColor: "rgba(65, 54, 83, 0.28)" },
});
