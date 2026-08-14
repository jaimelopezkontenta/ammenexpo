import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { DaySection } from "@/components/DaySection";
import { ScriptureSection } from "@/components/DayView";
import { DawnBackground } from "@/components/DawnBackground";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { useBibleBooks } from "@/core/bible/queries";
import {
  AlreadyPrayed,
  MESSAGE_MAX,
  QUICK_MESSAGE_KEYS,
  useSharedPlanDay,
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

  const { data: plan, isLoading, isError, refetch } = useSharedPlanDay(planId);
  const pray = usePrayForSomeone(userId);

  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { data: books } = useBibleBooks();

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
      // Going straight back gave no sign at all that it had worked: success and
      // a double press were pixel-identical, on the one gesture the whole
      // product rests on. A beat of confirmation, then out.
      setSent(true);
      setTimeout(() => router.back(), 1400);
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
      <DawnBackground>
        <ScrollView
          contentContainerClassName="gap-7 px-7 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            <Text className="font-sans-semibold text-xs uppercase tracking-wide text-mist-ink">
              {t("common.day", { number: plan.day_number })}
            </Text>
            <Text className="font-sans-bold text-3xl leading-9 text-plum">
              {plan.day_title}
            </Text>
            <Text className="font-sans text-base text-mist-ink">
              {plan.plan_title}
            </Text>
          </View>

          {/* The shared component rather than an inlined copy: this screen used
            to show the verse with no way into the chapter around it, so the
            reference was tappable on your own day and dead on somebody
            else's — for the same verse. */}
          <ScriptureSection
            scriptureText={plan.scripture_text}
            scriptureRef={plan.scripture_ref}
            books={books ?? []}
          />

          {/* Older plans were generated before this field existed, so the block
            simply does not appear for them. */}
          {plan.intercessor_prayer ? (
            <DaySection
              label={t("intercession.prayerFor", { name: plan.owner_name })}
            >
              <Text className="font-serif text-lg leading-reading text-plum">
                {plan.intercessor_prayer}
              </Text>
            </DaySection>
          ) : null}

          {plan.already_prayed || sent ? (
            <Text
              className="text-center font-sans-medium text-base text-mist-ink"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {sent
                ? t("intercession.prayedThanks", { name: plan.owner_name })
                : t("intercession.prayedFor", { name: plan.owner_name })}
            </Text>
          ) : (
            <View className="gap-3 pb-6">
              {/* Chips and free text are alternatives, so picking one still
                replaces the field — but it now shows which one is picked and
                tapping it again clears it. Before, nothing on screen said a
                chip was chosen and there was no way to undo one except
                selecting the text and deleting it. */}
              <View className="flex-row flex-wrap gap-2">
                {QUICK_MESSAGE_KEYS.map((key) => {
                  const label = t(`intercession.quick.${key}`);
                  const chosen = message.trim() === label;

                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: chosen }}
                      aria-checked={chosen}
                      accessibilityLabel={label}
                      onPress={() => setMessage(chosen ? "" : label)}
                      className={`rounded-full border px-4 py-2.5 ${
                        chosen
                          ? "border-plum bg-plum-chip"
                          : "border-white/60 bg-dawn-cream-bg"
                      }`}
                    >
                      <Text
                        className={
                          chosen
                            ? "font-sans-semibold text-white"
                            : "text-mist-ink"
                        }
                      >
                        {label}
                      </Text>
                    </Pressable>
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

              {/* At 280 the field simply stopped accepting keystrokes with no
                explanation. The counter only appears once it is close enough
                to matter. */}
              {message.length > MESSAGE_MAX - 60 ? (
                <Text className="text-right font-sans text-sm text-mist-ink">
                  {t("intercession.remaining", {
                    count: MESSAGE_MAX - message.length,
                  })}
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

              <Button
                title={t("intercession.prayFor")}
                loading={pray.isPending}
                onPress={() => void handlePray()}
              />
            </View>
          )}
        </ScrollView>
      </DawnBackground>
    </>
  );
}
