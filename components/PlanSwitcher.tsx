import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

import type { OwnPlan } from "@/core/plans/queries";

import { Pill } from "@/components/ui/Pill";

interface PlanSwitcherProps {
  plans: OwnPlan[];
  activeId: string;
  onSelect: (planId: string) => void;
}

/**
 * Which of your plans the home screen is showing.
 *
 * The free allowance went from one plan to three and this screen still asked
 * for the newest one only, so the other two existed, counted against the
 * allowance, and could not be opened from anywhere in the app. It lives here
 * rather than in the profile because here is where the need appears.
 *
 * With a single plan it renders nothing: a switcher with one option is a
 * control that teaches you the app has a feature you cannot use.
 */
export const PlanSwitcher = ({
  plans,
  activeId,
  onSelect,
}: PlanSwitcherProps) => {
  const { t } = useTranslation();

  if (plans.length < 2) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2"
      accessibilityRole="radiogroup"
      accessibilityLabel={t("plan.switcherLabel")}
    >
      {plans.map((plan) => (
        <Pill
          key={plan.id}
          label={plan.title}
          selected={plan.id === activeId}
          role="radio"
          numberOfLines={1}
          onPress={() => onSelect(plan.id)}
        />
      ))}
    </ScrollView>
  );
};
