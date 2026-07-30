import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useSession } from "@/core/auth/SessionProvider";
import {
  isStuckGenerating,
  PlanLimitReached,
  useAbandonPlan,
  useGeneratePlan,
  useMarkPrayed,
  useOwnPlan,
  usePrayedToday,
  useTodayDay,
} from "@/core/plans/queries";

const DEFAULT_PLAN_DAYS = 7;

export default function Today() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: plan, isLoading } = useOwnPlan(userId);
  const { data: day } = useTodayDay(
    plan?.status === "active" ? plan.id : undefined,
  );
  const { data: prayed } = usePrayedToday(day?.id);

  const generate = useGeneratePlan(userId);
  const abandon = useAbandonPlan(userId);
  const markPrayed = useMarkPrayed(day?.id, userId);

  const stuck = isStuckGenerating(plan);

  const startGeneration = async () => {
    // A crashed generation would otherwise sit in 'generating' forever and
    // count against the free allowance.
    if (plan && (plan.status === "failed" || stuck)) {
      await abandon.mutateAsync(plan.id);
    }

    generate.mutate(DEFAULT_PLAN_DAYS);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0f172a" />
      </View>
    );
  }

  // Generation runs in the background, so this state survives closing the app.
  if (plan?.status === "generating" && !stuck) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-white px-8">
        <ActivityIndicator color="#0f172a" />
        <Text className="text-center text-xl font-semibold text-slate-900">
          {t("plan.generating")}
        </Text>
        <Text className="text-center text-base text-slate-500">
          {t("plan.generatingHint")}
        </Text>
      </View>
    );
  }

  if (!plan || plan.status === "failed" || stuck) {
    const limitReached = generate.error instanceof PlanLimitReached;
    const failed = plan?.status === "failed" || stuck;

    return (
      <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Text className="text-center text-2xl font-bold text-slate-900">
          {limitReached
            ? t("plan.limitTitle")
            : failed
              ? t("plan.failedTitle")
              : t("plan.noPlanTitle")}
        </Text>
        <Text className="text-center text-base leading-6 text-slate-500">
          {limitReached
            ? t("plan.limitBody")
            : failed
              ? t("plan.failedBody")
              : t("plan.noPlanBody")}
        </Text>

        {!limitReached ? (
          <View className="mt-6 w-full">
            <Button
              title={failed ? t("common.retry") : t("plan.createCta")}
              loading={generate.isPending || abandon.isPending}
              onPress={() => void startGeneration()}
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (!day) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-base text-slate-500">
          {t("common.loading")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="gap-6 px-7 py-10"
    >
      <View className="gap-1">
        <Text className="text-sm font-medium text-slate-400">
          {t("common.day", { number: day.day_number })}
        </Text>
        <Text className="text-2xl font-bold text-slate-900">{day.title}</Text>
        <Text className="text-base text-slate-500">{plan.title}</Text>
      </View>

      {day.scripture_text ? (
        <View className="gap-2 rounded-2xl bg-slate-50 p-5">
          <Text className="text-sm font-medium text-slate-400">
            {t("plan.scripture")}
          </Text>
          <Text className="text-base leading-6 text-slate-800">
            {day.scripture_text}
          </Text>
          {day.scripture_ref ? (
            <Text className="text-sm text-slate-500">{day.scripture_ref}</Text>
          ) : null}
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-sm font-medium text-slate-400">
          {t("plan.prayer")}
        </Text>
        <Text className="text-base leading-7 text-slate-800">
          {day.prayer_body}
        </Text>
      </View>

      {day.reflection_question ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-slate-400">
            {t("plan.reflection")}
          </Text>
          <Text className="text-base leading-6 text-slate-800">
            {day.reflection_question}
          </Text>
        </View>
      ) : null}

      <View className="pt-4">
        {prayed ? (
          <Text className="text-center text-base font-medium text-slate-600">
            {t("plan.markedDone")}
          </Text>
        ) : (
          <Button
            title={t("plan.markDone")}
            loading={markPrayed.isPending}
            onPress={() => markPrayed.mutate()}
          />
        )}
      </View>
    </ScrollView>
  );
}
