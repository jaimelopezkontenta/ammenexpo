import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PrayerRequestCard } from "@/components/PrayerRequestCard";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useCircleMembers } from "@/core/circles/queries";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  useDeletePrayerRequest,
  useHidePost,
  useMarkAnswered,
  usePrayerFeed,
  useReportPost,
  useTogglePostPrayer,
} from "@/core/posts/queries";

/**
 * Prayer requests: the open wall, or one circle's.
 *
 * The open wall is the most exposed surface the app has — sensitive things in
 * front of strangers — so it says plainly that nobody moderates it and points
 * at the two controls that do work there: report, and block.
 */
export default function PrayerRequests() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const { circulo } = useLocalSearchParams<{ circulo?: string }>();

  const {
    data: requests,
    isLoading,
    isError,
    refetch,
  } = usePrayerFeed(circulo);
  const { data: members } = useCircleMembers(circulo);

  const togglePrayer = useTogglePostPrayer(userId);
  const report = useReportPost(userId);
  const block = useBlockUser(userId);
  const hide = useHidePost();
  const markAnswered = useMarkAnswered();
  const remove = useDeletePrayerRequest();

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin =
    Boolean(circulo) &&
    (members ?? []).some((m) => m.user_id === userId && m.role !== "member");

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setError(null);
    setNotice(null);

    try {
      await action();
      if (done) setNotice(done);
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const title = circulo ? t("feed.circleTitle") : t("feed.title");

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title, headerShown: true }} />
        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen options={{ title, headerShown: true }} />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title, headerShown: true }} />
      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="flex-grow gap-5 px-7 py-8"
      >
        <Text className="text-base leading-6 text-ink-muted">
          {t("feed.subtitle")}
        </Text>

        {/* Said out loud rather than implied. An open wall with no moderator is
            a real property of this screen, and pretending otherwise would be
            the dishonest version. */}
        {!circulo ? (
          <Text className="text-sm leading-5 text-ink-soft">
            {t("feed.wallNoAdmin")}
          </Text>
        ) : null}

        {notice ? (
          <Text
            className="text-sm text-ink-muted"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {notice}
          </Text>
        ) : null}

        {error ? (
          <Text className="text-sm text-red-500" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {(requests ?? []).length === 0 ? (
          <View className="gap-2 py-6">
            <Text className="text-lg font-semibold text-ink-muted">
              {circulo ? t("feed.emptyCircle") : t("feed.empty")}
            </Text>
            <Text className="text-base leading-6 text-ink-muted">
              {t("feed.emptyBody")}
            </Text>
          </View>
        ) : null}

        {(requests ?? []).map((request) => (
          <PrayerRequestCard
            key={request.id}
            request={request}
            canHide={isAdmin}
            onTogglePrayer={() =>
              void run(() =>
                togglePrayer.mutateAsync({
                  postId: request.id,
                  prayed: request.i_prayed,
                }),
              )
            }
            onOpen={() =>
              router.push({
                pathname: "/peticiones/[id]",
                params: { id: request.id },
              })
            }
            onReport={() =>
              void run(
                () => report.mutateAsync({ id: request.id, kind: "post" }),
                t("moderation.reportDone"),
              )
            }
            onBlock={(blockedId) =>
              void run(
                () => block.mutateAsync(blockedId),
                t("moderation.blockDone"),
              )
            }
            onHide={() =>
              void run(
                () => hide.mutateAsync(request.id),
                t("moderation.hideDone"),
              )
            }
            onMarkAnswered={() =>
              void run(() => markAnswered.mutateAsync(request.id))
            }
            onDelete={() => void run(() => remove.mutateAsync(request.id))}
          />
        ))}

        <View className="mt-auto pt-6">
          <Button
            title={t("feed.newPost")}
            onPress={() =>
              router.push({
                pathname: "/peticiones/nueva",
                params: circulo ? { circulo } : {},
              })
            }
          />
        </View>
      </ScrollView>
    </>
  );
}
