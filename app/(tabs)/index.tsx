import { Link, router } from "expo-router";
import { Check, MoreHorizontal } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";

import { TabHeader } from "@/components/TabHeader";
import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { DaySection } from "@/components/DaySection";
import { DayView } from "@/components/DayView";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlanOptionsSheet } from "@/components/PlanOptionsSheet";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { Orb } from "@/components/Orb";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { VerseOfTheDay } from "@/components/VerseOfTheDay";
import { Txt } from "@/components/ui/Text";
import { ErrorState, LoadingState } from "@/components/ScreenState";
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

import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StreakRing } from "@/components/StreakRing";
import { Tap, triggerHaptic } from "@/components/ui/Tap";
import { useToast } from "@/core/toast/ToastProvider";
import { icon, useThemeColors } from "@/theme";
import { enterCelebrate, enterFade } from "@/theme/motion";

// Los tres pasos del journey diario. La Palabra no está aquí: no es un paso,
// es la puerta, y por eso se queda siempre encima de la parte elegida.
const JOURNEY_STEPS = [
  { key: "meaning", labelKey: "plan.stepReflect" },
  { key: "action", labelKey: "plan.stepApply" },
  { key: "prayer", labelKey: "plan.stepPray" },
] as const;

type JourneyStep = (typeof JOURNEY_STEPS)[number]["key"];

// Si esta pestaña revienta, las demás y la barra siguen en pie.
export { AppErrorBoundary as ErrorBoundary } from "@/components/AppErrorBoundary";

