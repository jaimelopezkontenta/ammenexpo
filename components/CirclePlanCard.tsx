import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Txt } from "@/components/ui/Text";
import type { Circle, CirclePlan } from "@/core/circles/queries";

interface CirclePlanCardProps {
  circle: Circle;
  plan: CirclePlan | null | undefined;
  canCreate: boolean;
  isPending: boolean;
  error: string | null;
  onMarkPrayed: (planDayId: string) => void;
}

/**
 * What is actually happening inside a circle.
 *
 * Until now the circle screen was a roster and an invite link: you could not
 * tell whether anyone had been here today, whether anything was being shared,
 * or whether the circle was alive at all. `circles.streak` and
 * `circles.prayedToday` have been translated in both languages since the first
 * week with nothing rendering them.
 */
export const CirclePlanCard = ({
  circle,
  plan,
  canCreate,
  isPending,
  error,
  onMarkPrayed,
}: CirclePlanCardProps) => {
  const { t } = useTranslation();

  if (!plan) {
    if (!canCreate) {
      return null;
    }

    return (
      <Card flat className="gap-2">
        <Txt variant="subheading">{t("circles.planEmpty")}</Txt>
        <Txt variant="body" tone="secondary">
          {t("circles.planEmptyBody")}
        </Txt>
        <Link
          href={{ pathname: "/plan/nuevo", params: { circulo: circle.id } }}
          asChild
        >
          <Button title={t("circles.planCreate")} variant="secondary" />
        </Link>
      </Card>
    );
  }

  return (
    <Card flat className="gap-3">
      <View className="gap-1">
        <Txt variant="label" tone="secondary">
          {t("circles.planLabel")}
        </Txt>
        <Txt variant="subheadingLg">{plan.title}</Txt>
      </View>

      {/* A streak nobody can see is a counter, not a streak. */}
      {circle.streak_count > 0 ? (
        <Txt variant="caption">
          {t("circles.streak", { count: circle.streak_count })}
        </Txt>
      ) : null}

      {/* Terminado no es vacío: se dice, y el último día se queda para releer.
        Sin esto la tarjeta seguía pidiendo «Ya oré» en un día que ya pasó. */}
      {plan.finished ? (
        <View className="gap-1">
          <Txt variant="bodyMedium">{t("circles.planFinished")}</Txt>
          <Txt variant="body" tone="secondary">
            {t("circles.planFinishedBody")}
          </Txt>
        </View>
      ) : null}

      {plan.status === "generating" && !plan.day_id ? (
        <Txt variant="body" tone="secondary">
          {t("plan.generating")}
        </Txt>
      ) : null}

      {plan.day_id ? (
        <>
          <Txt variant="body">
            {t("common.day", { number: plan.day_number })} · {plan.day_title}
          </Txt>

          {!plan.finished && plan.prayed_count > 0 ? (
            <Txt variant="caption">
              {t("circles.prayedToday", { count: plan.prayed_count })}
            </Txt>
          ) : null}

          {error ? (
            <Txt variant="caption" tone="danger" accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}

          {plan.finished ? null : plan.prayed_today ? (
            <Txt variant="bodyMedium" tone="secondary">
              {t("plan.markedDone")}
            </Txt>
          ) : (
            <Button
              title={t("plan.markDone")}
              loading={isPending}
              onPress={() => onMarkPrayed(plan.day_id!)}
            />
          )}
        </>
      ) : null}
    </Card>
  );
};
