import { X } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Glass } from "@/components/Glass";
import { SheetGrabHandle, useSheetDrag } from "@/components/ui/sheetDrag";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { TextField } from "@/components/TextField";
import type { OwnPlan } from "@/core/plans/queries";

import { icon, scrim, useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";
import { DURATION, enterSheet } from "@/theme/motion";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** El título actual del plan, para la fila de renombrar. */
  planTitle: string;
  /** Cambiar de plan sin salir de Hoy. Con uno solo, el switcher no pinta. */
  plans: OwnPlan[];
  activePlanId: string;
  onSelectPlan: (planId: string) => void;
  /** Renombrar: el editor que antes vivía inline en medio del journey. */
  draftTitle: string | null;
  onDraftTitleChange: (title: string | null) => void;
  onSaveTitle: () => void;
  renamePending: boolean;
  /** "Ver los días" solo existe cuando ya hay un ayer al que volver. */
  showSeeDays: boolean;
  onSeeDays: () => void;
  onShare: () => void;
  /** Archivar: dos toques, como en la lista y en el borrado del perfil. */
  canArchive: boolean;
  confirmingArchive: boolean;
  archivePending: boolean;
  onArchive: () => void;
  /** Lo que falla dentro del sheet se enseña dentro del sheet. */
  error: string | null;
  /** Tras cerrar del todo (el Modal ya no está): para navegar sin el overlay. */
  onClosed?: () => void;
};

/**
 * El cajón del plan: todo lo que rodea al día sin ser el día.
 *
 * Hoy enseñaba el journey y la administración del plan en la misma columna
 * —cambiar de plan, renombrar, compartir, archivar— y la pantalla se leía
 * como un panel de control con una oración en medio. Todo eso sigue a un
 * toque, tras el `···` de la fila meta, pero fuera del scroll del día: el
 * journey se queda con una sola acción primaria, y esto es un gesto
 * deliberado y no algo con lo que te topas bajando.
 *
 * Es una tarjeta flotante y no una hoja pegada al borde porque el sistema
 * visual ya habla en tarjetas de vidrio: el sheet es una más, con el mismo
 * radio y la misma sombra.
 */
export const PlanOptionsSheet = ({
  visible,
  onClose,
  planTitle,
  plans,
  activePlanId,
  onSelectPlan,
  draftTitle,
  onDraftTitleChange,
  onSaveTitle,
  renamePending,
  showSeeDays,
  onSeeDays,
  onShare,
  canArchive,
  confirmingArchive,
  archivePending,
  onArchive,
  error,
  onClosed,
}: Props) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const closedOnce = useRef(false);
  const onClosedRef = useRef(onClosed);
  const { panGesture, dragStyle } = useSheetDrag(onClose, visible);

  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    if (visible) {
      closedOnce.current = false;
      return;
    }
    if (Platform.OS !== "web") return;
    const timer = setTimeout(() => {
      if (closedOnce.current) return;
      closedOnce.current = true;
      onClosedRef.current?.();
    }, DURATION.exit);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleClosed = () => {
    if (closedOnce.current) return;
    closedOnce.current = true;
    onClosedRef.current?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // El botón físico de atrás de Android cierra el sheet, no la pantalla.
      onRequestClose={onClose}
      onDismiss={handleClosed}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* El scrim cierra al tocar fuera, como cualquier hoja nativa. */}
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

        {/*
          `flat`, sin desenfoque, a propósito: en Android el `blurTarget` vive
          en la ventana de la pantalla y el `Modal` se pinta en otra, así que
          el desenfoque no tendría qué tomar. El scrim ya atenúa lo de detrás;
          el vidrio translúcido encima se lee igual de vidrio.

          El contenido va en un scroll y el vidrio no pasa nunca de alto que
          la ventana: con el teclado abierto en una pantalla pequeña lo que se
          recorta es el scroll, no el botón de cerrar ni el scrim.
        */}
        {/* El panel sube como una hoja; el fade del Modal ya trae el scrim.
          Reanimated silencia `entering` solo cuando el sistema pide menos
          movimiento, así que aquí no hace falta guard. */}
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
                    <Text className="font-editorial text-lg text-ember-ink">
                      {t("plan.planOptions")}
                    </Text>
                    <Tap
                      accessibilityRole="button"
                      accessibilityLabel={t("common.close")}
                      onPress={onClose}
                      // 44×44 de zona táctil; el -mr-2 alinea el icono con el
                      // filo óptico de la tarjeta, no con el del área clicable.
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

              {/* Con un solo plan esto no pinta nada: la decisión la lleva el
              propio switcher, igual que antes en la pantalla. */}
              <PlanSwitcher
                plans={plans}
                activeId={activePlanId}
                onSelect={onSelectPlan}
              />

              {/* El rename que antes interrumpía el journey. Cerrado es la fila
              del título; abierto, el mismo campo y guardar de siempre. */}
              {draftTitle === null ? (
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel={t("plan.rename")}
                  onPress={() => onDraftTitleChange(planTitle)}
                  className="min-h-11 justify-center"
                >
                  <Text
                    numberOfLines={2}
                    className="font-serif text-lg text-plum"
                  >
                    {planTitle} ✎
                  </Text>
                </Tap>
              ) : (
                <View className="gap-2">
                  <TextField
                    label={t("plan.titlePlaceholder")}
                    value={draftTitle}
                    onChangeText={onDraftTitleChange}
                    maxLength={140}
                    autoFocus
                    onSubmitEditing={onSaveTitle}
                    returnKeyType="done"
                  />
                  <Button
                    title={t("common.save")}
                    loading={renamePending}
                    onPress={onSaveTitle}
                  />
                </View>
              )}

              <View className="gap-3">
                {showSeeDays ? (
                  <Button
                    title={t("plan.seeDays")}
                    variant="secondary"
                    onPress={onSeeDays}
                  />
                ) : null}

                <Button
                  title={t("share.open")}
                  variant="secondary"
                  onPress={onShare}
                />

                {canArchive ? (
                  <>
                    <Button
                      title={
                        confirmingArchive
                          ? t("plan.archiveConfirm")
                          : t("plan.archive")
                      }
                      variant="ghost"
                      loading={archivePending}
                      onPress={onArchive}
                    />
                    <Text
                      className="text-center font-sans text-sm leading-5 text-mist-ink"
                      accessibilityLiveRegion={
                        confirmingArchive ? "polite" : "none"
                      }
                    >
                      {t("plan.archiveHint")}
                    </Text>
                  </>
                ) : null}
              </View>

              {error ? (
                <Text
                  className="text-center font-sans text-sm text-danger"
                  accessibilityRole="alert"
                >
                  {error}
                </Text>
              ) : null}
            </ScrollView>
          </Glass>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // El velo del sistema: un solo valor para todos los overlays, en el tema.
  scrim: { backgroundColor: scrim },
});
