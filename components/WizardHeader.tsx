import { ChevronLeft } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

/**
 * La cabecera del asistente: volver, y cuánto queda.
 *
 * **Sin "Saltar"**, que sí lleva el montaje de diseño. Aquí el onboarding no
 * es saltable: la puerta de la app exige que esté hecho, así que un botón de
 * saltar llevaría de vuelta a la misma pantalla. Un control que no hace nada
 * es peor que no tenerlo.
 *
 * La barra dice el progreso **y lo dice en voz alta**: sin
 * `accessibilityValue` un lector de pantalla anuncia "barra de progreso" y ya,
 * que en un asistente de cuatro pasos es justo el dato que falta.
 */
export const WizardHeader = ({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack?: () => void;
}) => {
  const { t } = useTranslation();
  const percent = Math.round((step / total) * 100);

  return (
    <View className="flex-row items-center gap-4 px-1 pb-6">
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          className="h-11 w-11 items-center justify-center rounded-input border border-white/60 bg-white/60 shadow-soft"
        >
          <ChevronLeft size={20} color="#413653" strokeWidth={2} />
        </Pressable>
      ) : (
        // Hueco del mismo tamaño en el primer paso: sin él, la barra salta de
        // sitio al pasar al segundo.
        <View className="h-11 w-11" />
      )}

      <View
        className="h-1 flex-1 overflow-hidden rounded-sm bg-white/70"
        accessibilityRole="progressbar"
        accessibilityLabel={t("onboarding.step", { current: step, total })}
        accessibilityValue={{ min: 0, max: total, now: step }}
      >
        <LinearGradient
          colors={["#F2A578", "#FBDFC2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${percent}%`, height: "100%" }}
        />
      </View>
    </View>
  );
};
