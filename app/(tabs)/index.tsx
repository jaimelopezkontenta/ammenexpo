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
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { WhoPrayed } from "@/components/WhoPrayed";
import { useSession } from "@/core/auth/SessionProvider";
import { useBibleBooks } from "@/core/bible/queries";
import { parseCanonicalRef } from "@/core/bible/reference";
import {
  useReportIntercession,
  useWhoPrayedForMe,
} from "@/core/intercessions/queries";
import { liveStreak, useStreak } from "@/core/profile/queries";
import {
  isStuckGenerating,
  useAbandonPlan,
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

  const {
    data: plan,
    isLoading,
    isError,
    refetch: refetchPlan,
  } = useOwnPlan(userId);
  // Days appear one stretch at a time, so today's day is readable long before
  // the whole plan is written. Waiting for 'active' would hide a plan the user
  // could already be praying.
  const { data: day, refetch: refetchDay } = useTodayDay(
    plan && plan.status !== "failed" ? plan.id : undefined,
    plan?.status === "generating",
  );
  const { data: prayed } = usePrayedToday(day?.id);
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
  const scripture = parseCanonicalRef(day?.scripture_ref, books ?? []);

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
      <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
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
    );
  }

  // The plan is active but no day has come back. This used to render the word
  // "Cargando…" and stop — no spinner, no retry, no way to tell whether it was
  // working. useTodayDay now polls while generating, so reaching here means
  // something is genuinely wrong.
  if (!day) {
    return <ErrorState onRetry={() => void refetchDay()} />;
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

          {/* The verse is shown out of context: this is the way into the
              chapter around it. If the reference cannot be parsed there is no
              link at all — guessing would open the wrong chapter. */}
          {scripture ? (
            <Pressable
              accessibilityRole="button"
              // Without an explicit label the name is built from the children,
              // so the arrow became part of it: "Leer el capítulo flecha hacia
              // la derecha".
              accessibilityLabel={t("bible.readInContext")}
              onPress={() =>
                router.push({
                  pathname: "/libro/[book]/[chapter]",
                  params: {
                    book: String(scripture.bookId),
                    chapter: String(scripture.chapter),
                    verse: String(scripture.verse),
                  },
                })
              }
            >
              <Text className="text-sm font-medium text-slate-600">
                {t("bible.readInContext")} <Text aria-hidden>→</Text>
              </Text>
            </Pressable>
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
