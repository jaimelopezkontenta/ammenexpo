import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { useMyCircles } from "@/core/circles/queries";
import {
  PlanLimitReached,
  useGeneratePlan,
  type PlanVisibility,
} from "@/core/plans/queries";

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

const DURATIONS = [7, 14, 21, 30];
const CUSTOM_TOPIC_MAX = 200;

export default function NewPlan() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  // Set when this form was opened from a circle: the plan belongs to the
  // circle rather than to the person filling it in.
  const { circulo } = useLocalSearchParams<{ circulo?: string }>();

  const { data: circles } = useMyCircles(userId);
  const generate = useGeneratePlan(userId);

  const [topics, setTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [duration, setDuration] = useState(7);
  const [visibility, setVisibility] = useState<PlanVisibility>("private");
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  const hasCircles = (circles ?? []).length > 0;

  const toggle = (list: string[], value: string) =>
    list.includes(value)
      ? list.filter((entry) => entry !== value)
      : [...list, value];

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

      setAtLimit(false);
      setError(t("common.errorGeneric"));
    }
  };

  const visibilityHint =
    visibility === "private"
      ? t("newPlan.visPrivateHint")
      : visibility === "circles"
        ? t("newPlan.visCirclesHint")
        : t("newPlan.visLinkHint");

  return (
    <>
      <Stack.Screen
        options={{ title: t("newPlan.title"), headerShown: true }}
      />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-8 px-7 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-3">
          <Text className="text-lg font-semibold text-slate-900">
            {t("newPlan.topicQuestion")}
          </Text>
          <Text className="text-sm text-slate-500">
            {t("newPlan.topicHint")}
          </Text>
          <ChoiceChips
            options={TOPIC_KEYS.map((key) => ({
              value: key,
              label: t(`onboarding.topics.${key}`),
            }))}
            selected={topics}
            onToggle={(value) => setTopics((list) => toggle(list, value))}
            multiple
          />
        </View>

        <View className="gap-2">
          <TextField
            label={t("newPlan.customLabel")}
            value={customTopic}
            onChangeText={setCustomTopic}
            placeholder={t("newPlan.customPlaceholder")}
            maxLength={CUSTOM_TOPIC_MAX}
            multiline
          />
          <Text className="text-sm text-slate-500">
            {t("newPlan.customHint")}
          </Text>
        </View>

        <View className="gap-3">
          <Text className="text-lg font-semibold text-slate-900">
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
            <Text className="text-lg font-semibold text-slate-900">
              {t("newPlan.visibilityQuestion")}
            </Text>
            <ChoiceChips
              options={[
                { value: "private", label: t("newPlan.visPrivate") },
                { value: "circles", label: t("newPlan.visCircles") },
                { value: "link", label: t("newPlan.visLink") },
              ]}
              selected={[visibility]}
              onToggle={(value) => setVisibility(value as PlanVisibility)}
            />
            <Text className="text-sm text-slate-500">{visibilityHint}</Text>

            {visibility === "circles" ? (
              hasCircles ? (
                <ChoiceChips
                  options={(circles ?? []).map((circle) => ({
                    value: circle.id,
                    label: circle.name,
                  }))}
                  selected={selectedCircles}
                  onToggle={(value) =>
                    setSelectedCircles((list) => toggle(list, value))
                  }
                  multiple
                />
              ) : (
                // Without a way out this option is a dead end: nothing to pick,
                // and creating the plan is blocked on picking something.
                <View className="gap-3">
                  <Text className="text-sm text-slate-500">
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
          <Text className="text-sm text-red-500" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {atLimit ? (
          <View
            className="gap-2 rounded-2xl bg-slate-50 p-5"
            accessibilityRole="alert"
          >
            <Text className="text-base font-semibold text-slate-900">
              {t("plan.limitTitle")}
            </Text>
            <Text className="text-base leading-6 text-slate-600">
              {t("plan.limitBody")}
            </Text>
            <Link href="/plus" asChild>
              <Button title={t("paywall.title")} variant="secondary" />
            </Link>
          </View>
        ) : null}

        <View className="pb-4">
          <Button
            title={t("newPlan.create")}
            loading={generate.isPending}
            onPress={() => void handleCreate()}
          />
        </View>
      </ScrollView>
    </>
  );
}
