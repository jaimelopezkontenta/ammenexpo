import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { POST_MAX, useWritePrayerRequest } from "@/core/posts/queries";

export default function NewPrayerRequest() {
  const { t } = useTranslation();
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
      await write.mutateAsync({ body, isAnonymous, circleId: circulo });
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
      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="flex-grow gap-6 px-7 py-8"
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
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isAnonymous }}
            aria-checked={isAnonymous}
            accessibilityLabel={t("feed.anonymous")}
            onPress={() => setIsAnonymous((current) => !current)}
            className={`rounded-2xl border px-4 py-3.5 ${
              isAnonymous ? "border-ink bg-ink" : "border-ink-line bg-paper"
            }`}
          >
            <Text
              className={
                isAnonymous
                  ? "text-base font-semibold text-paper"
                  : "text-base text-ink-muted"
              }
            >
              {t("feed.anonymous")}
            </Text>
          </Pressable>

          {/* The cost is stated before the choice, not after: without a name
              there is no id to block either, and somebody deciding to post
              anonymously deserves to know that cuts both ways. */}
          {isAnonymous ? (
            <Text className="text-sm leading-5 text-ink-muted">
              {t("feed.anonymousHint")}
            </Text>
          ) : null}
        </View>

        {error ? (
          <Text className="text-sm text-red-500" accessibilityRole="alert">
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
    </>
  );
}
