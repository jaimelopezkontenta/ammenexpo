import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { DayView } from "@/components/DayView";
import { Txt } from "@/components/ui/Text";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Tap } from "@/components/ui/Tap";
import { useBibleBooks } from "@/core/bible/queries";
import {
  usePlanDay,
  usePlanProgress,
  usePrayedToday,
} from "@/core/plans/queries";
import { icon, useThemeColors } from "@/theme";

export default function PlanDayDetail() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id, numero } = useLocalSearchParams<{ id: string; numero: string }>();
  const dayNumber = Number(numero);

  const {
    data: day,
    isLoading,
    isLoadingError,
    refetch,
  } = usePlanDay(id, Number.isInteger(dayNumber) ? dayNumber : undefined);
  const { data: books } = useBibleBooks();
  const { data: prayed } = usePrayedToday(day?.id);
  const { data: progress } = usePlanProgress(id);

  // Solo hasta el último día ya escrito: un plan a medio generar no debe
  // ofrecer un "siguiente" que aterrice en el vacío.
  const lastWritten = progress?.days_written ?? 0;

  const goToDay = (target: number) =>
    router.setParams({ numero: String(target) });

  if (isLoading) {
    return <ScreenScaffold title={t("plan.days")} loading />;
  }

  if (isLoadingError || !day) {
    return (
      <ScreenScaffold
        title={t("plan.days")}
        error
        onRetry={isLoadingError ? () => void refetch() : undefined}
        errorMessage={isLoadingError ? undefined : t("plan.dayNotFound")}
      />
    );
  }

  return (
    <ScreenScaffold
      title={t("common.day", { number: day.day_number })}
      contentClassName="gap-7"
    >
      <View className="gap-1">
        <Txt variant="title">{day.title}</Txt>
        {/* Read-only on purpose. Marking a past day prayed belongs on Hoy,
              where "today" is what the streak is actually counting. */}
        {prayed ? (
          <Txt variant="bodyMedium" tone="secondary">
            {t("plan.dayPrayed")}
          </Txt>
        ) : null}
      </View>

      <DayView day={day} books={books ?? []} />

      {/* Ayer y mañana en una fila, no dos botones apilados al fondo: la
            pantalla era de solo lectura y estaba muerta — leído un día, no
            había cómo pasar al siguiente. */}
      {lastWritten > 1 ? (
        <View className="flex-row items-center justify-between pt-2">
          {day.day_number > 1 ? (
            <Tap
              accessibilityRole="button"
              accessibilityLabel={t("common.day", {
                number: day.day_number - 1,
              })}
              onPress={() => goToDay(day.day_number - 1)}
              className="min-h-11 flex-row items-center gap-1 rounded-cta border border-glassedge/60 bg-glass/60 py-2 pl-2 pr-4"
            >
              <ChevronLeft
                size={icon.sm}
                color={colors.plum.DEFAULT}
                strokeWidth={icon.strokeWidth}
              />
              <Txt variant="label">
                {t("common.day", { number: day.day_number - 1 })}
              </Txt>
            </Tap>
          ) : (
            <View />
          )}

          {day.day_number < lastWritten ? (
            <Tap
              accessibilityRole="button"
              accessibilityLabel={t("common.day", {
                number: day.day_number + 1,
              })}
              onPress={() => goToDay(day.day_number + 1)}
              className="min-h-11 flex-row items-center gap-1 rounded-cta border border-glassedge/60 bg-glass/60 py-2 pl-4 pr-2"
            >
              <Txt variant="label">
                {t("common.day", { number: day.day_number + 1 })}
              </Txt>
              <ChevronRight
                size={icon.sm}
                color={colors.plum.DEFAULT}
                strokeWidth={icon.strokeWidth}
              />
            </Tap>
          ) : (
            <View />
          )}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}
