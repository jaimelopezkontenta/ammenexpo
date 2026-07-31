import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ErrorState, LoadingState } from "@/components/ScreenState";
import { usePlanDays } from "@/core/plans/queries";
import { usePlanSummary } from "@/core/plans/sharing";

/**
 * Every day you have reached, so yesterday's prayer is not gone.
 *
 * A thirty-day plan used to show only the latest unlocked day: skip one and it
 * was unreachable, and the prayer that helped could never be reread.
 */
export default function PlanDays() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: plan } = usePlanSummary(id);
  const { data: days, isLoading, isError, refetch } = usePlanDays(id);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("plan.days"), headerShown: true }} />
        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen options={{ title: t("plan.days"), headerShown: true }} />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: plan?.title ?? t("plan.days"), headerShown: true }}
      />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-3 px-7 py-8"
      >
        <Text className="text-sm text-slate-500">
          {t("plan.daysHint", { count: days?.length ?? 0 })}
        </Text>

        {(days ?? []).map((day) => (
          <Pressable
            key={day.id}
            accessibilityRole="link"
            accessibilityLabel={`${t("common.day", { number: day.day_number })}. ${day.title}`}
            className="gap-1 rounded-2xl border border-slate-200 p-5"
            onPress={() =>
              router.push({
                pathname: "/plan/[id]/dia/[numero]",
                params: { id: id!, numero: String(day.day_number) },
              })
            }
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("common.day", { number: day.day_number })}
              </Text>
              {/* A quiet mark, not a scoreboard: this is a record of what you
                  prayed, not a list of what you owe. */}
              {day.prayed ? (
                <Text className="text-sm text-slate-400">
                  {t("plan.dayPrayed")}
                </Text>
              ) : null}
            </View>

            <Text className="text-lg font-semibold text-slate-900">
              {day.title}
            </Text>

            {day.scripture_ref ? (
              <Text className="text-sm text-slate-500">
                {day.scripture_ref}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}
