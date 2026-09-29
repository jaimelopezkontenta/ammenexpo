import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { DaySection } from "@/components/DaySection";
import { Txt } from "@/components/ui/Text";
import { ScriptureSection } from "@/components/DayView";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
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

import { Pill } from "@/components/ui/Pill";

/**
 * Someone else's day, and a prayer written for you to pray over them.
 *
 * The list keeps its cards short on purpose — with three or four people sharing
 * with you, putting the whole day in every card turns the tab into a wall of
 * text where you cannot see who is still waiting.
 */
export default function PrayForSomeone() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
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
          contentContainerClassName="gap-7 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1" accessibilityLiveRegion="polite">
            <Txt variant="overline">
              {t("common.day", { number: plan.day_number })}
            </Txt>
            <Txt variant="display">{plan.day_title}</Txt>
            <Txt variant="body" tone="secondary">
              {plan.plan_title}
            </Txt>
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
              <Txt variant="reading">{plan.intercessor_prayer}</Txt>
            </DaySection>
          ) : null}

          {plan.already_prayed || sent ? (
            <Txt
              variant="bodyMedium"
              tone="secondary"
              className="text-center"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {sent
                ? t("intercession.prayedThanks", { name: plan.owner_name })
                : t("intercession.prayedFor", { name: plan.owner_name })}
            </Txt>
          ) : (
            <View className="gap-3 pb-6">
              {/* Chips and free text are alternatives, so picking one still
                replaces the field — but it now shows which one is picked and
                tapping it again clears it. Before, nothing on screen said a
                chip was chosen and there was no way to undo one except
                selecting the text and deleting it. */}
              <View
                className="flex-row flex-wrap gap-2"
                accessibilityRole="radiogroup"
              >
                {QUICK_MESSAGE_KEYS.map((key) => {
                  const label = t(`intercession.quick.${key}`);
                  const chosen = message.trim() === label;

                  return (
                    <Pill
                      key={key}
                      label={label}
                      selected={chosen}
                      role="radio"
                      onPress={() => setMessage(chosen ? "" : label)}
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

              {/* At 280 the field simply stopped accepting keystrokes with no
                explanation. The counter only appears once it is close enough
                to matter. */}
              {message.length > MESSAGE_MAX - 60 ? (
                <Txt variant="caption" className="text-right">
                  {t("intercession.remaining", {
                    count: MESSAGE_MAX - message.length,
                  })}
                </Txt>
              ) : null}

              {error ? (
                <Txt variant="caption" tone="danger" accessibilityRole="alert">
                  {error}
                </Txt>
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
