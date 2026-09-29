import * as Localization from "expo-localization";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Txt } from "@/components/ui/Text";
import { ChoiceChips, type ChoiceOption } from "@/components/ChoiceChips";
import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useScreenPadding } from "@/components/useScreenPadding";
import { TextField } from "@/components/TextField";
import { WizardHeader } from "@/components/WizardHeader";
import { Wordmark } from "@/components/Wordmark";
import { useSession } from "@/core/auth/SessionProvider";
import { Orb } from "@/components/Orb";
import { useToast } from "@/core/toast/ToastProvider";
import { useGeneratePlan } from "@/core/plans/queries";
import { EMAIL_CADENCES, type EmailCadence } from "@/core/email/cadence";
import { defaultOnboardingCadence } from "@/core/email/queries";
import {
  CUSTOM_TOPIC_MAX,
  GENDER_KEYS,
  REMINDER_HOURS,
  REMINDER_MAX,
  SEASON_GROUPS,
  SEASON_KEYS,
  SEASON_MAX,
  TOPIC_GROUPS,
  TOPIC_KEYS,
  toggleWithLimit,
} from "@/core/onboarding/options";
import { supabase } from "@/utils/supabase";
import { DURATION, EASE } from "@/theme/motion";

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const { top, scrollBottom } = useScreenPadding();
  const { session, refreshOnboarding, signOut } = useSession();
  const toast = useToast();
  // Entre guardar las respuestas y tener el primer plan: la pantalla que
  // explica la espera, en vez de un spinner mudo dentro del botón.
  const [preparing, setPreparing] = useState(false);
  const generate = useGeneratePlan(session?.user.id);

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
  const [emailCadence, setEmailCadence] = useState<EmailCadence>(() =>
    defaultOnboardingCadence(Platform.OS === "web"),
  );
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
    // Horas vacías son válidas: hoy no se envían recordatorios.
    step === 4;

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
          p_email_cadence: emailCadence,
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

      // El plan sale de las mismas respuestas: si la generación falla, el alta
      // ya está hecha y Hoy mostrará el vacío con salida — pero se dice, en vez
      // de tragarse el error y dejar a la persona ante un vacío sin explicación.
      setPreparing(true);
      try {
        await generate.mutateAsync({
          duration_days: 7,
          topics,
          custom_topic: customTopic.trim() || undefined,
          visibility: "private",
        });
      } catch {
        toast.info(t("onboarding.planLater"));
      }

      await refreshOnboarding();
    } catch {
      // And without a catch, anything that *threw* rather than returning
      // `{ error }` left `isSubmitting` true forever: a spinner that never
      // stops, still with nothing said.
      setError(t("common.errorGeneric"));
      setPreparing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (preparing) {
    return (
      <DawnBackground className="items-center justify-center gap-4 px-8">
        <Orb size={120} halo variant="working" />
        <View className="items-center gap-2" accessibilityLiveRegion="polite">
          <Txt variant="headingLg" className="text-center">
            {t("onboarding.preparingTitle")}
          </Txt>
          <Txt variant="body" tone="secondary" className="text-center">
            {t("onboarding.preparingBody")}
          </Txt>
        </View>
      </DawnBackground>
    );
  }

  return (
    <KeyboardScreen>
      <DawnBackground>
        <ScrollView
          contentContainerClassName="flex-grow px-7 pb-10 pt-6 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{
            paddingTop: top,
            paddingBottom: scrollBottom,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <WizardHeader
            step={step}
            total={TOTAL_STEPS}
            onBack={
              step > 1 ? () => setStep((current) => current - 1) : undefined
            }
          />

          {/* El `key` fuerza el remonte al cambiar de paso, y con él la entrada
          lateral: la respuesta visual de "esto avanza" que el asistente no
          tenía. Solo entrada, sin `exiting`: una salida animada mantiene el
          paso anterior en el layout unos frames y el CTA daría un salto. */}
          <Animated.View
            key={step}
            entering={FadeInRight.duration(DURATION.enter).easing(EASE)}
          >
            {step === 1 ? (
              <View className="mt-4 gap-6">
                <View className="gap-2">
                  <Txt variant="display" className="text-center">
                    {t("onboarding.welcomeTitle")}
                  </Txt>
                  <Txt variant="body" tone="secondary" className="text-center">
                    {t("onboarding.welcomeBody")}
                  </Txt>
                </View>
                <TextField
                  label={t("onboarding.nameQuestion")}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t("onboarding.namePlaceholder")}
                  autoCapitalize="words"
                  autoComplete="name"
                  // El mismo techo que Perfil y que la base (profiles_display_name_length).
                  maxLength={80}
                />

                {/* El nombre y el género van juntos y no en dos pantallas como el
              montaje. Son la misma pregunta —quién eres— y separarlos cuesta
              un toque más a cambio de nada. */}
                <View className="gap-2">
                  <Txt variant="label">{t("onboarding.genderQuestion")}</Txt>
                  <Txt variant="caption">{t("onboarding.genderHint")}</Txt>
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
                  <Txt variant="headingLg" className="text-center">
                    {t("onboarding.seasonQuestion")}
                  </Txt>
                  <Txt variant="body" tone="secondary" className="text-center">
                    {t("onboarding.seasonHint", { count: SEASON_MAX })}
                  </Txt>
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
                  groups={SEASON_GROUPS.map((group) => ({
                    key: group.key,
                    label: t(`onboarding.seasonGroups.${group.key}`),
                    values: group.keys,
                  }))}
                  stagger
                />
                {/* Said out loud, because a chip that stops responding with no
              explanation reads as a broken chip. */}
                {seasons.length >= SEASON_MAX ? (
                  <Txt
                    variant="caption"
                    className="text-center"
                    accessibilityLiveRegion="polite"
                  >
                    {t("onboarding.seasonMax", { count: SEASON_MAX })}
                  </Txt>
                ) : null}
              </View>
            ) : null}

            {step === 3 ? (
              <View className="mt-4 gap-6">
                <View className="gap-2">
                  <Txt variant="headingLg" className="text-center">
                    {t("onboarding.topicsQuestion")}
                  </Txt>
                  <Txt variant="body" tone="secondary" className="text-center">
                    {t("onboarding.topicsHint")}
                  </Txt>
                </View>
                <ChoiceChips
                  options={topicOptions}
                  selected={topics}
                  onToggle={(value) =>
                    setTopics((current) => toggleWithLimit(current, value))
                  }
                  multiple
                  groups={TOPIC_GROUPS.map((group) => ({
                    key: group.key,
                    label: t(`onboarding.topicGroups.${group.key}`),
                    values: group.keys,
                  }))}
                  stagger
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
                  <Txt variant="caption">{t("onboarding.customHint")}</Txt>
                </View>
              </View>
            ) : null}

            {step === 4 ? (
              <View className="mt-4 gap-6">
                <View className="gap-2">
                  <Txt variant="headingLg" className="text-center">
                    {t("onboarding.timeQuestion")}
                  </Txt>
                  <Txt variant="body" tone="secondary" className="text-center">
                    {t("onboarding.timeHint", { count: REMINDER_MAX })}
                  </Txt>
                  {/* Lo que va a pasar antes de que el sistema pregunte: el
                    permiso de avisos llega justo al terminar, y sin esto salía
                    de la nada. */}
                  {Platform.OS !== "web" ? (
                    <Txt variant="caption" className="text-center">
                      {t("profile.reminderHintNative")}
                    </Txt>
                  ) : null}
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
                <View className="gap-2 pt-2">
                  <Txt variant="label">{t("email.onboardingQuestion")}</Txt>
                  <Txt variant="caption">
                    {Platform.OS === "web"
                      ? t("email.onboardingHintWeb")
                      : t("email.onboardingHintNative")}
                  </Txt>
                  <ChoiceChips
                    options={EMAIL_CADENCES.map((value) => ({
                      value,
                      label: t(`email.cadence.${value}`),
                    }))}
                    selected={[emailCadence]}
                    onToggle={(value) => setEmailCadence(value as EmailCadence)}
                  />
                </View>
              </View>
            ) : null}
          </Animated.View>

          {error ? (
            <Txt
              variant="caption"
              tone="danger"
              className="mt-6 text-center"
              accessibilityRole="alert"
            >
              {error}
            </Txt>
          ) : null}

          {/* Volver vive arriba, en la cabecera, como en el diseño: abajo solo
            queda la accion que avanza. Dos botones apilados hacian que el de
            retroceder pesara lo mismo que el de seguir. */}
          <View className="mt-auto gap-3 pt-10">
            <Button
              title={
                step === TOTAL_STEPS
                  ? t("onboarding.finish")
                  : t("onboarding.next")
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
            {/* En el primer paso no hay «atrás»: sin esto, quien entró con la
              cuenta que no era no tenía por dónde salir del asistente. */}
            {step === 1 ? (
              <Button
                title={t("auth.signOut")}
                variant="ghost"
                onPress={() => void signOut()}
              />
            ) : null}
          </View>
        </ScrollView>

        <View className="items-center pb-8">
          <Wordmark />
        </View>
      </DawnBackground>
    </KeyboardScreen>
  );
}
