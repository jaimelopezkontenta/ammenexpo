import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PrayForCard } from "@/components/PrayForCard";
import { useSession } from "@/core/auth/SessionProvider";
import {
  AlreadyPrayed,
  usePlansSharedWithMe,
  usePrayForSomeone,
} from "@/core/intercessions/queries";

export default function Pray() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: plans, isLoading } = usePlansSharedWithMe(userId);
  const pray = usePrayForSomeone(userId);

  const [pendingDayId, setPendingDayId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePray = async (dayId: string, message?: string) => {
    setError(null);
    setPendingDayId(dayId);

    try {
      await pray.mutateAsync({ dayId, message });
    } catch (caught) {
      // Pressing twice is not an error worth alarming anyone about: the list
      // refreshes and the card simply shows as already prayed.
      if (!(caught instanceof AlreadyPrayed)) {
        setError(t("common.errorGeneric"));
      }
    } finally {
      setPendingDayId(null);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0f172a" />
      </View>
    );
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

      {error ? (
        <Text className="text-sm text-red-500" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {plans.map((plan) => (
        <PrayForCard
          key={plan.plan_id}
          plan={plan}
          pending={pendingDayId === plan.day_id}
          onPray={(message) => void handlePray(plan.day_id, message)}
        />
      ))}
    </ScrollView>
  );
}
