import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { Glass } from "@/components/Glass";
import { AfterPrayed } from "@/components/hoy/AfterPrayed";
import { FloatingCta } from "@/components/hoy/FloatingCta";
import { JourneyMetaRow } from "@/components/hoy/JourneyMetaRow";
import { JourneySteps, type JourneyStep } from "@/components/hoy/JourneySteps";
import { PrayedDone } from "@/components/hoy/PrayedDone";
import { StalledNotice } from "@/components/hoy/StalledNotice";
import { TodayEmpty } from "@/components/hoy/TodayEmpty";
import { TodayFinished } from "@/components/hoy/TodayFinished";
import { TodayGenerating } from "@/components/hoy/TodayGenerating";
import { useFloatingCta } from "@/components/hoy/useFloatingCta";
import { useTodayActions } from "@/components/hoy/useTodayActions";
import { PlanOptionsSheet } from "@/components/PlanOptionsSheet";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TabHeader } from "@/components/TabHeader";
import { Txt } from "@/components/ui/Text";
import { VerseOfTheDay } from "@/components/VerseOfTheDay";
import { useUserId } from "@/core/auth/useUserId";
import { useBibleBooks } from "@/core/bible/queries";
import { canArchivePlan, todayScreen } from "@/core/plans/todayView";
import { useTodayIntercessions } from "@/core/plans/useTodayIntercessions";
import { useTodayPlan } from "@/core/plans/useTodayPlan";
import { liveStreak, useProfile, useStreak } from "@/core/profile/queries";

// Si esta pestaña revienta, las demás y la barra siguen en pie.
export { AppErrorBoundary as ErrorBoundary } from "@/components/AppErrorBoundary";

/**
 * Hoy. La pantalla solo compone: qué cara toca lo decide `todayScreen`
 * (core/plans/todayView.ts), los datos salen de `useTodayPlan` y
 * `useTodayIntercessions`, las acciones de `useTodayActions`, y cada sección
 * vive en components/hoy/.
 */
