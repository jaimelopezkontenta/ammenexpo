import { Link, router } from "expo-router";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { TabHeader } from "@/components/TabHeader";
import { Button } from "@/components/Button";
import { Card, CardDark } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { DaySection } from "@/components/DaySection";
import { DayView } from "@/components/DayView";
import { Glass } from "@/components/Glass";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { Orb } from "@/components/Orb";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
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
import { liveStreak, useProfile, useStreak } from "@/core/profile/queries";
import {
  GenerationInFlight,
  RequestIdConflict,
  isStuckGenerating,
  useActivePlanId,
  useArchivePlan,
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
  const { t, i18n } = useTranslation();
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
  const { data: profile } = useProfile(userId);
  const { data: prayedForMe, isError: prayedForMeFailed } =
    useWhoPrayedForMe(userId);
  const { data: sharedWithMe } = usePlansSharedWithMe(userId);
  const { data: books } = useBibleBooks();

  const report = useReportIntercession(userId);
  const block = useBlockUser(userId);
  const rename = useRenamePlan(userId);
  const archivePlan = useArchivePlan(userId);
  const continuePlan = useContinuePlan(userId);
  const markPrayed = useMarkPrayed(day?.id, userId);

  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [socialActionError, setSocialActionError] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(
    null,
  );

  // The first person who prayed for you today and whose own plan you can open.
  const prayBackPlanId =
    (sharedWithMe ?? []).find((shared) =>
      (prayedForMe ?? []).some(
        (person) => person.intercessor_id === shared.owner_id,
      ),
    )?.plan_id ?? null;

  const stuck = isStuckGenerating(plan, progress);
  const days = liveStreak(streak);

  const startGeneration = async () => {
    setActionError(null);

    try {
      // A failed plan is left as it is (its quota is already spent and is not
      // refunded by marking it failed); starting over means creating a new
      // plan, which the form gates against the allowance itself.
      router.push("/plan/nuevo");
    } catch {
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
    setSocialActionError(null);
    setNotice(null);

    try {
      await action();
      setNotice(done);
    } catch {
      setSocialActionError(t("common.errorGeneric"));
    }
  };

  const resumeGeneration = async () => {
    if (!plan) return;

    setActionError(null);
    setNotice(null);

    try {
      await continuePlan.mutateAsync(plan.id);
      setNotice(t("plan.resumed"));
    } catch (caught) {
      // "Ya lo estamos escribiendo" no es un fallo: otro toque rápido no debe
      // pintar una línea roja encima de un plan que sí se está escribiendo.
      setActionError(
        caught instanceof GenerationInFlight
          ? t("plan.generationInFlight")
          : caught instanceof RequestIdConflict
            ? t("plan.requestIdConflict")
            : t("common.errorGeneric"),
      );
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

  const archiveCurrentPlan = async () => {
    if (!plan) return;

    // Two taps, like the list and the profile delete: archiving is
    // forward-only and does not refund the free-plan slot.
    if (confirmingArchiveId !== plan.id) {
      setActionError(null);
      setNotice(null);
      setConfirmingArchiveId(plan.id);
      return;
    }

    setActionError(null);
    setNotice(null);

    try {
      await archivePlan.mutateAsync(plan.id);
      setConfirmingArchiveId(null);
      setNotice(t("plan.archived"));
    } catch (caught) {
      setConfirmingArchiveId(null);
      const detail =
        caught && typeof caught === "object" && "message" in caught
          ? String((caught as { message: unknown }).message)
          : "";
      setActionError(
        detail.includes("not_archivable") && i18n.exists("plan.notArchivable")
          ? t("plan.notArchivable")
          : t("common.errorGeneric"),
      );
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
      <DawnBackground
        className="items-center justify-center gap-5"
        accessibilityRole="progressbar"
        accessibilityLabel={t("plan.generating")}
      >
        <ResponsiveTabContent className="items-center gap-5">
          {/* El orbe y no un indicador de carga: esperar a que se escriba un plan
              de treinta dias es la espera mas larga del producto, y la marca
              respirando dice "esta pasando algo" mejor que una rueda. */}
          <Orb size={110} halo />
          <Text className="text-center font-sans-semibold text-xl text-plum">
            {t("plan.generating")}
          </Text>
          <Text className="text-center font-sans text-base text-mist-ink">
            {t("plan.generatingHint")}
          </Text>
        </ResponsiveTabContent>
      </DawnBackground>
    );
  }

  if (!plan || (plan.status === "failed" && !day) || (stuck && !day)) {
    // The limit branch used to live here reading `generate.error`, but this
    // screen never calls `generate` — it only navigates to the form — so it was
    // permanently unreachable. The limit is surfaced where it is actually
    // raised, in plan/nuevo.tsx.
    //
    // A crashed generation (`stuck`) is not the same as a failed one: it still
    // has a reservation, so continuing it costs no new quota. Only a genuinely
    // `failed` plan has to be started over — and starting over spends another
    // free slot, which the copy says out loud.
    const failed = plan?.status === "failed";
    const stalledWithoutDay = stuck && !day;

    return (
      <DawnBackground>
        <TabHeader title={t("tabs.today")} name={profile?.display_name} />
        <ResponsiveTabContent className="flex-1 gap-3 pb-10 pt-2">
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
            <Text className="text-center font-sans-bold text-2xl text-plum">
              {stalledWithoutDay
                ? t("plan.stalledTitle")
                : failed
                  ? t("plan.failedTitle")
                  : t("plan.noPlanTitle")}
            </Text>
            <Text className="text-center font-sans text-base leading-6 text-mist-ink">
              {stalledWithoutDay
                ? t("plan.stalledBody", {
                    written: progress?.days_written ?? 0,
                    total: plan?.duration_days ?? 0,
                  })
                : failed
                  ? t("plan.failedBody")
                  : t("plan.noPlanBody")}
            </Text>

            {actionError ? (
              <Text
                className="text-center font-sans text-sm text-danger"
                accessibilityRole="alert"
              >
                {actionError}
              </Text>
            ) : null}

            <View className="mt-6 w-full">
              {stalledWithoutDay ? (
                // A crashed first stretch resumes for free: continuing the plan
                // does not burn another slot.
                <Button
                  title={t("plan.stalledCta")}
                  loading={continuePlan.isPending}
                  onPress={() => void resumeGeneration()}
                />
              ) : (
                <Button
                  title={failed ? t("plan.createAnother") : t("plan.createCta")}
                  onPress={() => void startGeneration()}
                />
              )}
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
        </ResponsiveTabContent>
      </DawnBackground>
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
      <DawnBackground>
        <TabHeader title={t("tabs.today")} name={profile?.display_name} />
        <ScrollView contentContainerClassName="flex-grow py-14">
          <ResponsiveTabContent className="flex-grow">
            <View className="w-full flex-1 gap-3 self-center md:max-w-3xl">
              <PlanSwitcher
                plans={plans ?? []}
                activeId={plan.id}
                onSelect={selectPlan}
              />

              <View className="flex-1 items-center justify-center gap-3">
                <Text className="text-center font-sans-bold text-2xl text-plum">
                  {t("plan.finishedTitle")}
                </Text>
                <Text className="text-center font-serif text-base leading-6 text-plum">
                  {plan.title}
                </Text>

                {/* An honest count, not a congratulation. Someone who prayed 11 of 30
              days is told 11 of 30 — rounding that up would make the one screen
              that looks back the one screen that flatters. */}
                <Text className="mt-4 text-center font-sans text-base leading-6 text-mist-ink">
                  {t("plan.finishedDays", {
                    count: progress.days_prayed,
                    total: progress.days_total,
                  })}
                </Text>

                {progress.intercessions_received > 0 ? (
                  <Text className="text-center font-sans text-base leading-6 text-mist-ink">
                    {t("plan.finishedIntercessions", {
                      count: progress.intercessions_received,
                    })}
                  </Text>
                ) : null}
              </View>

              {actionError ? (
                <Text
                  className="text-center font-sans text-sm text-danger"
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
                  <Button
                    title={t("testimony.askAfterPlan")}
                    variant="secondary"
                  />
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
                {plan.status === "active" || plan.status === "completed" ? (
                  <>
                    <Button
                      title={
                        confirmingArchiveId === plan.id
                          ? t("plan.archiveConfirm")
                          : t("plan.archive")
                      }
                      variant="ghost"
                      loading={archivePlan.isPending}
                      onPress={() => void archiveCurrentPlan()}
                    />
                    <Text
                      className="text-center font-sans text-sm text-mist-ink"
                      accessibilityLiveRegion={
                        confirmingArchiveId === plan.id ? "polite" : "none"
                      }
                    >
                      {t("plan.archiveHint")}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          </ResponsiveTabContent>
        </ScrollView>
      </DawnBackground>
    );
  }

  return (
    <DawnBackground>
      <TabHeader title={t("tabs.today")} name={profile?.display_name} />
      <ScrollView
        contentContainerClassName="py-8"
        keyboardShouldPersistTaps="handled"
      >
        <ResponsiveTabContent className="gap-6">
          <PlanSwitcher
            plans={plans ?? []}
            activeId={plan.id}
            onSelect={selectPlan}
          />

          {/* El contexto del día es la portada oscura del prototipo. No inventa
            un tema: solo jerarquiza los datos que ya devuelve el plan. */}
          <CardDark className="gap-2">
            <Text className="font-sans-semibold text-sm text-white/80">
              {t("plan.dayOf", {
                current: day.day_number,
                total: plan.duration_days,
              })}
              {plan.status === "generating" && !stuck
                ? ` · ${t("plan.stillPreparing")}`
                : ""}
              {days > 0 ? ` · ${t("plan.streak", { count: days })}` : ""}
            </Text>

            <Text className="font-serif-bold text-3xl leading-10 text-white">
              {day.title}
            </Text>

            {draftTitle === null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("plan.rename")}
                onPress={() => setDraftTitle(plan.title)}
              >
                <Text className="font-sans text-base text-white">
                  {plan.title} ✎
                </Text>
              </Pressable>
            ) : null}
          </CardDark>

          {draftTitle !== null ? (
            <Glass readable className="gap-2 rounded-card p-5 shadow-card">
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
            </Glass>
          ) : null}

          {/* A generation whose first stretch landed and whose second crashed
            keeps the written days and offers to continue instead of restarting. */}
          {stuck ? (
            <Card className="gap-2">
              <Text className="font-sans text-sm leading-5 text-mist-ink">
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
            </Card>
          ) : null}

          <View className="gap-6 md:flex-row md:items-start">
            {/* La lectura larga sigue siendo una sola columna incluso en tablet. */}
            <View className="gap-6 md:min-w-0 md:max-w-3xl md:flex-1">
              <DayView day={day} books={books ?? []} />

              <View className="pb-2 pt-2">
                {prayed ? (
                  // El orbe con la marca, como en el montaje. Es el único momento
                  // del día en que la app dice "hecho", y decirlo con una línea de
                  // texto centrada era desaprovecharlo.
                  <View className="items-center gap-3">
                    <Orb size={92} halo>
                      <Check size={30} color="#413653" strokeWidth={2} />
                    </Orb>
                    <Text className="text-center font-sans-medium text-base text-plum">
                      {t("plan.markedDone")}
                    </Text>
                  </View>
                ) : (
                  <Button
                    title={t("plan.markDone")}
                    loading={markPrayed.isPending}
                    onPress={() =>
                      markPrayed.mutate(undefined, {
                        onSuccess: () => setActionError(null),
                        onError: () => setActionError(t("common.errorGeneric")),
                      })
                    }
                  />
                )}
              </View>

              {actionError ? (
                <Text
                  className="text-center font-sans text-sm text-danger"
                  accessibilityRole="alert"
                >
                  {actionError}
                </Text>
              ) : null}
            </View>

            {/* En tablet solo el contexto y las acciones secundarias pasan a la
              columna lateral; la oración nunca se estrecha en dos columnas. */}
            <View className="gap-5 md:w-56">
              <Glass readable className="gap-3 rounded-card p-5 shadow-card">
                {/* Only offered once there is a yesterday to go back to. */}
                {day.day_number > 1 ? (
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
                ) : null}

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

                {plan.status === "active" || plan.status === "completed" ? (
                  <>
                    <Button
                      title={
                        confirmingArchiveId === plan.id
                          ? t("plan.archiveConfirm")
                          : t("plan.archive")
                      }
                      variant="ghost"
                      loading={archivePlan.isPending}
                      onPress={() => void archiveCurrentPlan()}
                    />
                    <Text
                      className="font-sans text-sm leading-5 text-mist-ink"
                      accessibilityLiveRegion={
                        confirmingArchiveId === plan.id ? "polite" : "none"
                      }
                    >
                      {t("plan.archiveHint")}
                    </Text>
                  </>
                ) : null}
              </Glass>

              {/* Seeing who showed up for you is the reason to come back
                tomorrow, but it stays visually separate from private prayer. */}
              <DaySection label={t("intercession.whoPrayed")}>
                {prayedForMeFailed ? (
                  <Text
                    className="font-sans text-base leading-6 text-mist-ink"
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

                {socialActionError ? (
                  <Text
                    className="font-sans text-sm text-danger"
                    accessibilityRole="alert"
                  >
                    {socialActionError}
                  </Text>
                ) : null}

                {notice ? (
                  <Text
                    className="font-sans text-sm text-mist-ink"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {notice}
                  </Text>
                ) : null}
              </DaySection>

              {/* "Pray for their plan" needs a real shared plan to target. */}
              {prayBackPlanId ? (
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
              ) : null}
            </View>
          </View>
        </ResponsiveTabContent>
      </ScrollView>
    </DawnBackground>
  );
}
