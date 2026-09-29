import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useMyBlocks, useUnblockUser } from "@/core/moderation/blocks";

import { Tap } from "@/components/ui/Tap";

/**
 * Without this screen, blocking is one-way.
 *
 * The gesture is meant to be easy and available in the moment — from a message,
 * from the roster — which is exactly why there has to be somewhere calm to undo
 * it later. A block made in anger with no way back is its own trap.
 */
export default function BlockedPeople() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: blocks,
    isLoading,
    isLoadingError,
    refetch,
  } = useMyBlocks(userId);
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

      {isLoadingError ? <ErrorState onRetry={() => void refetch()} /> : null}

      {!isLoading && !isLoadingError ? (
        <DawnBackground>
          <ScrollView
            contentContainerClassName="gap-4 px-7 py-8 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
          >
            <Txt variant="body" tone="secondary">
              {t("moderation.blockedHint")}
            </Txt>

            {error ? (
              <Txt variant="caption" tone="danger" accessibilityRole="alert">
                {error}
              </Txt>
            ) : null}

            {(blocks ?? []).length === 0 ? (
              <EmptyState title={t("moderation.blockedEmpty")} />
            ) : null}

            {(blocks ?? []).map((entry) => (
              <View
                key={entry.blocked_id}
                className="flex-row items-center justify-between"
              >
                <Txt variant="body">{entry.display_name}</Txt>
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel={`${t("moderation.unblock")} ${entry.display_name}`}
                  onPress={() => void handleUnblock(entry.blocked_id)}
                >
                  <Txt variant="caption">{t("moderation.unblock")}</Txt>
                </Tap>
              </View>
            ))}
          </ScrollView>
        </DawnBackground>
      ) : null}
    </>
  );
}
