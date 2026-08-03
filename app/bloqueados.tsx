import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useMyBlocks, useUnblockUser } from "@/core/moderation/blocks";

/**
 * Without this screen, blocking is one-way.
 *
 * The gesture is meant to be easy and available in the moment — from a message,
 * from the roster — which is exactly why there has to be somewhere calm to undo
 * it later. A block made in anger with no way back is its own trap.
 */
export default function BlockedPeople() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: blocks, isLoading, isError, refetch } = useMyBlocks(userId);
  const unblock = useUnblockUser(userId);

  const [error, setError] = useState<string | null>(null);

  const handleUnblock = async (blockedId: string) => {
    setError(null);

    try {
      await unblock.mutateAsync(blockedId);
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ title: t("moderation.blockedTitle"), headerShown: true }}
      />

      {isLoading ? <LoadingState variant="radial" /> : null}

      {isError ? (
        <ErrorState variant="radial" onRetry={() => void refetch()} />
      ) : null}

      {!isLoading && !isError ? (
        <DawnBackground variant="radial">
          <ScrollView contentContainerClassName="gap-4 px-7 py-8">
            <Text className="font-sans text-base leading-6 text-mist-ink">
              {t("moderation.blockedHint")}
            </Text>

            {error ? (
              <Text
                className="font-sans text-sm text-danger"
                accessibilityRole="alert"
              >
                {error}
              </Text>
            ) : null}

            {(blocks ?? []).length === 0 ? (
              <Text className="font-sans text-base text-mist-ink">
                {t("moderation.blockedEmpty")}
              </Text>
            ) : null}

            {(blocks ?? []).map((entry) => (
              <View
                key={entry.blocked_id}
                className="flex-row items-center justify-between"
              >
                <Text className="font-sans text-base text-plum">
                  {entry.display_name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("moderation.unblock")} ${entry.display_name}`}
                  onPress={() => void handleUnblock(entry.blocked_id)}
                >
                  <Text className="font-sans text-sm text-mist-ink">
                    {t("moderation.unblock")}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </DawnBackground>
      ) : null}
    </>
  );
}
