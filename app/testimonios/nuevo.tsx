import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { usePlanSummary } from "@/core/plans/sharing";
import {
  TESTIMONY_MAX,
  useWriteTestimony,
  type TestimonyVisibility,
} from "@/core/testimonies/queries";

/**
 * Answered prayer.
 *
 * Reached from the screen that closes a plan — the moment with the most
 * intention the product has — and from the testimonies list.
 *
 * The visibility picker defaults to circles and says what each option means
 * before anything is written. The table used to default to public, which is a
 * surprise nobody forgives on the most intimate thing somebody has typed here.
 */
export default function NewTestimony() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;
  const { plan: planId, listItem: listItemId } = useLocalSearchParams<{
    plan?: string;
    listItem?: string;
  }>();

  const { data: plan } = usePlanSummary(planId);
  const write = useWriteTestimony(userId);

  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<TestimonyVisibility>("circles");
  const [error, setError] = useState<string | null>(null);

  const hint =
    visibility === "private"
      ? t("testimony.visPrivateHint")
      : visibility === "circles"
        ? t("testimony.visCirclesHint")
        : t("testimony.visPublicHint");

  const handleSave = async () => {
    if (body.trim().length === 0) return;

    setError(null);

    try {
      await write.mutateAsync({ body, visibility, planId, listItemId });
      router.replace("/testimonios");
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ title: t("testimony.title"), headerShown: true }}
      />
      <KeyboardScreen>
        <DawnBackground>
          <ScrollView
            contentContainerClassName="flex-grow gap-6 px-7 py-8 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            keyboardShouldPersistTaps="handled"
          >
            {plan ? (
              <Txt variant="caption">
                {t("testimony.duringPlan", { title: plan.title })}
              </Txt>
            ) : null}

            <View className="gap-2">
              <TextField
                label={t("testimony.body")}
                value={body}
                onChangeText={setBody}
                placeholder={t("testimony.placeholder")}
                maxLength={TESTIMONY_MAX}
                multiline
              />
            </View>

            <View className="gap-3">
              <Txt variant="subheadingLg">{t("testimony.whoSees")}</Txt>
              <ChoiceChips
                options={[
                  { value: "private", label: t("testimony.visPrivate") },
                  { value: "circles", label: t("testimony.visCircles") },
                  { value: "public", label: t("testimony.visPublic") },
                ]}
                selected={[visibility]}
                onToggle={(value) =>
                  setVisibility(value as TestimonyVisibility)
                }
              />
              <Txt variant="caption">{hint}</Txt>
            </View>

            {error ? (
              <Txt variant="caption" tone="danger" accessibilityRole="alert">
                {error}
              </Txt>
            ) : null}

            <View className="mt-auto gap-2 pt-6">
              {/* Quién lo verá, dicho junto al botón: la elección de arriba no
                debería exigir memoria al llegar abajo. */}
              <Txt variant="caption" className="text-center">
                {visibility === "private"
                  ? t("testimony.visPrivate")
                  : visibility === "circles"
                    ? t("testimony.visCircles")
                    : t("testimony.visPublic")}
              </Txt>
              <Button
                title={t("testimony.save")}
                disabled={body.trim().length === 0}
                loading={write.isPending}
                onPress={() => void handleSave()}
              />
            </View>
          </ScrollView>
        </DawnBackground>
      </KeyboardScreen>
    </>
  );
}