export default function Today() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: plans,
    isLoading,
    isError,
    error: plansError,
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
  const {
    data: day,
    error: dayError,
    refetch: refetchDay,
    isPending: dayPending,
  } = useTodayDay(
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
  // Resultados de acción por el toast del sistema; el error de generación
  // (actionError) sí se queda inline, pegado a su CTA de reintento.
  const toast = useToast();
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(
    null,
  );
  // El paso del journey que se está leyendo. Empieza por el significado:
  // entender el texto va antes de hacer algo con él y de rezarlo.
  const [step, setStep] = useState<JourneyStep>("meaning");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const afterClose = useRef<(() => void) | null>(null);

  // Al cerrar el cajón se desarma lo efímero: ni el archivar queda a un toque
  // de dispararse ni el rename abierto, para que la próxima apertura empiece
  // de cero.
  const closeOptions = () => {
    setOptionsOpen(false);
    setConfirmingArchiveId(null);
    setDraftTitle(null);
  };

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
    try {
      await action();
      toast.success(done);
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };

  const resumeGeneration = async () => {
    if (!plan) return;

    setActionError(null);
    try {
      await continuePlan.mutateAsync(plan.id);
      toast.success(t("plan.resumed"));
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

  // Cambiar de plan desde el cajón lo cierra: la pantalla que aparece debajo
  // ya es del plan nuevo, y dejar el sheet encima sería enseñar el anterior.
  const selectPlanFromSheet = async (planId: string) => {
    setOptionsOpen(false);
    await selectPlan(planId);
  };

  const archiveCurrentPlan = async () => {
    if (!plan) return;

    // Two taps, like the list and the profile delete: archiving is
    // forward-only and does not refund the free-plan slot.
    if (confirmingArchiveId !== plan.id) {
      setActionError(null);
      setConfirmingArchiveId(plan.id);
      return;
    }

    setActionError(null);
    try {
      await archivePlan.mutateAsync(plan.id);
      setConfirmingArchiveId(null);
      // El plan archivado desaparece de la lista al refrescar: el sheet se
      // quedaría abierto sobre un plan que ya no está. Se cierra con él.
      setOptionsOpen(false);
      toast.success(t("plan.archived"));
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
    return <LoadingState skeleton="day" />;
  }

  if (isError) {
    return <ErrorState error={plansError} onRetry={() => void refetchPlan()} />;
  }

  // Plans and progress can settle before today's day. `stuck && !day` used to
  // mean "generation died before the first day", but with the seed (active,
  // 4/14 days, stale heartbeat) it was also true for a few frames while
  // `get_my_day` was still in flight — a flash of the stalled empty screen.
  if (plan && !day && dayPending) {
    return <LoadingState skeleton="day" />;
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
          <Orb size={110} halo variant="working" />
          <Txt variant="subheadingLg" className="text-center text-xl">
            {t("plan.generating")}
          </Txt>
          <Txt variant="body" tone="secondary" className="text-center">
            {t("plan.generatingHint")}
          </Txt>
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
        <TabHeader
          title={t("tabs.today")}
          name={profile?.display_name}
          showDate
        />
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

          {/* El vacío del sistema, con el orbe: antes era texto centrado a
            mano, la única pantalla vacía que no hablaba como las demás. */}
          <View className="flex-1 items-center justify-center">
            <EmptyState
              title={
                stalledWithoutDay
                  ? t("plan.stalledTitle")
                  : failed
                    ? t("plan.failedTitle")
                    : t("plan.noPlanTitle")
              }
              body={
                stalledWithoutDay
                  ? t("plan.stalledBody", {
                      written: progress?.days_written ?? 0,
                      total: plan?.duration_days ?? 0,
                    })
                  : failed
                    ? t("plan.failedBody")
                    : t("plan.noPlanBody")
              }
            >
              {actionError ? (
                <Txt
                  variant="caption"
                  tone="danger"
                  className="pb-3 text-center"
                  accessibilityRole="alert"
                >
                  {actionError}
                </Txt>
              ) : null}

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
            </EmptyState>
          </View>

          {/* Un motivo para volver mañana aunque todavía no haya plan. Esta
            pantalla era un botón y nada más: quien no genera el plan hoy no
            tenía absolutamente nada que hacer aquí. */}
          <VerseOfTheDay />
        </ResponsiveTabContent>
      </DawnBackground>
    );
  }

  // The plan is active but no day has come back after the query settled.
  // Pending is handled above: reaching here means get_my_day finished empty.
  if (!day) {
    return <ErrorState error={dayError} onRetry={() => void refetchDay()} />;
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
        <TabHeader
          title={t("tabs.today")}
          name={profile?.display_name}
          showDate
        />
        <ScrollView contentContainerClassName="flex-grow py-14">
          <ResponsiveTabContent className="flex-grow">
            <View className="w-full flex-1 gap-3 self-center md:max-w-3xl">
              <PlanSwitcher
                plans={plans ?? []}
                activeId={plan.id}
                onSelect={selectPlan}
              />

              <View className="flex-1 items-center justify-center gap-3">
                <Txt variant="headingLg" className="text-center">
                  {t("plan.finishedTitle")}
                </Txt>
                <Txt variant="bodySerif" className="text-center">
                  {plan.title}
                </Txt>

                {/* An honest count, not a congratulation. Someone who prayed 11 of 30
              days is told 11 of 30 — rounding that up would make the one screen
              that looks back the one screen that flatters. */}
                <Txt
                  variant="body"
                  tone="secondary"
                  className="mt-4 text-center"
                >
                  {t("plan.finishedDays", {
                    count: progress.days_prayed,
                    total: progress.days_total,
                  })}
                </Txt>

                {progress.intercessions_received > 0 ? (
                  <Txt variant="body" tone="secondary" className="text-center">
                    {t("plan.finishedIntercessions", {
                      count: progress.intercessions_received,
                    })}
                  </Txt>
                ) : null}
              </View>

              {actionError ? (
                <Txt
                  variant="caption"
                  tone="danger"
                  className="text-center"
                  accessibilityRole="alert"
                >
                  {actionError}
                </Txt>
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
                    <Txt
                      variant="caption"
                      className="text-center"
                      accessibilityLiveRegion={
                        confirmingArchiveId === plan.id ? "polite" : "none"
                      }
                    >
                      {t("plan.archiveHint")}
                    </Txt>
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
      {/* `wide`: el contenido de abajo se abre a `max-w-page` en lg y la
          cabecera lo acompaña — si no, quedaba 240 px hacia dentro. */}
      <TabHeader
        title={t("tabs.today")}
        name={profile?.display_name}
        showDate
        wide
      />
      <ScrollView
        contentContainerClassName="py-8"
        keyboardShouldPersistTaps="handled"
      >
        <ResponsiveTabContent className="gap-6 lg:max-w-page">
          {/* El journey es una sola columna de lectura también en tablet; en
            escritorio ancho gana una columna de contexto al lado. Lo que
            rodeaba al día vive en el cajón del `···`. */}
          <View className="w-full gap-6 self-center md:max-w-3xl lg:max-w-none lg:flex-row lg:items-start lg:gap-10">
            <View className="min-w-0 flex-1 gap-6 lg:max-w-read">
              {/* La fila meta: dónde estás y cuánto llevas. A la derecha, el
              `···` que abre el cajón del plan. */}
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  {days > 0 ? (
                    <StreakRing
                      days={days}
                      accessibilityLabel={t("plan.streak", { count: days })}
                    />
                  ) : null}
                  <View className="min-w-0 flex-1 gap-1">
                    <Txt variant="overline">
                      {prayed
                        ? t("plan.captionDone")
                        : day.day_number > 1
                          ? t("plan.captionContinue")
                          : t("plan.captionComingUp")}
                    </Txt>
                    <Txt variant="label" tone="secondary">
                      {t("plan.dayOf", {
                        current: day.day_number,
                        total: plan.duration_days,
                      })}
                      {plan.status === "generating" && !stuck
                        ? ` · ${t("plan.stillPreparing")}`
                        : ""}
                    </Txt>
                    {progress && progress.days_total > 0 ? (
                      <ProgressBar
                        value={progress.days_prayed}
                        max={progress.days_total}
                        accessibilityLabel={t(
                          "plan.progressDaysAccessibility",
                          {
                            prayed: progress.days_prayed,
                            total: progress.days_total,
                          },
                        )}
                      />
                    ) : null}
                  </View>
                </View>

                <Tap
                  accessibilityRole="button"
                  accessibilityLabel={t("plan.planOptions")}
                  onPress={() => setOptionsOpen(true)}
                  // 44×44, el mínimo táctil, alrededor de un icono de 22. El
                  // vidrio es el mismo de los chips sin elegir: sin él el icono
                  // flotaba como una mancha gris sobre el amanecer.
                  className="h-11 w-11 items-center justify-center rounded-full border border-glassedge/60 bg-glass/60"
                >
                  <MoreHorizontal
                    size={icon.md}
                    color={colors.plum.DEFAULT}
                    strokeWidth={icon.strokeWidth}
                  />
                </Tap>
              </View>

              {/* El aviso de generación a medias es verdad, pero no puede
              sentarse entre la Palabra y el amén: vive aquí, debajo de la
              fila meta y antes del título, para que el journey quede libre
              para rezar. Una línea discreta y no un Card: quien ya tiene día
              hoy viene a orar, no a arreglar la generación. */}
              {stuck ? (
                <View className="gap-1.5">
                  <Txt variant="caption">
                    {t("plan.stalledBody", {
                      written: progress?.days_written ?? day.day_number,
                      total: plan.duration_days,
                    })}
                  </Txt>
                  <Tap
                    accessibilityRole="button"
                    accessibilityState={{ busy: continuePlan.isPending }}
                    aria-busy={continuePlan.isPending}
                    disabled={continuePlan.isPending}
                    hitSlop={8}
                    onPress={() => void resumeGeneration()}
                    className={`self-start py-1 ${
                      continuePlan.isPending ? "opacity-50" : ""
                    }`}
                  >
                    {/* El mismo tono que el label del Button ghost: el naranja
                    que sí se lee, reservado para lo que pide acción. */}
                    <Txt
                      variant="label"
                      tone="accent"
                      className="font-sans-semibold"
                    >
                      {t("plan.stalledCta")}
                    </Txt>
                  </Tap>
                </View>
              ) : null}

              {/* El título es el del día y no el del plan con lápiz: hoy se ora
              esto. Renombrar el plan vive en el cajón, fuera del journey. */}
              <Txt variant="title">{day.title}</Txt>

              {/* Los tres pasos del journey, con la misma píldora que usa el
              switcher: la elegida oscura, las otras de vidrio. */}
              <View accessibilityRole="tablist" className="flex-row gap-2">
                {JOURNEY_STEPS.map((journeyStep) => {
                  const selected = step === journeyStep.key;

                  return (
                    <Pill
                      key={journeyStep.key}
                      label={t(journeyStep.labelKey)}
                      selected={selected}
                      role="tab"
                      onPress={() => setStep(journeyStep.key)}
                    />
                  );
                })}
              </View>

              {/* El `key` remonta el contenido al cambiar de chip: el paso
              elegido entra con un fade en vez de aparecer de golpe. */}
              <Animated.View key={step} entering={enterFade}>
                <DayView day={day} books={books ?? []} focus={step} />
              </Animated.View>

              {/* La única acción primaria del journey. */}
              <View className="pb-2 pt-2">
                {prayed ? (
                  // El orbe con la marca, como en el montaje. Es el único momento
                  // del día en que la app dice "hecho", y decirlo con una línea de
                  // texto centrada era desaprovecharlo. Entra con un pequeño
                  // estallido de muelle — la celebración, junto con la háptica de
                  // éxito. Sin confetti: no es el tono de esta app.
                  <Animated.View
                    entering={enterCelebrate}
                    className="items-center gap-3"
                  >
                    <Orb size={92} halo variant="burst">
                      <Check
                        size={icon.lg}
                        color={colors.plum.DEFAULT}
                        strokeWidth={icon.strokeWidth}
                      />
                    </Orb>
                    <Txt variant="bodyMedium" className="text-center">
                      {t("plan.markedDone")}
                    </Txt>
                    <Txt variant="caption" className="text-center">
                      {t("plan.seeYouTomorrow")}
                    </Txt>
                  </Animated.View>
                ) : (
                  <Button
                    title={t("plan.markDone")}
                    loading={markPrayed.isPending}
                    onPress={() =>
                      markPrayed.mutate(undefined, {
                        onSuccess: () => {
                          setActionError(null);
                          // La háptica de resultado, no la del toque: el amén del
                          // día es el único "hecho" que la app celebra.
                          triggerHaptic("success");
                        },
                        onError: () => setActionError(t("common.errorGeneric")),
                      })
                    }
                  />
                )}
              </View>

              {actionError ? (
                <Txt
                  variant="caption"
                  tone="danger"
                  className="text-center"
                  accessibilityRole="alert"
                >
                  {actionError}
                </Txt>
              ) : null}

              {/* Lo social espera al "hecho": primero lo íntimo, después la
              comunidad. Antes vivía siempre visible en la columna lateral y le
              quitaba al CTA su momento. */}
              {prayed === true ? (
                <>
                  {/* Seeing who showed up for you is the reason to come back
                  tomorrow, but it stays visually separate from private prayer. */}
                  <DaySection label={t("intercession.whoPrayed")}>
                    {prayedForMeFailed ? (
                      <Txt
                        variant="body"
                        tone="secondary"
                        accessibilityRole="alert"
                      >
                        {t("common.errorBody")}
                      </Txt>
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
                </>
              ) : null}

              {/* En móvil el versículo no tiene columna lateral: va al pie,
                como "una palabra quieta", no encima del journey. */}
              <View className="lg:hidden">
                <VerseOfTheDay />
              </View>
            </View>

            {/* La columna de contexto del escritorio: el versículo del día
              acompaña al journey sin robarle su medida de lectura. */}
            <View className="hidden gap-6 lg:flex lg:w-80">
              <VerseOfTheDay />
            </View>
          </View>
        </ResponsiveTabContent>
      </ScrollView>

      {/* El cajón del plan: todo lo que se quitó del journey sigue a un toque,
        en la hoja que abre el `···` de la fila meta. */}
      <PlanOptionsSheet
        visible={optionsOpen}
        onClose={closeOptions}
        planTitle={plan.title}
        plans={plans ?? []}
        activePlanId={plan.id}
        onSelectPlan={(planId) => void selectPlanFromSheet(planId)}
        draftTitle={draftTitle}
        onDraftTitleChange={setDraftTitle}
        onSaveTitle={() => void saveTitle()}
        renamePending={rename.isPending}
        showSeeDays={day.day_number > 1}
        onSeeDays={() => {
          afterClose.current = () =>
            router.push({
              pathname: "/plan/[id]/dias",
              params: { id: plan.id },
            });
          setOptionsOpen(false);
        }}
        onShare={() => {
          afterClose.current = () =>
            router.push({
              pathname: "/plan/[id]/compartir",
              params: { id: plan.id },
            });
          setOptionsOpen(false);
        }}
        canArchive={plan.status === "active" || plan.status === "completed"}
        confirmingArchive={confirmingArchiveId === plan.id}
        archivePending={archivePlan.isPending}
        onArchive={() => void archiveCurrentPlan()}
        error={actionError}
        onClosed={() => {
          const next = afterClose.current;
          afterClose.current = null;
          next?.();
        }}
      />
    </DawnBackground>
  );
}
