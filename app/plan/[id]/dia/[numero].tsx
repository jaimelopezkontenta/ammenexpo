import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { DayView } from "@/components/DayView";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
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
  const { scrollBottom } = useScreenPadding();
  const { id, numero } = useLocalSearchParams<{ id: string; numero: string }>();
  const dayNumber = Number(numero);

  const {
    data: day,
    isLoading,
    isError,
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
    return (
      <>
        <Stack.Screen options={{ title: t("plan.days"), headerShown: true }} />
        <LoadingState />
      </>
    );
  }

  if (isError || !day) {
    return (
      <>
        <Stack.Screen options={{ title: t("plan.days"), headerShown: true }} />
        <ErrorState
          onRetry={isError ? () => void refetch() : undefined}
          message={isError ? undefined : t("plan.dayNotFound")}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t("common.day", { number: day.day_number }),
          headerShown: true,
        }}
      />
      <DawnBackground>
        <ScrollView
          contentContainerClassName="gap-7 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <View className="gap-1">
            <Text className="font-serif-bold text-3xl leading-10 text-plum">
              {day.title}
            </Text>
            {/* Read-only on purpose. Marking a past day prayed belongs on Hoy,
              where "today" is what the streak is actually counting. */}
            {prayed ? (
              <Text className="font-sans-medium text-base text-mist-ink">
                {t("plan.dayPrayed")}
              </Text>
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
                  <Text className="font-sans-medium text-sm text-plum">
                    {t("common.day", { number: day.day_number - 1 })}
                  </Text>
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
                  <Text className="font-sans-medium text-sm text-plum">
                    {t("common.day", { number: day.day_number + 1 })}
                  </Text>
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
        </ScrollView>
      </DawnBackground>
    </>
  );
}
