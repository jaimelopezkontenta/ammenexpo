import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { useMyCircles } from "@/core/circles/queries";
import {
  CUSTOM_TOPIC_MAX,
  TOPIC_KEYS,
  toggleWithLimit,
} from "@/core/onboarding/options";
import { useOnboardingAnswers } from "@/core/profile/queries";
import {
  GenerationUnavailable,
  PlanLimitReached,
  useGeneratePlan,
  type PlanVisibility,
} from "@/core/plans/queries";

const DURATIONS = [7, 14, 21, 30];

export default function NewPlan() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;
  // Set when this form was opened from a circle: the plan belongs to the
  // circle rather than to the person filling it in.
  const { circulo } = useLocalSearchParams<{ circulo?: string }>();

  const { data: circles } = useMyCircles(userId);
  const { data: answers } = useOnboardingAnswers(userId);
  const generate = useGeneratePlan(userId);

  // `null` until touched, so the onboarding answers show through as the
  // starting point without freezing: clearing every chip stays cleared.
  const [draftTopics, setDraftTopics] = useState<string[] | null>(null);
  const topics = draftTopics ?? answers?.topics ?? [];
  const setTopics = (next: string[]) => setDraftTopics(next);
  // Same shape as the topics above: what was written during onboarding shows
  // through as the starting point, and clearing it stays cleared.
  const [draftCustom, setDraftCustom] = useState<string | null>(null);
  const customTopic = draftCustom ?? answers?.custom_topic ?? "";
  const [duration, setDuration] = useState(7);
  const [visibility, setVisibility] = useState<PlanVisibility>("private");
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  const hasCircles = (circles ?? []).length > 0;

  const handleCreate = async () => {
    setError(null);

    if (!circulo && visibility === "circles" && selectedCircles.length === 0) {
      setError(t("newPlan.chooseCircles"));
      return;
    }

    try {
      const created = await generate.mutateAsync({
        duration_days: duration,
        topics,
        custom_topic: customTopic.trim() || undefined,
        visibility,
        circle_ids: visibility === "circles" ? selectedCircles : undefined,
        group_id: circulo,
      });

      // Back to the circle, where the plan now lives, rather than to a Hoy
      // screen that will not show it: a circle's plan is not your own.
      if (circulo) {
        router.replace({ pathname: "/circulo/[id]", params: { id: circulo } });
        return;
      }

      // Choosing a public link and then landing on Hoy left people with a link
      // they had no way to reach. Hand it to them straight away.
      if (visibility === "link") {
        router.replace({
          pathname: "/plan/[id]/compartir",
          params: { id: created.plan_id },
        });
        return;
      }

      router.replace("/");
    } catch (caught) {
      // The limit is not a failure, and treating it as one left people staring
      // at a red line at the bottom of a form they had already filled in, with
      // no button and nowhere to go.
      if (caught instanceof PlanLimitReached) {
        setAtLimit(true);
        setError(null);
        return;
      }

      // The provider being off is not the same as "you ran out" and not a
      // generic failure: say which one it is, truthfully.
      if (caught instanceof GenerationUnavailable) {
        setAtLimit(false);
        setError(t("plan.generationUnavailable"));
        return;
      }

      setAtLimit(false);
      setError(t("common.errorGeneric"));
    }
  };

  const visibilityHint =
    visibility === "private"
      ? t("newPlan.visPrivateHint")
      : visibility === "circles"
        ? t("newPlan.visCirclesHint")
        : visibility === "public"
          ? t("newPlan.visPublicHint")
          : t("newPlan.visLinkHint");

  return (
    <>
      <Stack.Screen
        options={{ title: t("newPlan.title"), headerShown: true }}
      />
      <KeyboardScreen>
        <DawnBackground>
          <ScrollView
            contentContainerClassName="gap-8 px-7 py-8 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-3">
              <Text className="font-sans-semibold text-lg text-plum">
                {t("newPlan.topicQuestion")}
              </Text>
              <Text className="font-sans text-sm text-mist-ink">
                {t("newPlan.topicHint")}
              </Text>
              <ChoiceChips
                options={TOPIC_KEYS.map((key) => ({
                  value: key,
                  label: t(`onboarding.topics.${key}`),
                }))}
                selected={topics}
                onToggle={(value) => setTopics(toggleWithLimit(topics, value))}
                multiple
              />
            </View>

            <View className="gap-2">
              <TextField
                label={t("newPlan.customLabel")}
                value={customTopic}
                onChangeText={setDraftCustom}
                placeholder={t("newPlan.customPlaceholder")}
                maxLength={CUSTOM_TOPIC_MAX}
                multiline
              />
              <Text className="font-sans text-sm text-mist-ink">
                {t("newPlan.customHint")}
              </Text>
            </View>

            <View className="gap-3">
              <Text className="font-sans-semibold text-lg text-plum">
                {t("newPlan.durationQuestion")}
              </Text>
              <ChoiceChips
                options={DURATIONS.map((days) => ({
                  value: String(days),
                  label: t("newPlan.days", { count: days }),
                }))}
                selected={[String(duration)]}
                onToggle={(value) => setDuration(Number(value))}
              />
            </View>

            {/* A circle's plan has one audience — the circle — so offering "Solo
            yo" here would be offering a contradiction. */}
            {circulo ? null : (
              <View className="gap-3">
                <Text className="font-sans-semibold text-lg text-plum">
                  {t("newPlan.visibilityQuestion")}
                </Text>
                <ChoiceChips
                  options={[
                    { value: "private", label: t("newPlan.visPrivate") },
                    { value: "circles", label: t("newPlan.visCircles") },
                    { value: "link", label: t("newPlan.visLink") },
                    // El último a propósito: es el más expuesto de los cuatro, y
                    // el orden de una lista de opciones es una recomendación
                    // aunque nadie la escriba.
                    { value: "public", label: t("newPlan.visPublic") },
                  ]}
                  selected={[visibility]}
                  onToggle={(value) => setVisibility(value as PlanVisibility)}
                />
                <Text className="font-sans text-sm text-mist-ink">
                  {visibilityHint}
                </Text>

                {visibility === "circles" ? (
                  hasCircles ? (
                    <ChoiceChips
                      options={(circles ?? []).map((circle) => ({
                        value: circle.id,
                        label: circle.name,
                      }))}
                      selected={selectedCircles}
                      onToggle={(value) =>
                        setSelectedCircles((list) =>
                          toggleWithLimit(list, value),
                        )
                      }
                      multiple
                    />
                  ) : (
                    // Without a way out this option is a dead end: nothing to pick,
                    // and creating the plan is blocked on picking something.
                    <View className="gap-3">
                      <Text className="font-sans text-sm text-mist-ink">
                        {t("newPlan.noCircles")}
                      </Text>
                      <Button
                        title={t("circles.create")}
                        variant="secondary"
                        onPress={() => router.push("/circulos")}
                      />
                    </View>
                  )
                ) : null}
              </View>
            )}

            {error ? (
              <Text
                className="font-sans text-sm text-danger"
                accessibilityRole="alert"
              >
                {error}
              </Text>
            ) : null}

            {atLimit ? (
              <Card className="gap-2" accessibilityRole="alert">
                <Text className="font-sans-semibold text-base text-plum">
                  {t("plan.limitTitle")}
                </Text>
                <Text className="font-sans text-base leading-6 text-mist-ink">
                  {t("plan.limitBody")}
                </Text>
                {/* Al techo la salida es la lista de espera, no una suscripción:
                el botón dice «apuntarme a la lista» y no el nombre de Plus,
                porque lo que se ofrece aquí es dejar nombre y correo. */}
                <Link href="/plus" asChild>
                  <Button
                    title={t("plan.limitWaitlistCta")}
                    variant="secondary"
                  />
                </Link>
              </Card>
            ) : null}

            <View className="gap-2 pb-4">
              {/* Lo elegido, en una línea junto al botón: el CTA anclado al
                final de un formulario largo no debería ser un acto de fe. */}
              <Text className="text-center font-sans text-sm text-mist-ink">
                {[
                  t("newPlan.days", { count: duration }),
                  topics.length > 0
                    ? topics
                        .map((key) => t(`onboarding.topics.${key}`))
                        .join(", ")
                    : null,
                  circulo
                    ? null
                    : visibility === "private"
                      ? t("newPlan.visPrivate")
                      : visibility === "circles"
                        ? t("newPlan.visCircles")
                        : visibility === "link"
                          ? t("newPlan.visLink")
                          : t("newPlan.visPublic"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Button
                title={t("newPlan.create")}
                loading={generate.isPending}
                onPress={() => void handleCreate()}
              />
            </View>
          </ScrollView>
        </DawnBackground>
      </KeyboardScreen>
    </>
  );
}
