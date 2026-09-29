import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { Glass } from "@/components/Glass";
import { useSheetClosed } from "@/components/ui/sheetClose";
import { SheetGrabHandle, useSheetDrag } from "@/components/ui/sheetDrag";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { icon, scrim, useThemeColors } from "@/theme";
import { enterSheet } from "@/theme/motion";

/**
 * La hoja que sube desde abajo: Modal + scrim mudo + tarjeta de vidrio, con
 * asa para arrastrar y un único «Cerrar» anunciado (AGENTS.md: el scrim no es
 * un segundo botón).
 *
 * Antes cada hoja montaba esto a mano (`PlanOptionsSheet`, `ActionMenu`), y
 * la próxima iba a ser la tercera copia. Aquí queda una vez, con lo que ya se
 * aprendió en ellas:
 *
 * - `flat`, sin desenfoque: en Android el Modal se pinta en otra ventana y el
 *   blur no tendría qué tomar; el scrim ya atenúa lo de detrás.
 * - Teclado y scroll: con el teclado abierto en una pantalla pequeña se
 *   recorta el contenido, nunca el «Cerrar» ni el scrim.
 * - `onClosed`: para navegar después de que el Modal se haya ido, no en el
 *   mismo tap (AGENTS.md). `onDismiss` solo existe en iOS; en Android y en
 *   web lo simula `useSheetClosed` con la duración de salida.
 * - `showClose={false}`: para la hoja cuyo contenido ya trae su única salida
 *   anunciada (el «Cancelar» de `ConfirmDialog`). La X encima de un
 *   «Cancelar» era un segundo control de cerrar.
 */
export const Sheet = ({
  visible,
  onClose,
  onClosed,
  title,
  showClose = true,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** Tras cerrar del todo (el Modal ya no está): para navegar sin el overlay. */
  onClosed?: () => void;
  title: string;
  /** Sin la X: solo si el contenido ya trae su único control de cerrar. */
  showClose?: boolean;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { panGesture, dragStyle } = useSheetDrag(onClose, visible);
  const handleClosed = useSheetClosed(visible, onClosed);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // El botón físico de atrás de Android cierra la hoja, no la pantalla.
      onRequestClose={onClose}
      onDismiss={handleClosed}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* El scrim cierra al tocar fuera, pero no es un control. */}
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
            className="mx-4 max-h-full rounded-card p-5 shadow-card"
            style={{ marginBottom: Math.max(insets.bottom + 8, 16) }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-4"
              bounces={false}
            >
              <GestureDetector gesture={panGesture}>
                <View>
                  <SheetGrabHandle />
                  <View className="flex-row items-center justify-between">
                    <Txt variant="editorial" className="flex-1 pr-3">
                      {title}
                    </Txt>
                    {showClose ? (
                      <Tap
                        accessibilityRole="button"
                        accessibilityLabel={t("common.close")}
                        onPress={onClose}
                        // 44×44 de zona táctil; el -mr-2 alinea el icono con
                        // el filo óptico de la tarjeta, no con el del área
                        // clicable.
                        className="-mr-2 h-11 w-11 items-center justify-center"
                      >
                        <X
                          size={icon.sm}
                          color={colors.plum.DEFAULT}
                          strokeWidth={icon.strokeWidth}
                        />
                      </Tap>
                    ) : null}
                  </View>
                </View>
              </GestureDetector>

              {children}
            </ScrollView>
          </Glass>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { backgroundColor: scrim },
});
