import * as Localization from "expo-localization";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips, type ChoiceOption } from "@/components/ChoiceChips";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import {
  CUSTOM_TOPIC_MAX,
  GENDER_KEYS,
  REMINDER_HOURS,
  REMINDER_MAX,
  SEASON_KEYS,
  SEASON_MAX,
  TOPIC_KEYS,
  toggleWithLimit,
} from "@/core/onboarding/options";
import { supabase } from "@/utils/supabase";

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const { refreshOnboarding } = useSession();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  // Spanish inflects for gender constantly ("sola", "acompañada"), so a plan
  // written for the wrong one grates on every single day. Guessing from the
  // name works for "Marta" and fails for "Alex", so we ask.
  const [gender, setGender] = useState<string | null>(null);
  // Several, capped: people rarely live one thing at a time — anxiety and work
  // and a decision arrive together — but a plan written from eight situations
  // at once describes none of them.
  const [seasons, setSeasons] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [reminderKeys, setReminderKeys] = useState<string[]>(["morning"]);
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
    (step === 1 && displayName.trim().length > 0 && gender !== null) ||
    (step === 2 && seasons.length > 0) ||
    // The free text counts: somebody who does not see themselves in any chip
    // has still answered the question.
    (step === 3 && (topics.length > 0 || customTopic.trim().length > 0)) ||
    (step === 4 && reminderKeys.length > 0);

  const handleFinish = async () => {
    setError(null);
    setIsSubmitting(true);

    const reminderHours = REMINDER_HOURS.filter((entry) =>
      reminderKeys.includes(entry.key),
    ).map((entry) => entry.hour);

    try {
      // One round trip saves the answers AND redeems any share link or invite
      // the user arrived with, so the two can never end up out of sync.
      const { data, error: rpcError } = await supabase.rpc(
        "complete_onboarding",
        {
          p_display_name: displayName.trim(),
          p_answers: {
            seasons,
            topics,
            gender,
            custom_topic: customTopic.trim() || null,
            reminder_keys: reminderKeys,
          },
          p_timezone: Localization.getCalendars()[0]?.timeZone ?? "UTC",
          p_reminder_hours: reminderHours,
          p_locale: i18n.resolvedLanguage ?? "es",
        },
      );

      if (rpcError) throw rpcError;

      // The return value used to be discarded, so a call that wrote nothing and
      // answered `{ok:true}` was indistinguishable from one that worked. That
      // is exactly what happened when the settings row was missing: this screen
      // has no navigation of its own — the only thing that moves anyone off it
      // is `hasOnboarded` flipping — so the button spun, stopped, and trapped
      // them here with no error and nothing in the console.
      if (!(data as { ok?: boolean } | null)?.ok) {
        throw new Error("onboarding_not_saved");
      }

      await refreshOnboarding();
    } catch {
      // And without a catch, anything that *threw* rather than returning
      // `{ error }` left `isSubmitting` true forever: a spinner that never
      // stops, still with nothing said.
      setError(t("common.errorGeneric"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="flex-grow px-7 py-14"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-sm font-medium text-ink-soft">
        {t("onboarding.step", { current: step, total: TOTAL_STEPS })}
      </Text>

      {step === 1 ? (
        <View className="mt-4 gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-ink">
              {t("onboarding.welcomeTitle")}
            </Text>
            <Text className="text-base text-ink-muted">
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

          <View className="gap-2">
            <Text className="text-sm font-medium text-ink-muted">
              {t("onboarding.genderQuestion")}
            </Text>
            <Text className="text-sm text-ink-muted">
              {t("onboarding.genderHint")}
            </Text>
            <ChoiceChips
              options={GENDER_KEYS.map((key) => ({
                value: key,
                label: t(`onboarding.gender.${key}`),
              }))}
              selected={gender ? [gender] : []}
              onToggle={setGender}
            />
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View className="mt-4 gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-ink">
              {t("onboarding.seasonQuestion")}
            </Text>
            <Text className="text-base text-ink-muted">
              {t("onboarding.seasonHint", { count: SEASON_MAX })}
            </Text>
          </View>
          <ChoiceChips
            options={seasonOptions}
            selected={seasons}
            onToggle={(value) =>
              setSeasons((current) =>
                toggleWithLimit(current, value, SEASON_MAX),
              )
            }
            max={SEASON_MAX}
            multiple
          />
          {/* Said out loud, because a chip that stops responding with no
              explanation reads as a broken chip. */}
          {seasons.length >= SEASON_MAX ? (
            <Text
              className="text-sm text-ink-muted"
              accessibilityLiveRegion="polite"
            >
              {t("onboarding.seasonMax", { count: SEASON_MAX })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {step === 3 ? (
        <View className="mt-4 gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-ink">
              {t("onboarding.topicsQuestion")}
            </Text>
            <Text className="text-base text-ink-muted">
              {t("onboarding.topicsHint")}
            </Text>
          </View>
          <ChoiceChips
            options={topicOptions}
            selected={topics}
            onToggle={(value) =>
              setTopics((current) => toggleWithLimit(current, value))
            }
            multiple
          />

          {/* Folded in here rather than given a fifth step: it is the same
              question, with a way out for somebody who does not see themselves
              in any of the sixteen. It also becomes the starting point of the
              identical field on the plan form, so it is asked once. */}
          <View className="gap-2">
            <TextField
              label={t("onboarding.customLabel")}
              value={customTopic}
              onChangeText={setCustomTopic}
              placeholder={t("onboarding.customPlaceholder")}
              maxLength={CUSTOM_TOPIC_MAX}
              multiline
            />
            <Text className="text-sm text-ink-muted">
              {t("onboarding.customHint")}
            </Text>
          </View>
        </View>
      ) : null}

      {step === 4 ? (
        <View className="mt-4 gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-ink">
              {t("onboarding.timeQuestion")}
            </Text>
            <Text className="text-base text-ink-muted">
              {t("onboarding.timeHint", { count: REMINDER_MAX })}
            </Text>
          </View>
          <ChoiceChips
            options={hourOptions}
            selected={reminderKeys}
            onToggle={(value) =>
              setReminderKeys((current) =>
                toggleWithLimit(current, value, REMINDER_MAX),
              )
            }
            max={REMINDER_MAX}
            multiple
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
          title={
            step === TOTAL_STEPS ? t("onboarding.finish") : t("onboarding.next")
          }
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
