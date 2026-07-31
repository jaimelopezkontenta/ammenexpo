import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PrayForCard } from "@/components/PrayForCard";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { usePlansSharedWithMe } from "@/core/intercessions/queries";

export default function Pray() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: plans,
    isLoading,
    isError,
    refetch,
  } = usePlansSharedWithMe(userId);

  if (isLoading) {
    return <LoadingState />;
  }

  // Before this, a failed read fell straight through to the empty state and told
  // people nobody had shared anything with them — a false statement, with no way
  // to find out otherwise.
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (!plans || plans.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Text className="text-center text-2xl font-bold text-slate-900">
          {t("pray.empty")}
        </Text>
        <Text className="text-center text-base leading-6 text-slate-500">
          {t("pray.emptyBody")}
        </Text>
        {/* Nobody has shared with you yet, so the useful move is to share
            yours — otherwise this screen is a wall. */}
        <View className="mt-6 w-full">
          <Button
            title={t("pray.emptyCta")}
            variant="secondary"
            onPress={() => router.push("/circulos")}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="gap-5 px-7 py-8"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-2xl font-bold text-slate-900">
          {t("pray.title")}
        </Text>
        <Text className="text-base text-slate-500">{t("pray.subtitle")}</Text>
      </View>

      {plans.map((plan) => (
        <PrayForCard
          key={plan.plan_id}
          plan={plan}
          onOpen={() =>
            router.push({
              pathname: "/orar/[planId]",
              params: { planId: plan.plan_id },
            })
          }
        />
      ))}
    </ScrollView>
  );
}
