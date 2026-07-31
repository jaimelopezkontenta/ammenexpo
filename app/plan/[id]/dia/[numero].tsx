import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { DayView } from "@/components/DayView";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useBibleBooks } from "@/core/bible/queries";
import { usePlanDay, usePrayedToday } from "@/core/plans/queries";

export default function PlanDayDetail() {
  const { t } = useTranslation();
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
      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="gap-7 px-7 py-8"
      >
        <View className="gap-1">
          <Text className="font-serif-bold text-3xl leading-10 text-ink">
            {day.title}
          </Text>
          {/* Read-only on purpose. Marking a past day prayed belongs on Hoy,
              where "today" is what the streak is actually counting. */}
          {prayed ? (
            <Text className="text-base font-medium text-ink-muted">
              {t("plan.dayPrayed")}
            </Text>
          ) : null}
        </View>

        <DayView day={day} books={books ?? []} />
      </ScrollView>
    </>
  );
}
