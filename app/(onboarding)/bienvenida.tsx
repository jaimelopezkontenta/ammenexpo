import * as Localization from "expo-localization";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips, type ChoiceOption } from "@/components/ChoiceChips";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { supabase } from "@/utils/supabase";

const SEASON_KEYS = [
  "grief",
  "anxiety",
  "work",
  "family",
  "health",
  "decision",
  "gratitude",
  "faith",
] as const;

const TOPIC_KEYS = [
  "peace",
  "wisdom",
  "health",
  "family",
  "provision",
  "forgiveness",
  "purpose",
  "gratitude",
] as const;

const REMINDER_HOURS: { key: string; hour: number }[] = [
  { key: "early", hour: 6 },
  { key: "morning", hour: 8 },
  { key: "noon", hour: 12 },
  { key: "evening", hour: 18 },
  { key: "night", hour: 21 },
];

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const { refreshOnboarding } = useSession();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [season, setSeason] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [reminderKey, setReminderKey] = useState("morning");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const seasonOptions: ChoiceOption[] = SEASON_KEYS.map((key) => ({
    value: key,
    label: t(`onboarding.seasons.${key}`),
  }));

  const topicOptions: ChoiceOption[] = TOPIC_KEYS.map((key) => ({
    value: key,
    label: t(`onboarding.topics.${key}`),
  }));

  const hourOptions: ChoiceOption[] = REMINDER_HOURS.map(({ key }) => ({
    value: key,
    label: t(`onboarding.hours.${key}`),
  }));

  const canContinue =
    (step === 1 && displayName.trim().length > 0) ||
    (step === 2 && season !== null) ||
    (step === 3 && topics.length > 0) ||
    step === 4;

  const toggleTopic = (value: string) =>
    setTopics((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value],
    );

  const handleFinish = async () => {
    setError(null);
    setIsSubmitting(true);

    const reminderHour =
      REMINDER_HOURS.find((entry) => entry.key === reminderKey)?.hour ?? 8;

    // One round trip saves the answers AND redeems any share link or invite the
    // user arrived with, so the two can never end up out of sync.
    const { error: rpcError } = await supabase.rpc("complete_onboarding", {
      p_display_name: displayName.trim(),
      p_answers: { season, topics, reminder_key: reminderKey },
      p_timezone: Localization.getCalendars()[0]?.timeZone ?? "UTC",
      p_reminder_hour: reminderHour,
      p_locale: i18n.resolvedLanguage ?? "es",
    });

    if (rpcError) {
      setIsSubmitting(false);
      setError(t("common.errorGeneric"));
      return;
    }

    await refreshOnboarding();
    setIsSubmitting(false);
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="flex-grow px-7 py-14"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-sm font-medium text-slate-400">
        {t("onboarding.step", { current: step, total: TOTAL_STEPS })}
      </Text>

      {step === 1 ? (
        <View className="mt-4 gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-slate-900">
              {t("onboarding.welcomeTitle")}
            </Text>
            <Text className="text-base text-slate-500">
              {t("onboarding.welcomeBody")}
            </Text>
          </View>
          <TextField
            label={t("onboarding.nameQuestion")}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t("onboarding.namePlaceholder")}
            autoCapitalize="words"
            autoComplete="name"
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View className="mt-4 gap-6">
          <Text className="text-2xl font-bold text-slate-900">
            {t("onboarding.seasonQuestion")}
          </Text>
          <ChoiceChips
            options={seasonOptions}
            selected={season ? [season] : []}
            onToggle={(value) =>
              setSeason((current) => (current === value ? null : value))
            }
          />
        </View>
      ) : null}

      {step === 3 ? (
        <View className="mt-4 gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-slate-900">
              {t("onboarding.topicsQuestion")}
            </Text>
            <Text className="text-base text-slate-500">
              {t("onboarding.topicsHint")}
            </Text>
          </View>
          <ChoiceChips
            options={topicOptions}
            selected={topics}
            onToggle={toggleTopic}
          />
        </View>
      ) : null}

      {step === 4 ? (
        <View className="mt-4 gap-6">
          <Text className="text-2xl font-bold text-slate-900">
            {t("onboarding.timeQuestion")}
          </Text>
          <ChoiceChips
            options={hourOptions}
            selected={[reminderKey]}
            onToggle={setReminderKey}
          />
        </View>
      ) : null}

      {error ? (
        <Text className="mt-6 text-sm text-red-500" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View className="mt-auto gap-3 pt-10">
        <Button
          title={step === TOTAL_STEPS ? t("onboarding.finish") : t("onboarding.next")}
          disabled={!canContinue}
          loading={isSubmitting}
          onPress={() => {
            if (step === TOTAL_STEPS) {
              void handleFinish();
            } else {
              setStep((current) => current + 1);
            }
          }}
        />
        {step > 1 ? (
          <Button
            title={t("common.back")}
            variant="ghost"
            onPress={() => setStep((current) => current - 1)}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
