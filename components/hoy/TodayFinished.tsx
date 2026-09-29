import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { TabHeader } from "@/components/TabHeader";
import { Txt } from "@/components/ui/Text";
import type { OwnPlan, PlanProgress } from "@/core/plans/queries";
import { canArchivePlan } from "@/core/plans/todayView";

/**
 * The day a plan ends.
 *
 * Without this screen Hoy simply kept showing the last day: get_my_day clamps
 * to the newest unlocked one, usePrayedToday counts that day's log whenever it
 * happened, so every morning after the plan was over it said "Oraste hoy 🙏"
 * and offered nothing — while the streak quietly fell to zero because nothing
 * was left to insert. It is also the moment with the most intention in the
 * whole product, and it was being spent on a frozen screen.
 */
export const TodayFinished = ({
  profileName,
  plans,
  plan,
  progress,
  actionError,
  confirmingArchive,
  archivePending,
  onSelectPlan,
  onStartNew,
  onArchive,
}: {
  profileName: string | undefined;
  plans: OwnPlan[];
  plan: OwnPlan;
  progress: PlanProgress;
  actionError: string | null;
  confirmingArchive: boolean;
  archivePending: boolean;
  onSelectPlan: (planId: string) => void;
  onStartNew: () => void;
  onArchive: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <DawnBackground>
      <TabHeader title={t("tabs.today")} name={profileName} showDate />
      <ScrollView contentContainerClassName="flex-grow py-14">
        <ResponsiveTabContent className="flex-grow">
          <View className="w-full flex-1 gap-3 self-center md:max-w-3xl">
            <PlanSwitcher
              plans={plans}
              activeId={plan.id}
              onSelect={onSelectPlan}
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
              <Txt variant="body" tone="secondary" className="mt-4 text-center">
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

              <Button title={t("plan.finishedCta")} onPress={onStartNew} />

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
              {canArchivePlan(plan.status) ? (
                <>
                  <Button
                    title={
                      confirmingArchive
                        ? t("plan.archiveConfirm")
                        : t("plan.archive")
                    }
                    variant="ghost"
                    loading={archivePending}
                    onPress={onArchive}
                  />
                  <Txt
                    variant="caption"
                    className="text-center"
                    accessibilityLiveRegion={
                      confirmingArchive ? "polite" : "none"
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
};
