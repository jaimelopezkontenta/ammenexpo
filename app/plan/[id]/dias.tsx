import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { Glass } from "@/components/Glass";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";
import { usePlanDays } from "@/core/plans/queries";
import { usePlanSummary } from "@/core/plans/sharing";

import { Tap } from "@/components/ui/Tap";

/**
 * Every day you have reached, so yesterday's prayer is not gone.
 *
 * A thirty-day plan used to show only the latest unlocked day: skip one and it
 * was unreachable, and the prayer that helped could never be reread.
 */
export default function PlanDays() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: plan } = usePlanSummary(id);
  const {
    data: days,
    isLoading,
    isError,
    error,
    refetch,
  } = usePlanDays(id, plan?.status === "generating");

  if (isLoading) {
    return <ScreenScaffold title={t("plan.days")} loading />;
  }

  if (isError) {
    return (
      <ScreenScaffold
        title={t("plan.days")}
        error
        cause={error}
        onRetry={() => void refetch()}
      />
    );
  }

  // Del día 1 hacia adelante, como se recorre un plan. La consulta llegaba en
  // orden inverso y el día 14 bloqueado abría la lista: para releer lo de ayer
  // había que scrollear catorce tarjetas.
  const ordered = [...(days ?? [])].sort((a, b) => a.day_number - b.day_number);
  // El día por el que vas: el último desbloqueado (el de hoy).
  const current = [...ordered].reverse().find((day) => day.unlocked);
  // Se llega aquí desde Orar con cualquier plan propio, también uno que aún se
  // está escribiendo o que falló: sin días, la lista diría «0 días que ya has
  // recorrido» y nada más.
  const generating = plan?.status === "generating";

  return (
    <ScreenScaffold
      title={plan?.title ?? t("plan.days")}
      contentClassName="gap-3"
    >
      {ordered.length === 0 ? (
        <EmptyState
          title={
            generating
              ? t("plan.generating")
              : plan?.status === "failed"
                ? t("plan.failedTitle")
                : t("plan.daysEmpty")
          }
          body={generating ? t("plan.generatingHint") : undefined}
        />
      ) : (
        <Txt variant="caption">
          {t("plan.daysHint", {
            count: ordered.filter((day) => day.unlocked).length,
          })}
        </Txt>
      )}

      {current ? (
        <Button
          title={t("plan.continueDay", { number: current.day_number })}
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/plan/[id]/dia/[numero]",
              params: { id: id!, numero: String(current.day_number) },
            })
          }
        />
      ) : null}

      {/* Compartir vive aquí y en el cajón de Hoy: la fila de Orar abre el
      plan, y con tres planes el que quieres compartir no es siempre el activo
      de Hoy. Un botón quieto, no otro CTA: lo primario es seguir orando. */}
      <Button
        title={t("share.open")}
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: "/plan/[id]/compartir",
            params: { id: id! },
          })
        }
      />

      {ordered.map((day) => {
        // The days still to come. `plan.locked` — "Este día se abre el
        // {{date}}" — has been translated in both languages since the first
        // week with nothing rendering it, and without them a thirty-day plan
        // ended at today and gave no sign there was any road left.
        if (!day.unlocked) {
          return (
            <View
              key={day.day_number}
              className="gap-1 rounded-card border border-dashed border-glassedge/60 p-5"
            >
              <Txt variant="overline">
                {t("common.day", { number: day.day_number })}
              </Txt>
              <Txt variant="body" tone="secondary">
                {t("plan.locked", {
                  date: new Date(day.unlock_date).toLocaleDateString(
                    i18n.language,
                    { day: "numeric", month: "long" },
                  ),
                })}
              </Txt>
            </View>
          );
        }

        return (
          <Tap
            key={day.day_number}
            accessibilityRole="link"
            accessibilityLabel={`${t("common.day", { number: day.day_number })}. ${day.title}`}
            onPress={() =>
              router.push({
                pathname: "/plan/[id]/dia/[numero]",
                params: { id: id!, numero: String(day.day_number) },
              })
            }
          >
            <Glass flat readable className="gap-1 rounded-card p-5 shadow-soft">
              <View className="flex-row items-center justify-between">
                <Txt variant="overline">
                  {t("common.day", { number: day.day_number })}
                </Txt>
                {/* A quiet mark, not a scoreboard: this is a record of what you
                    prayed, not a list of what you owe. */}
                {day.prayed ? (
                  <Txt variant="caption">{t("plan.dayPrayed")}</Txt>
                ) : null}
              </View>

              <Txt variant="subheadingLg">{day.title}</Txt>

              {day.scripture_ref ? (
                <Txt variant="caption">{day.scripture_ref}</Txt>
              ) : null}
            </Glass>
          </Tap>
        );
      })}
    </ScreenScaffold>
  );
}
