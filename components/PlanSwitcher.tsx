import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text } from "react-native";

import type { OwnPlan } from "@/core/plans/queries";

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
      {plans.map((plan) => {
        const isActive = plan.id === activeId;

        return (
          <Pressable
            key={plan.id}
            // Both, deliberately: accessibilityState is what iOS and Android
            // read, and react-native-web 0.21 no longer maps it, so the web DOM
            // would announce "radio" and never say which one is chosen.
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            aria-checked={isActive}
            accessibilityLabel={plan.title}
            onPress={() => onSelect(plan.id)}
            className={`rounded-full border px-4 py-2 ${
              isActive
                ? "border-slate-900 bg-slate-900"
                : "border-slate-200 bg-white"
            }`}
          >
            <Text
              numberOfLines={1}
              className={`max-w-48 text-sm ${
                isActive ? "font-semibold text-white" : "text-slate-600"
              }`}
            >
              {plan.title}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
