import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { DaySection } from "@/components/DaySection";
import { TextField } from "@/components/TextField";
import { WhoPrayed } from "@/components/WhoPrayed";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useReportIntercession,
  useWhoPrayedForMe,
} from "@/core/intercessions/queries";
import { liveStreak, useStreak } from "@/core/profile/queries";
import {
  isStuckGenerating,
  PlanLimitReached,
  useAbandonPlan,
  useGeneratePlan,
  useMarkPrayed,
  useOwnPlan,
  usePrayedToday,
  useRenamePlan,
  useTodayDay,
} from "@/core/plans/queries";

export default function Today() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: plan, isLoading } = useOwnPlan(userId);
  // Days appear one stretch at a time, so today's day is readable long before
  // the whole plan is written. Waiting for 'active' would hide a plan the user
  // could already be praying.
  const { data: day } = useTodayDay(
    plan && plan.status !== "failed" ? plan.id : undefined,
  );
  const { data: prayed } = usePrayedToday(day?.id);
  const { data: streak } = useStreak(userId);
  const { data: prayedForMe } = useWhoPrayedForMe(userId);

  const report = useReportIntercession(userId);
  const generate = useGeneratePlan(userId);
  const abandon = useAbandonPlan(userId);
  const rename = useRenamePlan(userId);
  const markPrayed = useMarkPrayed(day?.id, userId);

  const [draftTitle, setDraftTitle] = useState<string | null>(null);

  const stuck = isStuckGenerating(plan);
  const days = liveStreak(streak);

  const startGeneration = async () => {
    // A crashed generation would otherwise sit in 'generating' forever and
    // count against the free allowance.
    if (plan && (plan.status === "failed" || stuck)) {
      await abandon.mutateAsync(plan.id);
    }

    router.push("/plan/nuevo");
  };

  const saveTitle = async () => {
    if (!plan || draftTitle === null) return;

    if (draftTitle.trim().length > 0 && draftTitle.trim() !== plan.title) {
      await rename.mutateAsync({ planId: plan.id, title: draftTitle });
    }

    setDraftTitle(null);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0f172a" />
      </View>
    );
  }

  // Only block while there is nothing to pray yet. Generation runs in the
  // background, so this state survives closing the app.
  if (plan?.status === "generating" && !day && !stuck) {
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

  if (!plan || (plan.status === "failed" && !day) || (stuck && !day)) {
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
      contentContainerClassName="gap-7 px-7 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t("plan.dayOf", {
            current: day.day_number,
            total: plan.duration_days,
          })}
          {plan.status === "generating" ? ` · ${t("plan.stillPreparing")}` : ""}
          {days > 0 ? ` · ${t("plan.streak", { count: days })}` : ""}
        </Text>

        <Text className="text-3xl font-bold leading-9 text-slate-900">
          {day.title}
        </Text>

        {draftTitle === null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("plan.rename")}
            onPress={() => setDraftTitle(plan.title)}
          >
            <Text className="text-base text-slate-500">{plan.title} ✎</Text>
          </Pressable>
        ) : (
          <View className="mt-2 gap-2">
            <TextField
              label={t("plan.titlePlaceholder")}
              value={draftTitle}
              onChangeText={setDraftTitle}
              maxLength={140}
              autoFocus
              onSubmitEditing={() => void saveTitle()}
              returnKeyType="done"
            />
            <Button
              title={t("common.save")}
              loading={rename.isPending}
              onPress={() => void saveTitle()}
            />
          </View>
        )}
      </View>

      {day.scripture_text ? (
        <DaySection label={t("plan.scripture")} tone="scripture">
          <Text className="text-lg leading-7 text-slate-800">
            {day.scripture_text}
          </Text>
          {day.scripture_ref ? (
            <Text className="text-sm font-medium text-slate-500">
              {day.scripture_ref}
            </Text>
          ) : null}
        </DaySection>
      ) : null}

      {day.interpretation ? (
        <DaySection label={t("plan.meaning")}>
          <Text className="text-base leading-7 text-slate-700">
            {day.interpretation}
          </Text>
        </DaySection>
      ) : null}

      {day.daily_action ? (
        <DaySection label={t("plan.action")} tone="action">
          <Text className="text-lg leading-7 text-amber-950">
            {day.daily_action}
          </Text>
        </DaySection>
      ) : null}

      <DaySection label={t("plan.prayer")}>
        <Text className="text-base leading-8 text-slate-800">
          {day.prayer_body}
        </Text>
      </DaySection>

      <View className="pb-2 pt-2">
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

      {/* Seeing who showed up for you is the reason to come back tomorrow, so
          it lives on this screen rather than behind a notification. */}
      <DaySection label={t("intercession.whoPrayed")}>
        <WhoPrayed
          people={prayedForMe ?? []}
          onReport={(intercessionId) => report.mutate({ intercessionId })}
        />
      </DaySection>

      {/* "Pray for their plan" needs a "their": with an empty list the button
          refers to nobody. */}
      {(prayedForMe ?? []).length > 0 ? (
        <View className="pb-4">
          <Button
            title={t("intercession.prayBack")}
            variant="secondary"
            onPress={() => router.push("/orar")}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
