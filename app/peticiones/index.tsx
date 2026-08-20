import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PrayerRequestCard } from "@/components/PrayerRequestCard";
import { LoadMore } from "@/components/LoadMore";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
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

import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/core/toast/ToastProvider";

/**
 * Prayer requests: the open wall, or one circle's.
 *
 * The open wall is the most exposed surface the app has — sensitive things in
 * front of strangers — so it says plainly that nobody moderates it and points
 * at the two controls that do work there: report, and block.
 */
export default function PrayerRequests() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;
  const { circulo } = useLocalSearchParams<{ circulo?: string }>();

  const {
    data: requests,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usePrayerFeed(circulo);
  const { data: members } = useCircleMembers(circulo);

  const togglePrayer = useTogglePostPrayer(userId);
  const report = useReportPost(userId);
  const block = useBlockUser(userId);
  const hide = useHidePost();
  const markAnswered = useMarkAnswered();
  const remove = useDeletePrayerRequest();

  // Resultados de acción por el toast del sistema, como en el resto de la app.
  const toast = useToast();

  const isAdmin =
    Boolean(circulo) &&
    (members ?? []).some((m) => m.user_id === userId && m.role !== "member");

  const run = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action();
      if (done) toast.success(done);
    } catch {
      toast.error(t("common.errorGeneric"));
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
      <DawnBackground>
        <ScrollView
          contentContainerClassName="flex-grow gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <Text className="font-sans text-base leading-6 text-mist-ink">
            {t("feed.subtitle")}
          </Text>

          {/* Said out loud rather than implied. An open wall with no moderator is
            a real property of this screen, and pretending otherwise would be
            the dishonest version. */}
          {!circulo ? (
            <Text className="font-sans text-sm leading-5 text-mist-ink">
              {t("feed.wallNoAdmin")}
            </Text>
          ) : null}

          {(requests ?? []).length === 0 ? (
            <EmptyState
              title={circulo ? t("feed.emptyCircle") : t("feed.empty")}
              body={t("feed.emptyBody")}
            />
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
                  // El círculo viaja con el enlace: la pantalla de comentarios no
                  // tiene la petición delante y sin esto no podría saber si hay
                  // alguien al mando ahí dentro.
                  params: { id: request.id, circulo },
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

          <LoadMore
            hasMore={hasNextPage}
            loading={isFetchingNextPage}
            onPress={() => void fetchNextPage()}
          />
        </ScrollView>

        {/* Fuera del scroll: pedir oración es a lo que se viene, y estaba al
          final del muro entero — había que recorrer todas las peticiones de
          otros para poder escribir la tuya. */}
        <View
          className="px-7 pt-3 md:w-full md:max-w-read md:self-center"
          style={{ paddingBottom: scrollBottom }}
        >
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
      </DawnBackground>
    </>
  );
}
