import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { DaySection } from "@/components/DaySection";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import {
  AlreadyPrayed,
  MESSAGE_MAX,
  QUICK_MESSAGE_KEYS,
  usePlansSharedWithMe,
  usePrayForSomeone,
} from "@/core/intercessions/queries";

/**
 * Someone else's day, and a prayer written for you to pray over them.
 *
 * The list keeps its cards short on purpose — with three or four people sharing
 * with you, putting the whole day in every card turns the tab into a wall of
 * text where you cannot see who is still waiting.
 */
export default function PrayForSomeone() {
  const { t } = useTranslation();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: plans,
    isLoading,
    isError,
    refetch,
  } = usePlansSharedWithMe(userId);
  const pray = usePrayForSomeone(userId);

  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const plan = (plans ?? []).find((entry) => entry.plan_id === planId);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("tabs.pray"), headerShown: true }} />
        <LoadingState />
      </>
    );
  }

  if (isError || !plan) {
    return (
      <>
        <Stack.Screen options={{ title: t("pray.title"), headerShown: true }} />
        <ErrorState
          onRetry={isError ? () => void refetch() : undefined}
          message={isError ? undefined : t("pray.planGone")}
        />
      </>
    );
  }

  const handlePray = async () => {
    setError(null);

    try {
      await pray.mutateAsync({
        dayId: plan.day_id,
        message: message.trim() || undefined,
      });
      router.back();
    } catch (caught) {
      // Pressing twice means the same as pressing once, so it is not worth an
      // alarm — the list behind this screen refreshes either way.
      if (caught instanceof AlreadyPrayed) {
        router.back();
        return;
      }

      setError(t("common.errorGeneric"));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: plan.owner_name, headerShown: true }} />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-7 px-7 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("common.day", { number: plan.day_number })}
          </Text>
          <Text className="text-3xl font-bold leading-9 text-slate-900">
            {plan.day_title}
          </Text>
          <Text className="text-base text-slate-500">{plan.plan_title}</Text>
        </View>

        {plan.scripture_text ? (
          <DaySection label={t("plan.scripture")} tone="scripture">
            <Text className="text-lg leading-7 text-slate-800">
              {plan.scripture_text}
            </Text>
            {plan.scripture_ref ? (
              <Text className="text-sm font-medium text-slate-500">
                {plan.scripture_ref}
              </Text>
            ) : null}
          </DaySection>
        ) : null}

        {/* Older plans were generated before this field existed, so the block
            simply does not appear for them. */}
        {plan.intercessor_prayer ? (
          <DaySection
            label={t("intercession.prayerFor", { name: plan.owner_name })}
          >
            <Text className="text-lg leading-8 text-slate-800">
              {plan.intercessor_prayer}
            </Text>
          </DaySection>
        ) : null}

        {plan.already_prayed ? (
          <Text className="text-center text-base font-medium text-slate-600">
            {t("intercession.prayedFor", { name: plan.owner_name })}
          </Text>
        ) : (
          <View className="gap-3 pb-6">
            <View className="flex-row flex-wrap gap-2">
              {QUICK_MESSAGE_KEYS.map((key) => {
                const label = t(`intercession.quick.${key}`);

                return (
                  <Button
                    key={key}
                    title={label}
                    variant="secondary"
                    className="w-auto"
                    onPress={() => setMessage(label)}
                  />
                );
              })}
            </View>

            <TextField
              label={t("intercession.messageLabel")}
              value={message}
              onChangeText={setMessage}
              placeholder={t("intercession.messagePlaceholder")}
              maxLength={MESSAGE_MAX}
              multiline
            />

            {error ? (
              <Text className="text-sm text-red-500" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Button
              title={t("intercession.prayFor")}
              loading={pray.isPending}
              onPress={() => void handlePray()}
            />
          </View>
        )}
      </ScrollView>
    </>
  );
}
