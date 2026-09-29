import { MoreHorizontal } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { StreakRing } from "@/components/StreakRing";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { journeyCaptionKey } from "@/core/plans/todayView";
import { icon, useThemeColors } from "@/theme";

/**
 * La fila meta: dónde estás y cuánto llevas. A la derecha, el `···` que abre
 * el cajón del plan.
 */
export const JourneyMetaRow = ({
  streakDays,
  prayed,
  dayNumber,
  durationDays,
  stillPreparing,
  onOpenOptions,
}: {
  streakDays: number;
  prayed: boolean | undefined;
  dayNumber: number;
  durationDays: number;
  /** Generando, y no atascado: el resto del plan aún se escribe. */
  stillPreparing: boolean;
  onOpenOptions: () => void;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
        {streakDays > 0 ? (
          <StreakRing
            days={streakDays}
            accessibilityLabel={t("plan.streak", { count: streakDays })}
          />
        ) : null}
        <View className="min-w-0 flex-1 gap-1">
          <Txt variant="overline">
            {t(journeyCaptionKey(prayed, dayNumber))}
          </Txt>
          <Txt variant="label" tone="secondary">
            {t("plan.dayOf", {
              current: dayNumber,
              total: durationDays,
            })}
            {stillPreparing ? ` · ${t("plan.stillPreparing")}` : ""}
          </Txt>
          {/* La barra dice dónde estás, igual que su etiqueta. Medía los
              días orados: con «Día 4 de 14» encima y ninguno orado
              parecía rota. La constancia ya la cuenta el anillo. */}
          {/* Para el lector de pantalla la barra es decoración:
              anunciaba «Día X de Y» justo después de la línea que ya
              lo dice. */}
          {durationDays > 0 ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
            >
              <ProgressBar
                value={dayNumber}
                max={durationDays}
                accessibilityLabel={t("plan.dayOf", {
                  current: dayNumber,
                  total: durationDays,
                })}
              />
            </View>
          ) : null}
        </View>
      </View>

      <Tap
        accessibilityRole="button"
        accessibilityLabel={t("plan.planOptions")}
        onPress={onOpenOptions}
        // 44×44, el mínimo táctil, alrededor de un icono de 22. El
        // vidrio es el mismo de los chips sin elegir: sin él el icono
        // flotaba como una mancha gris sobre el amanecer.
        className="h-11 w-11 items-center justify-center rounded-full border border-glassedge/60 bg-glass/60"
      >
        <MoreHorizontal
          size={icon.md}
          color={colors.plum.DEFAULT}
          strokeWidth={icon.strokeWidth}
        />
      </Tap>
    </View>
  );
};
