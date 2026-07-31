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
import { DayView } from "@/components/DayView";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { WhoPrayed } from "@/components/WhoPrayed";
import { useSession } from "@/core/auth/SessionProvider";
import { useBibleBooks } from "@/core/bible/queries";
import {
  useReportIntercession,
  useWhoPrayedForMe,
} from "@/core/intercessions/queries";
import { liveStreak, useStreak } from "@/core/profile/queries";
import {
  isStuckGenerating,
  useAbandonPlan,
  useActivePlanId,
  useMarkPrayed,
  useMyPlans,
  usePlanProgress,
  usePrayedToday,
  useRenamePlan,
  useSetActivePlan,
  useTodayDay,
} from "@/core/plans/queries";

export default function Today() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: plans,
    isLoading,
    isError,
    refetch: refetchPlan,
  } = useMyPlans(userId);
  const { data: activePlanId } = useActivePlanId(userId);
  const setActivePlan = useSetActivePlan(userId);

  // Falls back to the newest plan, which is what this screen always showed and
  // is the right default for someone who has never chosen.
  const plan =
    (plans ?? []).find((entry) => entry.id === activePlanId) ??
    (plans ?? [])[0] ??
    null;
  // Days appear one stretch at a time, so today's day is readable long before
  // the whole plan is written. Waiting for 'active' would hide a plan the user
  // could already be praying.
  const { data: day, refetch: refetchDay } = useTodayDay(
    plan && plan.status !== "failed" ? plan.id : undefined,
    plan?.status === "generating",
  );
  const { data: prayed } = usePrayedToday(day?.id);
  const { data: progress } = usePlanProgress(plan?.id);
  const { data: streak } = useStreak(userId);
  const { data: prayedForMe } = useWhoPrayedForMe(userId);
  const { data: books } = useBibleBooks();

  const report = useReportIntercession(userId);
  const abandon = useAbandonPlan(userId);
  const rename = useRenamePlan(userId);
  const markPrayed = useMarkPrayed(day?.id, userId);

  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const stuck = isStuckGenerating(plan);
  const days = liveStreak(streak);

  const startGeneration = async () => {
    setActionError(null);

    try {
      // A crashed generation would otherwise sit in 'generating' forever and
      // count against the free allowance.
      if (plan && (plan.status === "failed" || stuck)) {
        await abandon.mutateAsync(plan.id);
      }

      router.push("/plan/nuevo");
    } catch {
      // Uncaught, the navigation never ran — so "Reintentar" was inert exactly
      // when the backend was unhealthy, which is the only time it is offered.
      setActionError(t("common.errorGeneric"));
    }
  };

  const selectPlan = async (planId: string) => {
    if (planId === plan?.id) return;

    setActionError(null);

    try {
      await setActivePlan.mutateAsync(planId);
    } catch {
      // Silent here would be the worst outcome: the chips would snap back and
      // the screen would keep showing the plan you just tried to leave.
      setActionError(t("common.errorGeneric"));
    }
  };

  const saveTitle = async () => {
    if (!plan || draftTitle === null) return;

    setActionError(null);

    try {
      if (draftTitle.trim().length > 0 && draftTitle.trim() !== plan.title) {
        await rename.mutateAsync({ planId: plan.id, title: draftTitle });
      }

      setDraftTitle(null);
    } catch {
      // Leaving the editor open is the right call here: the text they typed is
      // still in it, so they can try again without retyping.
      setActionError(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetchPlan()} />;
  }

  // Only block while there is nothing to pray yet. Generation runs in the
  // background, so this state survives closing the app.
  if (plan?.status === "generating" && !day && !stuck) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-white px-8">
        <ActivityIndicator
          color="#0f172a"
          accessibilityLabel={t("plan.generating")}
        />
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
    // The limit branch used to live here reading `generate.error`, but this
    // screen never calls `generate` — it only navigates to the form — so it was
    // permanently unreachable. The limit is surfaced where it is actually
    // raised, in plan/nuevo.tsx.
    const failed = plan?.status === "failed" || stuck;

    return (
      <View className="flex-1 gap-3 bg-white px-8 py-10">
        {/* A failed plan can be the newest one, and without a way off this
            screen the plans that do work become unreachable. */}
        {plan ? (
          <PlanSwitcher
            plans={plans ?? []}
            activeId={plan.id}
            onSelect={selectPlan}
          />
        ) : null}

        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-center text-2xl font-bold text-slate-900">
            {failed ? t("plan.failedTitle") : t("plan.noPlanTitle")}
          </Text>
          <Text className="text-center text-base leading-6 text-slate-500">
            {failed ? t("plan.failedBody") : t("plan.noPlanBody")}
          </Text>

          {actionError ? (
            <Text
              className="text-center text-sm text-red-500"
              accessibilityRole="alert"
            >
              {actionError}
            </Text>
          ) : null}

          <View className="mt-6 w-full">
            <Button
              title={failed ? t("common.retry") : t("plan.createCta")}
              loading={abandon.isPending}
              onPress={() => void startGeneration()}
            />
          </View>
        </View>
      </View>
    );
  }

  // The plan is active but no day has come back. This used to render the word
  // "Cargando…" and stop — no spinner, no retry, no way to tell whether it was
  // working. useTodayDay now polls while generating, so reaching here means
  // something is genuinely wrong.
  if (!day) {
    return <ErrorState onRetry={() => void refetchDay()} />;
  }

  // The day a plan ends.
  //
  // Without this branch the screen simply kept showing the last day: get_my_day
  // clamps to the newest unlocked one, usePrayedToday counts that day's log
  // whenever it happened, so every morning after the plan was over it said
  // "Oraste hoy 🙏" and offered nothing — while the streak quietly fell to zero
  // because nothing was left to insert. It is also the moment with the most
  // intention in the whole product, and it was being spent on a frozen screen.
  if (progress?.finished) {
    return (
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="flex-grow gap-3 px-8 py-14"
      >
        <PlanSwitcher
          plans={plans ?? []}
          activeId={plan.id}
          onSelect={selectPlan}
        />

        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-center text-2xl font-bold text-slate-900">
            {t("plan.finishedTitle")}
          </Text>
          <Text className="text-center text-base leading-6 text-slate-500">
            {plan.title}
          </Text>

          {/* An honest count, not a congratulation. Someone who prayed 11 of 30
              days is told 11 of 30 — rounding that up would make the one screen
              that looks back the one screen that flatters. */}
          <Text className="mt-4 text-center text-base leading-6 text-slate-600">
            {t("plan.finishedDays", {
              count: progress.days_prayed,
              total: progress.days_total,
            })}
          </Text>

          {progress.intercessions_received > 0 ? (
            <Text className="text-center text-base leading-6 text-slate-600">
              {t("plan.finishedIntercessions", {
                count: progress.intercessions_received,
              })}
            </Text>
          ) : null}
        </View>

        {actionError ? (
          <Text
            className="text-center text-sm text-red-500"
            accessibilityRole="alert"
          >
            {actionError}
          </Text>
        ) : null}

        <View className="gap-3">
          <Button
            title={t("plan.finishedCta")}
            onPress={() => void startGeneration()}
          />
          <Button
            title={t("plan.seeDays")}
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: "/plan/[id]/dias",
                params: { id: plan.id },
              })
            }
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="gap-7 px-7 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <PlanSwitcher
        plans={plans ?? []}
        activeId={plan.id}
        onSelect={selectPlan}
      />

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

      <DayView day={day} books={books ?? []} />

      <View className="pb-2 pt-2">
        {prayed ? (
          <Text className="text-center text-base font-medium text-slate-600">
            {t("plan.markedDone")}
          </Text>
        ) : (
          <Button
            title={t("plan.markDone")}
            loading={markPrayed.isPending}
            onPress={() =>
              markPrayed.mutate(undefined, {
                onError: () => setActionError(t("common.errorGeneric")),
              })
            }
          />
        )}
      </View>

      {actionError ? (
        <Text
          className="text-center text-sm text-red-500"
          accessibilityRole="alert"
        >
          {actionError}
        </Text>
      ) : null}

      {/* Only offered once there is a yesterday to go back to. */}
      {day.day_number > 1 ? (
        <View className="pb-2">
          <Button
            title={t("plan.seeDays")}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/plan/[id]/dias",
                params: { id: plan.id },
              })
            }
          />
        </View>
      ) : null}

      <View className="pb-2">
        <Button
          title={t("share.open")}
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/plan/[id]/compartir",
              params: { id: plan.id },
            })
          }
        />
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
