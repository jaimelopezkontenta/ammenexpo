import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
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
      <View className="gap-2 rounded-2xl border border-ink-line p-5">
        <Text className="text-base font-semibold text-ink">
          {t("circles.planEmpty")}
        </Text>
        <Text className="text-base leading-6 text-ink-muted">
          {t("circles.planEmptyBody")}
        </Text>
        <Link
          href={{ pathname: "/plan/nuevo", params: { circulo: circle.id } }}
          asChild
        >
          <Button title={t("circles.planCreate")} variant="secondary" />
        </Link>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-2xl border border-ink-line p-5">
      <View className="gap-1">
        <Text className="text-sm font-medium text-ink-soft">
          {t("circles.planLabel")}
        </Text>
        <Text className="text-lg font-semibold text-ink">{plan.title}</Text>
      </View>

      {/* A streak nobody can see is a counter, not a streak. */}
      {circle.streak_count > 0 ? (
        <Text className="text-sm text-ink-muted">
          {t("circles.streak", { count: circle.streak_count })}
        </Text>
      ) : null}

      {plan.status === "generating" && !plan.day_id ? (
        <Text className="text-base text-ink-muted">{t("plan.generating")}</Text>
      ) : null}

      {plan.day_id ? (
        <>
          <Text className="text-base text-ink">
            {t("common.day", { number: plan.day_number })} · {plan.day_title}
          </Text>

          {plan.prayed_count > 0 ? (
            <Text className="text-sm text-ink-muted">
              {t("circles.prayedToday", { count: plan.prayed_count })}
            </Text>
          ) : null}

          {error ? (
            <Text className="text-sm text-red-500" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          {plan.prayed_today ? (
            <Text className="text-base font-medium text-ink-muted">
              {t("plan.markedDone")}
            </Text>
          ) : (
            <Button
              title={t("plan.markDone")}
              loading={isPending}
              onPress={() => onMarkPrayed(plan.day_id!)}
            />
          )}
        </>
      ) : null}
    </View>
  );
};