export default function Today() {
  const { t } = useTranslation();
  const userId = useUserId();

  const { plans, plansQuery, plan, day, dayQuery, prayed, progress, stuck } =
    useTodayPlan(userId);
  const { data: streak } = useStreak(userId);
  const { data: profile } = useProfile(userId);
  const { prayedForMe, prayedForMeFailed, prayBackPlanId } =
    useTodayIntercessions(userId);
  const { data: books } = useBibleBooks();

  const actions = useTodayActions({ userId, plan, day });

  // El paso del journey que se está leyendo. Empieza por el significado:
  // entender el texto va antes de hacer algo con él y de rezarlo. Vive aquí
  // y no en `JourneySteps` para sobrevivir a un «cargando» de paso.
  const [step, setStep] = useState<JourneyStep>("meaning");

  // «Ya oré hoy» siempre a la vista (components/hoy/useFloatingCta.ts).
  const { viewportRef, ctaRef, checkCta, floatingCta } = useFloatingCta(prayed);

  const days = liveStreak(streak);

  const screen = todayScreen({
    plansLoading: plansQuery.isLoading,
    plansFailed: plansQuery.isLoadingError,
    plan,
    hasDay: Boolean(day),
    dayPending: dayQuery.isPending,
    stuck,
    finished: Boolean(progress?.finished),
  });

  if (screen.kind === "loading") {
    return <LoadingState skeleton="day" />;
  }

  if (screen.kind === "plansError") {
    return (
      <ErrorState
        error={plansQuery.error}
        onRetry={() => void plansQuery.refetch()}
      />
    );
  }

  if (screen.kind === "generating") {
    return <TodayGenerating />;
  }

  if (screen.kind === "empty") {
    return (
      <TodayEmpty
        reason={screen.reason}
        profileName={profile?.display_name}
        plans={plans ?? []}
        plan={plan}
        daysWritten={progress?.days_written ?? 0}
        actionError={actions.actionError}
        resumePending={actions.resumePending}
        onSelectPlan={actions.selectPlan}
        onResume={() => void actions.resumeGeneration()}
        onCreate={() => void actions.startGeneration()}
      />
    );
  }

  // `todayScreen` ya descartó «sin plan» y «sin día» arriba; `!plan || !day`
  // solo se lo recuerda a TypeScript, que no lo sigue hasta allí.
  if (screen.kind === "dayError" || !plan || !day) {
    return (
      <ErrorState
        error={dayQuery.error}
        onRetry={() => void dayQuery.refetch()}
      />
    );
  }

  if (screen.kind === "finished" && progress) {
    return (
      <TodayFinished
        profileName={profile?.display_name}
        plans={plans ?? []}
        plan={plan}
        progress={progress}
        actionError={actions.actionError}
        confirmingArchive={actions.confirmingArchive}
        archivePending={actions.archivePending}
        onSelectPlan={actions.selectPlan}
        onStartNew={() => void actions.startGeneration()}
        onArchive={() => void actions.archiveCurrentPlan()}
      />
    );
  }

  const markDone = (
    <Button
      title={t("plan.markDone")}
      loading={actions.markPending}
      onPress={actions.markToday}
    />
  );

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
      <View ref={viewportRef} onLayout={checkCta} className="flex-1">
        <ScrollView
          contentContainerClassName="py-8"
          keyboardShouldPersistTaps="handled"
          onScroll={checkCta}
          scrollEventThrottle={100}
        >
          <ResponsiveTabContent className="gap-6 lg:max-w-page">
            {/* El journey es una sola columna de lectura también en tablet; en
            escritorio ancho gana una columna de contexto al lado. Lo que
            rodeaba al día vive en el cajón del `···`. */}
            <View className="w-full gap-6 self-center md:max-w-3xl lg:max-w-none lg:flex-row lg:items-start lg:gap-10">
              <View className="min-w-0 flex-1 gap-6 lg:max-w-read">
                <JourneyMetaRow
                  streakDays={days}
                  prayed={prayed}
                  dayNumber={day.day_number}
                  durationDays={plan.duration_days}
                  stillPreparing={plan.status === "generating" && !stuck}
                  onOpenOptions={actions.openOptions}
                />

                {stuck ? (
                  <StalledNotice
                    written={progress?.days_written ?? day.day_number}
                    total={plan.duration_days}
                    pending={actions.resumePending}
                    onResume={() => void actions.resumeGeneration()}
                  />
                ) : null}

                {/* El título es el del día y no el del plan con lápiz: hoy se ora
              esto. Renombrar el plan vive en el cajón, fuera del journey. */}
                <Txt variant="title">{day.title}</Txt>

                <JourneySteps
                  step={step}
                  onStepChange={setStep}
                  day={day}
                  books={books ?? []}
                />

                {/* La única acción primaria del journey. Mientras flota su
              gemelo, el lector de pantalla ve solo el gemelo: dos «Ya oré
              hoy» a la vez era uno de más. */}
                <View
                  ref={ctaRef}
                  onLayout={checkCta}
                  className="pb-2 pt-2"
                  accessibilityElementsHidden={floatingCta}
                  importantForAccessibility={
                    floatingCta ? "no-hide-descendants" : "auto"
                  }
                  aria-hidden={floatingCta}
                >
                  {prayed ? <PrayedDone /> : markDone}
                </View>

                {/* Con el gemelo flotando, el error sale junto a él: aquí
                quedaba bajo el pliegue, pegado a un botón que no se veía. */}
                {actions.actionError && !floatingCta ? (
                  <Txt
                    variant="caption"
                    tone="danger"
                    className="text-center"
                    accessibilityRole="alert"
                  >
                    {actions.actionError}
                  </Txt>
                ) : null}

                {prayed === true ? (
                  <AfterPrayed
                    planId={plan.id}
                    prayedForMe={prayedForMe}
                    prayedForMeFailed={prayedForMeFailed}
                    prayBackPlanId={prayBackPlanId}
                    onReport={(intercessionId) =>
                      void actions.reportIntercession(intercessionId)
                    }
                    onBlock={(blockedId) =>
                      void actions.blockIntercessor(blockedId)
                    }
                  />
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

        {/* El gemelo flotante de «Ya oré hoy» (ver useFloatingCta). */}
        {floatingCta ? (
          <FloatingCta>
            {actions.actionError ? (
              <Glass flat readable className="rounded-card px-4 py-2">
                <Txt
                  variant="caption"
                  tone="danger"
                  className="text-center"
                  accessibilityRole="alert"
                >
                  {actions.actionError}
                </Txt>
              </Glass>
            ) : null}
            {markDone}
          </FloatingCta>
        ) : null}
      </View>

      {/* El cajón del plan: todo lo que se quitó del journey sigue a un toque,
        en la hoja que abre el `···` de la fila meta. */}
      <PlanOptionsSheet
        visible={actions.optionsOpen}
        onClose={actions.closeOptions}
        planTitle={plan.title}
        plans={plans ?? []}
        activePlanId={plan.id}
        onSelectPlan={(planId) => void actions.selectPlanFromSheet(planId)}
        draftTitle={actions.draftTitle}
        onDraftTitleChange={actions.setDraftTitle}
        onSaveTitle={() => void actions.saveTitle()}
        renamePending={actions.renamePending}
        showSeeDays={day.day_number > 1}
        onSeeDays={() =>
          actions.closeOptionsThen(() =>
            router.push({
              pathname: "/plan/[id]/dias",
              params: { id: plan.id },
            }),
          )
        }
        onShare={() =>
          actions.closeOptionsThen(() =>
            router.push({
              pathname: "/plan/[id]/compartir",
              params: { id: plan.id },
            }),
          )
        }
        canArchive={canArchivePlan(plan.status)}
        confirmingArchive={actions.confirmingArchive}
        archivePending={actions.archivePending}
        onArchive={() => void actions.archiveCurrentPlan()}
        error={actions.actionError}
        onClosed={actions.onOptionsClosed}
      />
    </DawnBackground>
  );
}
