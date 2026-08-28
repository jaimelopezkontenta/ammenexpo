import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { POST_MAX, useWritePrayerRequest } from "@/core/posts/queries";

import { Tap } from "@/components/ui/Tap";

export default function NewPrayerRequest() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;
  const { circulo } = useLocalSearchParams<{ circulo?: string }>();

  const write = useWritePrayerRequest(userId);

  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    if (body.trim().length === 0) return;

    setError(null);

    try {
      const result = await write.mutateAsync({
        body,
        isAnonymous,
        circleId: circulo,
      });

      // B1b: nunca se enseña como si se hubiera publicado con normalidad.
      if (result.crisisFlagged) {
        router.replace("/crisis");
        return;
      }

      router.replace({
        pathname: "/peticiones",
        params: circulo ? { circulo } : {},
      });
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("feed.newPost"), headerShown: true }} />
      <KeyboardScreen>
        <DawnBackground>
          <ScrollView
            contentContainerClassName="flex-grow gap-6 px-7 py-8 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            keyboardShouldPersistTaps="handled"
          >
            <TextField
              label={t("feed.body")}
              value={body}
              onChangeText={setBody}
              placeholder={t("feed.placeholder")}
              maxLength={POST_MAX}
              multiline
            />

            <View className="gap-2">
              <Tap
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isAnonymous }}
                aria-checked={isAnonymous}
                accessibilityLabel={t("feed.anonymous")}
                onPress={() => setIsAnonymous((current) => !current)}
                className={`rounded-input border px-4 py-3.5 ${
                  isAnonymous
                    ? "border-plum bg-plum-chip"
                    : "border-glassedge/60 bg-dawn-cream-bg"
                }`}
              >
                <Txt
                  variant="body"
                  tone={isAnonymous ? "onDark" : "secondary"}
                  className={isAnonymous ? "font-sans-semibold" : ""}
                >
                  {t("feed.anonymous")}
                </Txt>
              </Tap>

              {/* The cost is stated before the choice, not after: without a name
              there is no id to block either, and somebody deciding to post
              anonymously deserves to know that cuts both ways. */}
              {isAnonymous ? (
                <Txt variant="caption">{t("feed.anonymousHint")}</Txt>
              ) : null}
            </View>

            {error ? (
              <Txt variant="caption" tone="danger" accessibilityRole="alert">
                {error}
              </Txt>
            ) : null}

            <View className="mt-auto gap-2 pt-6">
              {/* Lo elegido, dicho junto al botón: publicar con o sin nombre
                no debería depender de recordar un toggle más arriba. */}
              <Txt variant="caption" className="text-center">
                {isAnonymous
                  ? t("feed.summaryAnonymous")
                  : t("feed.summaryNamed")}
              </Txt>
              <Button
                title={t("feed.publish")}
                disabled={body.trim().length === 0}
                loading={write.isPending}
                onPress={() => void handlePublish()}
              />
            </View>
          </ScrollView>
        </DawnBackground>
      </KeyboardScreen>
    </>
  );
}
