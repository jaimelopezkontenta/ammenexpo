import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
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
              <Text
                className={
                  isAnonymous
                    ? "font-sans-semibold text-base text-white"
                    : "text-base text-mist-ink"
                }
              >
                {t("feed.anonymous")}
              </Text>
            </Tap>

            {/* The cost is stated before the choice, not after: without a name
              there is no id to block either, and somebody deciding to post
              anonymously deserves to know that cuts both ways. */}
            {isAnonymous ? (
              <Text className="font-sans text-sm leading-5 text-mist-ink">
                {t("feed.anonymousHint")}
              </Text>
            ) : null}
          </View>

          {error ? (
            <Text
              className="font-sans text-sm text-danger"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}

          <View className="mt-auto pt-6">
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
