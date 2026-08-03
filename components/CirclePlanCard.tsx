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
      <View className="gap-2 rounded-card border border-white/60 bg-white/60 p-5 shadow-card">
        <Text className="font-sans-semibold text-base text-plum">
          {t("circles.planEmpty")}
        </Text>
        <Text className="font-sans text-base leading-6 text-mist-ink">
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
    <View className="gap-3 rounded-card border border-white/60 bg-white/60 p-5 shadow-card">
      <View className="gap-1">
        <Text className="font-sans-medium text-sm text-mist-ink">
          {t("circles.planLabel")}
        </Text>
        <Text className="font-sans-semibold text-lg text-plum">
          {plan.title}
        </Text>
      </View>

      {/* A streak nobody can see is a counter, not a streak. */}
      {circle.streak_count > 0 ? (
        <Text className="font-sans text-sm text-mist-ink">
          {t("circles.streak", { count: circle.streak_count })}
        </Text>
      ) : null}

      {plan.status === "generating" && !plan.day_id ? (
        <Text className="font-sans text-base text-mist-ink">
          {t("plan.generating")}
        </Text>
      ) : null}

      {plan.day_id ? (
        <>
          <Text className="font-sans text-base text-plum">
            {t("common.day", { number: plan.day_number })} · {plan.day_title}
          </Text>

          {plan.prayed_count > 0 ? (
            <Text className="font-sans text-sm text-mist-ink">
              {t("circles.prayedToday", { count: plan.prayed_count })}
            </Text>
          ) : null}

          {error ? (
            <Text
              className="font-sans text-sm text-danger"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}

          {plan.prayed_today ? (
            <Text className="font-sans-medium text-base text-mist-ink">
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
