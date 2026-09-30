import { X } from "@/components/ui/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { Glass } from "@/components/Glass";
import { createActionMenuRunner } from "@/components/ui/actionMenuRunner";
import { useSheetClosed } from "@/components/ui/sheetClose";
import { SheetGrabHandle, useSheetDrag } from "@/components/ui/sheetDrag";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { icon, scrim, useThemeColors } from "@/theme";
import { enterSheet } from "@/theme/motion";

export type ActionMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  /**
   * Hacerla cuando el menú ya se haya ido, no en el mismo toque: para lo que
   * abre otro Modal (una confirmación) o navega (AGENTS.md).
   */
  afterClose?: boolean;
};

/**
 * Menú contextual de cabecera: bloquear, reportar, compartir.
 *
 * El patrón es el del cajón del plan — Modal + scrim mudo + tarjeta de vidrio —
 * para que las acciones de un perfil no vivan al final de un scroll.
 *
 * `onClosed` y `afterClose` son el mismo contrato que `Sheet`: una llamada
 * por cierre, cuando el Modal ya no está, también en Android y en web
 * (`useSheetClosed`). Primero la acción aplazada, luego el `onClosed` del
 * padre.
 */
export const ActionMenu = ({
  visible,
  onClose,
  onClosed,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  /** Tras cerrar del todo (el Modal ya no está). */
  onClosed?: () => void;
  title: string;
  actions: ActionMenuItem[];
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { panGesture, dragStyle } = useSheetDrag(onClose, visible);
  const [runner] = useState(createActionMenuRunner);
  const handleClosed = useSheetClosed(visible, () => {
    runner.closed();
    onClosed?.();
  });

  useEffect(() => {
    if (visible) runner.opened();
  }, [runner, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={handleClosed}
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
          entering={enterSheet}
          style={dragStyle}
          className="max-h-full"
        >
          <Glass
            flat
            readable
            className="mx-4 rounded-card p-5 shadow-card"
            style={{ marginBottom: Math.max(insets.bottom + 8, 16) }}
          >
            <GestureDetector gesture={panGesture}>
              <View>
                <SheetGrabHandle />
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
              </View>
            </GestureDetector>

            <View className="gap-1 pt-2">
              {actions.map((item) => (
                <Tap
                  key={item.key}
                  accessibilityRole="button"
                  disabled={item.disabled}
                  onPress={() => runner.press(item, onClose)}
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
  scrim: { backgroundColor: scrim },
});
