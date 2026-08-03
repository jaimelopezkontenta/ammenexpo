import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
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
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: plan } = usePlanSummary(id);
  const { data: days, isLoading, isError, refetch } = usePlanDays(id);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("plan.days"), headerShown: true }} />
        <LoadingState variant="cool" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen options={{ title: t("plan.days"), headerShown: true }} />
        <ErrorState variant="cool" onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: plan?.title ?? t("plan.days"), headerShown: true }}
      />
      <DawnBackground variant="cool">
        <ScrollView contentContainerClassName="gap-3 px-7 py-8">
          <Text className="font-sans text-sm text-mist-ink">
            {t("plan.daysHint", {
              count: (days ?? []).filter((day) => day.unlocked).length,
            })}
          </Text>

          {(days ?? []).map((day) => {
            // The days still to come. `plan.locked` — "Este día se abre el
            // {{date}}" — has been translated in both languages since the first
            // week with nothing rendering it, and without them a thirty-day plan
            // ended at today and gave no sign there was any road left.
            if (!day.unlocked) {
              return (
                <View
                  key={day.day_number}
                  className="gap-1 rounded-2xl border border-dashed border-white/60 p-5"
                >
                  <Text className="font-sans-semibold text-xs uppercase tracking-wide text-mist-ink">
                    {t("common.day", { number: day.day_number })}
                  </Text>
                  <Text className="font-sans text-base text-mist-ink">
                    {t("plan.locked", {
                      date: new Date(day.unlock_date).toLocaleDateString(
                        i18n.language,
                        { day: "numeric", month: "long" },
                      ),
                    })}
                  </Text>
                </View>
              );
            }

            return (
              <Pressable
                key={day.day_number}
                accessibilityRole="link"
                accessibilityLabel={`${t("common.day", { number: day.day_number })}. ${day.title}`}
                className="gap-1 rounded-2xl border border-white/60 p-5"
                onPress={() =>
                  router.push({
                    pathname: "/plan/[id]/dia/[numero]",
                    params: { id: id!, numero: String(day.day_number) },
                  })
                }
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-sans-semibold text-xs uppercase tracking-wide text-mist-ink">
                    {t("common.day", { number: day.day_number })}
                  </Text>
                  {/* A quiet mark, not a scoreboard: this is a record of what you
                    prayed, not a list of what you owe. */}
                  {day.prayed ? (
                    <Text className="font-sans text-sm text-mist-ink">
                      {t("plan.dayPrayed")}
                    </Text>
                  ) : null}
                </View>

                <Text className="font-sans-semibold text-lg text-plum">
                  {day.title}
                </Text>

                {day.scripture_ref ? (
                  <Text className="font-sans text-sm text-mist-ink">
                    {day.scripture_ref}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </DawnBackground>
    </>
  );
}
