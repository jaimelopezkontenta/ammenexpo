import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Card } from "@/components/Card";
import { Txt } from "@/components/ui/Text";
import { DawnBackground } from "@/components/DawnBackground";
import { Orb } from "@/components/Orb";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { useMyCircles } from "@/core/circles/queries";
import { classifyError } from "@/core/net/classifyError";
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
  useMyPlanQuota,
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
  // La cuota, antes del formulario: descubrirla al enviar castigaba a quien
  // ya había elegido temas, duración y círculos.
  const { data: quota } = useMyPlanQuota(userId);
  const remaining = quota ? Math.max(quota.quota_limit - quota.used, 0) : null;
  const exhausted = remaining === 0;

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
  // Lo que falla al generar va arriba, junto a la cuota: el formulario
  // vuelve a montarse tras la espera, arriba del todo, y al pie ese aviso
  // quedaba fuera de vista. Elegir círculo sí se avisa donde se elige.
  const [error, setError] = useState<string | null>(null);
  const [circlesError, setCirclesError] = useState<string | null>(null);
  const [atLimit, setAtLimit] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (error || atLimit) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [error, atLimit]);

  const hasCircles = (circles ?? []).length > 0;

  const handleCreate = async () => {
    setError(null);
    setCirclesError(null);

    if (!circulo && visibility === "circles" && selectedCircles.length === 0) {
      setCirclesError(t("newPlan.chooseCircles"));
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
      setError(
        classifyError(caught) === "network"
          ? t("common.errorNetwork")
          : t("common.errorGeneric"),
      );
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

  // Mientras se escribe el plan, la espera se explica con el orbe trabajando
  // en vez de un spinner dentro de un botón al final de un formulario largo.
  if (generate.isPending) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("newPlan.title"), headerShown: true }}
        />
        <DawnBackground className="items-center justify-center gap-4 px-8">
          <Orb size={120} halo variant="working" />
          <View className="items-center gap-2" accessibilityLiveRegion="polite">
            {/* Un plan de círculo no es «tu plan», ni sale de lo que contaste
                en el onboarding: sale de los temas de este formulario. */}
            <Txt variant="headingLg" className="text-center">
              {circulo
                ? t("newPlan.preparingCircleTitle")
                : t("onboarding.preparingTitle")}
            </Txt>
            <Txt variant="body" tone="secondary" className="text-center">
              {circulo
                ? t("newPlan.preparingCircleBody")
                : t("onboarding.preparingBody")}
            </Txt>
          </View>
        </DawnBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: t("newPlan.title"), headerShown: true }}
      />
      <KeyboardScreen>
        <DawnBackground>
          <ScrollView
            ref={scrollRef}
            contentContainerClassName="gap-8 px-7 py-8 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <Card accessibilityRole="alert">
                <Txt variant="body" tone="danger">
                  {error}
                </Txt>
              </Card>
            ) : null}

            {atLimit && !exhausted ? (
              <Card className="gap-2" accessibilityRole="alert">
                <Txt variant="subheading">{t("plan.limitTitle")}</Txt>
                <Txt variant="body" tone="secondary">
                  {t("plan.limitBody")}
                </Txt>
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

            {exhausted ? (
              <Card className="gap-2" accessibilityRole="alert">
                <Txt variant="subheading">{t("plan.limitTitle")}</Txt>
                <Txt variant="body" tone="secondary">
                  {t("plan.limitBody")}
                </Txt>
                <Link href="/plus" asChild>
                  <Button
                    title={t("plan.limitWaitlistCta")}
                    variant="secondary"
                  />
                </Link>
              </Card>
            ) : quota && remaining !== null ? (
              <Txt variant="caption">
                {t("newPlan.quotaLeft", {
                  count: remaining,
                  total: quota.quota_limit,
                })}
              </Txt>
            ) : null}

            <View className="gap-3">
              <Txt variant="subheadingLg">{t("newPlan.topicQuestion")}</Txt>
              <Txt variant="caption">{t("newPlan.topicHint")}</Txt>
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
              <Txt variant="caption">{t("newPlan.customHint")}</Txt>
            </View>

            <View className="gap-3">
              <Txt variant="subheadingLg">{t("newPlan.durationQuestion")}</Txt>
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
                <Txt variant="subheadingLg">
                  {t("newPlan.visibilityQuestion")}
                </Txt>
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
                  onToggle={(value) => {
                    setCirclesError(null);
                    setVisibility(value as PlanVisibility);
                  }}
                />
                <Txt variant="caption">{visibilityHint}</Txt>

                {visibility === "circles" ? (
                  hasCircles ? (
                    <ChoiceChips
                      options={(circles ?? []).map((circle) => ({
                        value: circle.id,
                        label: circle.name,
                      }))}
                      selected={selectedCircles}
                      onToggle={(value) => {
                        setCirclesError(null);
                        setSelectedCircles((list) =>
                          toggleWithLimit(list, value),
                        );
                      }}
                      multiple
                    />
                  ) : (
                    // Sin círculos esta opción era un callejón: nada que elegir y el
                    // plan bloqueado hasta elegir algo. Mandar a Juntos a crear uno
                    // perdía el formulario a medio rellenar; la salida está aquí
                    // mismo, y es la que el texto ya proponía.
                    <View className="gap-3">
                      <Txt variant="caption">{t("newPlan.noCircles")}</Txt>
                      <Button
                        title={t("newPlan.makePrivate")}
                        variant="secondary"
                        onPress={() => {
                          setCirclesError(null);
                          setVisibility("private");
                        }}
                      />
                    </View>
                  )
                ) : null}

                {circlesError ? (
                  <Txt
                    variant="caption"
                    tone="danger"
                    accessibilityRole="alert"
                  >
                    {circlesError}
                  </Txt>
                ) : null}
              </View>
            )}

            <View className="gap-2 pb-4">
              {/* Lo elegido, en una línea junto al botón: el CTA anclado al
                final de un formulario largo no debería ser un acto de fe. */}
              <Txt variant="caption" className="text-center">
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
              </Txt>
              <Button
                title={t("newPlan.create")}
                loading={generate.isPending}
                disabled={exhausted}
                onPress={() => void handleCreate()}
              />
            </View>
          </ScrollView>
        </DawnBackground>
      </KeyboardScreen>
    </>
  );
}
