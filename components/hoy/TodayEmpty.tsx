import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { TabHeader } from "@/components/TabHeader";
import { VerseOfTheDay } from "@/components/VerseOfTheDay";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";
import type { OwnPlan } from "@/core/plans/queries";
import { emptyCopyKeys, type TodayEmptyReason } from "@/core/plans/todayView";

/**
 * Hoy sin día que orar: sin plan, con el plan fallido o con la generación
 * muerta antes del primer día.
 *
 * The limit branch used to live here reading `generate.error`, but this
 * screen never calls `generate` — it only navigates to the form — so it was
 * permanently unreachable. The limit is surfaced where it is actually raised,
 * in plan/nuevo.tsx.
 *
 * A crashed generation (`stalled`) is not the same as a failed one: it still
 * has a reservation, so continuing it costs no new quota. Only a genuinely
 * `failed` plan has to be started over — and starting over spends another
 * free slot, which the copy says out loud.
 */
export const TodayEmpty = ({
  reason,
  profileName,
  plans,
  plan,
  daysWritten,
  actionError,
  resumePending,
  onSelectPlan,
  onResume,
  onCreate,
}: {
  reason: TodayEmptyReason;
  profileName: string | undefined;
  plans: OwnPlan[];
  plan: OwnPlan | null;
  daysWritten: number;
  actionError: string | null;
  resumePending: boolean;
  onSelectPlan: (planId: string) => void;
  onResume: () => void;
  onCreate: () => void;
}) => {
  const { t } = useTranslation();
  const copy = emptyCopyKeys(reason);

  return (
    <DawnBackground>
      <TabHeader title={t("tabs.today")} name={profileName} showDate />
      <ResponsiveTabContent className="flex-1 gap-3 pb-10 pt-2">
        {/* A failed plan can be the newest one, and without a way off this
            screen the plans that do work become unreachable. */}
        {plan ? (
          <PlanSwitcher
            plans={plans}
            activeId={plan.id}
            onSelect={onSelectPlan}
          />
        ) : null}

        {/* El vacío del sistema, con el orbe: antes era texto centrado a
            mano, la única pantalla vacía que no hablaba como las demás. */}
        <View className="flex-1 items-center justify-center">
          <EmptyState
            title={t(copy.title)}
            body={
              reason === "stalled"
                ? t(copy.body, {
                    written: daysWritten,
                    total: plan?.duration_days ?? 0,
                  })
                : t(copy.body)
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

            {reason === "stalled" ? (
              // A crashed first stretch resumes for free: continuing the plan
              // does not burn another slot.
              <Button
                title={t(copy.cta)}
                loading={resumePending}
                onPress={onResume}
              />
            ) : (
              <Button title={t(copy.cta)} onPress={onCreate} />
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
};
