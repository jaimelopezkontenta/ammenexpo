import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

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

      {isLoading ? <LoadingState /> : null}

      {isError ? <ErrorState onRetry={() => void refetch()} /> : null}

      {!isLoading && !isError ? (
        <ScrollView
          className="flex-1 bg-paper"
          contentContainerClassName="gap-4 px-7 py-8"
        >
          <Text className="text-base leading-6 text-ink-muted">
            {t("moderation.blockedHint")}
          </Text>

          {error ? (
            <Text className="text-sm text-red-500" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          {(blocks ?? []).length === 0 ? (
            <Text className="text-base text-ink-muted">
              {t("moderation.blockedEmpty")}
            </Text>
          ) : null}

          {(blocks ?? []).map((entry) => (
            <View
              key={entry.blocked_id}
              className="flex-row items-center justify-between"
            >
              <Text className="text-base text-ink">{entry.display_name}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("moderation.unblock")} ${entry.display_name}`}
                onPress={() => void handleUnblock(entry.blocked_id)}
              >
                <Text className="text-sm text-ink-soft">
                  {t("moderation.unblock")}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </>
  );
}
