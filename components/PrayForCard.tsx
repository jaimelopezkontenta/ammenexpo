import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import type { SharedPlan } from "@/core/intercessions/queries";

import { Tap } from "@/components/ui/Tap";

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
    <Tap
      accessibilityRole="link"
      accessibilityLabel={`${plan.owner_name}. ${plan.day_title}`}
      onPress={onOpen}
    >
      <Card flat className="gap-3">
      <View className="flex-row items-center gap-3">
        <Avatar
          name={plan.owner_name}
          url={plan.owner_avatar_url}
          seed={plan.owner_id}
          size={36}
        />
        <View className="flex-1 gap-1">
          <Text className="font-sans-semibold text-lg text-plum">
            {plan.owner_name}
          </Text>
          <Text className="font-sans text-sm text-mist-ink">
            {plan.plan_title}
          </Text>
        </View>
      </View>

      <View className="gap-1">
        <Text className="font-editorial text-base text-ember-ink">
          {t("common.day", { number: plan.day_number })}
        </Text>
        <Text className="font-sans text-base leading-6 text-plum">
          {plan.day_title}
        </Text>
      </View>

      <Text
        className={
          plan.already_prayed
            ? "font-sans-medium text-sm text-mist-ink"
            : "font-sans-semibold text-sm text-plum"
        }
      >
        {plan.already_prayed
          ? t("intercession.prayedFor", { name: plan.owner_name })
          : t("intercession.openToPray")}
      </Text>
      </Card>
    </Tap>
  );
};
