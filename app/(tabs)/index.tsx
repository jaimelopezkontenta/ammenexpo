import { Link, router } from "expo-router";
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
import { VerseOfTheDay } from "@/components/VerseOfTheDay";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { WhoPrayed } from "@/components/WhoPrayed";
import { useSession } from "@/core/auth/SessionProvider";
import { useBibleBooks } from "@/core/bible/queries";
import {
  usePlansSharedWithMe,
  useReportIntercession,
  useWhoPrayedForMe,
} from "@/core/intercessions/queries";
import { useBlockUser } from "@/core/moderation/blocks";
import { liveStreak, useStreak } from "@/core/profile/queries";
import {
  isStuckGenerating,
  useAbandonPlan,
  useActivePlanId,
  useContinuePlan,
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
  const { data: prayedForMe, isError: prayedForMeFailed } =
    useWhoPrayedForMe(userId);
  const { data: sharedWithMe } = usePlansSharedWithMe(userId);
  const { data: books } = useBibleBooks();

  const report = useReportIntercession(userId);
  const block = useBlockUser(userId);
  const abandon = useAbandonPlan(userId);
  const rename = useRenamePlan(userId);
  const continuePlan = useContinuePlan(userId);
  const markPrayed = useMarkPrayed(day?.id, userId);

  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The first person who prayed for you today and whose own plan you can open.
  const prayBackPlanId =
    (sharedWithMe ?? []).find((shared) =>
      (prayedForMe ?? []).some(
        (person) => person.intercessor_id === shared.owner_id,
      ),
    )?.plan_id ?? null;

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

  // Reporting used to be `report.mutate(...)` with no onError and no success
  // feedback: two round trips, and if the second failed the report was filed,
  // the message stayed on screen, and nothing was said. `intercession.reported`
  // has been translated in both languages all along without ever rendering.
  const runOnIntercessor = async (
    action: () => Promise<unknown>,
    done: string,
  ) => {
    setActionError(null);
    setNotice(null);

    try {
      await action();
      setNotice(done);
    } catch {
      setActionError(t("common.errorGeneric"));
    }
  };

  const resumeGeneration = async () => {
    if (!plan) return;

    setActionError(null);
    setNotice(null);

    try {
      await continuePlan.mutateAsync(plan.id);
      setNotice(t("plan.resumed"));
    } catch {
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
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-8">
        <ActivityIndicator
          color="#1C1917"
          accessibilityLabel={t("plan.generating")}
        />
        <Text className="text-center text-xl font-semibold text-ink">
          {t("plan.generating")}
        </Text>
        <Text className="text-center text-base text-ink-muted">
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
      <View className="flex-1 gap-3 bg-paper px-8 py-10">
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
          <Text className="text-center text-2xl font-bold text-ink">
            {failed ? t("plan.failedTitle") : t("plan.noPlanTitle")}
          </Text>
          <Text className="text-center text-base leading-6 text-ink-muted">
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

        {/* Un motivo para volver mañana aunque todavía no haya plan. Esta
            pantalla era un botón y nada más: quien no genera el plan hoy no
            tenía absolutamente nada que hacer aquí. */}
        <VerseOfTheDay />

        {/* Y dos salidas más, discretas: orar por alguien y traer a alguien no
            dependen de tener plan, y son justo lo que puede hacer quien todavía
            no está listo para contarle su vida a una IA. */}
        <View className="gap-2 pt-2">
          <Link href="/comunidad" asChild>
            <Button title={t("community.title")} variant="ghost" />
          </Link>
          <Link href="/invitar" asChild>
            <Button title={t("invite.title")} variant="ghost" />
          </Link>
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
        className="flex-1 bg-paper"
        contentContainerClassName="flex-grow gap-3 px-8 py-14"
      >
        <PlanSwitcher
          plans={plans ?? []}
          activeId={plan.id}
          onSelect={selectPlan}
        />

        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-center text-2xl font-bold text-ink">
            {t("plan.finishedTitle")}
          </Text>
          <Text className="text-center text-base leading-6 text-ink-muted">
            {plan.title}
          </Text>

          {/* An honest count, not a congratulation. Someone who prayed 11 of 30
              days is told 11 of 30 — rounding that up would make the one screen
              that looks back the one screen that flatters. */}
          <Text className="mt-4 text-center text-base leading-6 text-ink-muted">
            {t("plan.finishedDays", {
              count: progress.days_prayed,
              total: progress.days_total,
            })}
          </Text>

          {progress.intercessions_received > 0 ? (
            <Text className="text-center text-base leading-6 text-ink-muted">
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
          {/* The moment with the most intention the product has, and until now
              it was spent on a frozen screen. Asking here rather than anywhere
              else is the whole point: thirty days of praying for something is
              exactly when you know whether it was answered. */}
          <Link
            href={{
              pathname: "/testimonios/nuevo",
              params: { plan: plan.id },
            }}
            asChild
          >
            <Button title={t("testimony.askAfterPlan")} variant="secondary" />
          </Link>

          <Button
            title={t("plan.finishedCta")}
            onPress={() => void startGeneration()}
          />

          {/* Y traer a alguien. Terminar treinta días de oración es el momento
              del producto en que más sentido tiene decírselo a otra persona, y
              hasta aquí esta pantalla miraba solo hacia atrás. */}
          <Link href="/invitar" asChild>
            <Button title={t("invite.title")} variant="ghost" />
          </Link>
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
      className="flex-1 bg-paper"
      contentContainerClassName="gap-7 px-7 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <PlanSwitcher
        plans={plans ?? []}
        activeId={plan.id}
        onSelect={selectPlan}
      />

      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {t("plan.dayOf", {
            current: day.day_number,
            total: plan.duration_days,
          })}
          {plan.status === "generating" && !stuck
            ? ` · ${t("plan.stillPreparing")}`
            : ""}
          {days > 0 ? ` · ${t("plan.streak", { count: days })}` : ""}
        </Text>

        {/* A generation whose first stretch landed and whose second crashed
            used to say "seguimos preparándolo" every day, forever: both
            branches that handle a stuck plan require *no* day, and this one
            has one. The days already written are worth keeping, so the way out
            is to continue rather than to start over. */}
        {stuck ? (
          <View className="mt-2 gap-2 rounded-2xl bg-paper-sunken p-4">
            <Text className="text-sm leading-5 text-ink-muted">
              {t("plan.stalledBody", {
                written: progress?.days_written ?? day.day_number,
                total: plan.duration_days,
              })}
            </Text>
            <Button
              title={t("plan.stalledCta")}
              variant="secondary"
              loading={continuePlan.isPending}
              onPress={() => void resumeGeneration()}
            />
          </View>
        ) : null}

        <Text className="font-serif-bold text-3xl leading-10 text-ink">
          {day.title}
        </Text>

        {draftTitle === null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("plan.rename")}
            onPress={() => setDraftTitle(plan.title)}
          >
            <Text className="text-base text-ink-muted">{plan.title} ✎</Text>
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
          <Text className="text-center text-base font-medium text-ink-muted">
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
        {/* Hoy was the last screen still reading a failed query as an empty
            one — and it is the most personal one there is. "Todavía nadie ha
            orado hoy" when the read simply failed is the most expensive lie
            the app can tell. */}
        {prayedForMeFailed ? (
          <Text
            className="text-base leading-6 text-ink-muted"
            accessibilityRole="alert"
          >
            {t("common.errorBody")}
          </Text>
        ) : (
          <WhoPrayed
            people={prayedForMe ?? []}
            onReport={(intercessionId) =>
              void runOnIntercessor(
                () => report.mutateAsync({ intercessionId }),
                t("intercession.reported"),
              )
            }
            onBlock={(blockedId) =>
              void runOnIntercessor(
                () => block.mutateAsync(blockedId),
                t("moderation.blockDone"),
              )
            }
          />
        )}

        {notice ? (
          <Text
            className="text-sm text-ink-muted"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {notice}
          </Text>
        ) : null}
      </DaySection>

      {/* "Pray for their plan" needs a "their", and it needs that person to
          actually have shared one. It used to push to /orar unconditionally,
          so anyone whose intercessor had not shared a plan landed on "Todavía
          nadie ha compartido su plan contigo" — flatly contradicting the list
          they had just tapped away from. */}
      {prayBackPlanId ? (
        <View className="pb-4">
          <Button
            title={t("intercession.prayBack")}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/orar/[planId]",
                params: { planId: prayBackPlanId },
              })
            }
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
