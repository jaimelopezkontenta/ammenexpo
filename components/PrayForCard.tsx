import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import type { SharedPlan } from "@/core/intercessions/queries";

type Props = {
  plan: SharedPlan;
  onOpen: () => void;
};

/**
 * One person in the list, kept deliberately short.
 *
 * The day itself — verse, meaning and the prayer written for you to pray over
 * them — lives on its own screen. With three or four people sharing with you,
 * putting all of that in every card turns the tab into a wall of text where you
 * cannot see who is still waiting.
 */
export const PrayForCard = ({ plan, onOpen }: Props) => {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${plan.owner_name}. ${plan.day_title}`}
      className="gap-3 rounded-3xl bg-paper-sunken p-5"
      onPress={onOpen}
    >
      <View className="flex-row items-center gap-3">
        <Avatar
          name={plan.owner_name}
          url={plan.owner_avatar_url}
          seed={plan.owner_id}
          size={36}
        />
        <View className="flex-1 gap-1">
          <Text className="text-lg font-semibold text-ink">
            {plan.owner_name}
          </Text>
          <Text className="text-sm text-ink-muted">{plan.plan_title}</Text>
        </View>
      </View>

      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {t("common.day", { number: plan.day_number })}
        </Text>
        <Text className="text-base leading-6 text-ink">{plan.day_title}</Text>
      </View>

      <Text
        className={
          plan.already_prayed
            ? "text-sm font-medium text-ink-muted"
            : "text-sm font-semibold text-ink"
        }
      >
        {plan.already_prayed
          ? t("intercession.prayedFor", { name: plan.owner_name })
          : t("intercession.openToPray")}
      </Text>
    </Pressable>
  );
};
