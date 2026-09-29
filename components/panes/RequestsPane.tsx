import { router } from "expo-router";
import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, type ListRenderItem, View } from "react-native";

import { useBlockConfirm } from "@/components/BlockConfirm";
import { Button } from "@/components/Button";
import { PrayerRequestCard } from "@/components/PrayerRequestCard";
import { LoadMore } from "@/components/LoadMore";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useCircleMembers } from "@/core/circles/queries";
import { useFeatureFlag } from "@/core/flags/useFeatureFlag";
import { useBlockUser } from "@/core/moderation/blocks";
import { END_REACHED_THRESHOLD, rowId, useLoadMoreOnEnd } from "@/core/paging";
import {
  type PrayerRequest,
  useDeletePrayerRequest,
  useHidePost,
  useMarkAnswered,
  usePrayerFeed,
  useReportPost,
  useTogglePostPrayer,
} from "@/core/posts/queries";
import { useAction } from "@/core/toast/useAction";

import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";

const NO_REQUESTS: PrayerRequest[] = [];

/**
 * Lo que una tarjeta puede pedir, con el id por argumento: un solo objeto para
 * todas las filas. Con un cierre nuevo por fila y por render, `memo` no
 * serviría de nada — cada tarjeta recibiría props distintas siempre.
 */
type RequestActions = {
  togglePrayer: (id: string, prayed: boolean) => void;
  open: (id: string) => void;
  report: (id: string) => void;
  block: (userId: string, name: string) => void;
  hide: (id: string) => void;
  markAnswered: (id: string) => void;
  remove: (id: string) => void;
};

/**
 * Una petición del muro. Solo se vuelve a pintar si cambia ella (React Query
 * conserva la misma fila si el refresco la trae igual) o si cambia quién
 * manda: orar en una no repinta las otras treinta.
 */
const RequestRow = memo(function RequestRow({
  request,
  canHide,
  actions,
}: {
  request: PrayerRequest;
  canHide: boolean;
  actions: RequestActions;
}) {
  return (
    <PrayerRequestCard
      request={request}
      canHide={canHide}
      onTogglePrayer={() => actions.togglePrayer(request.id, request.i_prayed)}
      onOpen={() => actions.open(request.id)}
      onReport={() => actions.report(request.id)}
      onBlock={actions.block}
      onHide={() => actions.hide(request.id)}
      onMarkAnswered={() => actions.markAnswered(request.id)}
      onDelete={() => actions.remove(request.id)}
    />
  );
});

/**
 * Prayer requests: the open wall, or one circle's — the content, without the
 * screen around it. It sits in two places: the /peticiones route (with its
 * stack header) and the Peticiones segment of the Juntos tab.
 *
 * The open wall is the most exposed surface the app has — sensitive things in
 * front of strangers — so it says plainly that nobody moderates it and points
 * at the two controls that do work there: report, and block.
 *
 * Una `FlatList` y no un `ScrollView` con `.map`: el muro solo crece, y con
 * cada «Ver más» se montaban treinta tarjetas más que nadie estaba mirando.
 */
export const RequestsPane = ({ circulo }: { circulo?: string }) => {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: requests,
    isLoading,
    isLoadingError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usePrayerFeed(circulo);
  const { data: members } = useCircleMembers(circulo);
  // El muro abierto también cuelga de `community_feed`: apagado, el servidor lo
  // devuelve vacío y «Puedes ser quien empiece» invitaría a escribir en un
  // sitio cerrado. `unknown` (cargando, o la lectura falló) no cuenta como apagado.
  const communityFlag = useFeatureFlag("community_feed");
  const wallClosed = !circulo && communityFlag === "off";

  // `mutateAsync` es estable entre renders; el objeto de la mutación no.
  const { mutateAsync: togglePrayer } = useTogglePostPrayer(userId);
  const { mutateAsync: report } = useReportPost(userId);
  const { mutateAsync: block } = useBlockUser(userId);
  const { mutateAsync: hide } = useHidePost();
  const { mutateAsync: markAnswered } = useMarkAnswered();
  const { mutateAsync: remove } = useDeletePrayerRequest();

  // Resultados de acción por el toast del sistema, como en el resto de la app.
  const { run } = useAction();

  const isAdmin =
    Boolean(circulo) &&
    (members ?? []).some((m) => m.user_id === userId && m.role !== "member");

  // Bloquear pregunta antes: en la tarjeta estaba al lado de «Reportar» y
  // bastaba un toque suelto para perder de vista a alguien en toda la app.
  const { ask: askBlock, dialog: blockDialog } = useBlockConfirm(
    (blockedId) => void run(() => block(blockedId), t("moderation.blockDone")),
  );

  const actions = useMemo<RequestActions>(
    () => ({
      togglePrayer: (id, prayed) =>
        void run(() => togglePrayer({ postId: id, prayed })),
      open: (id) =>
        router.push({
          pathname: "/peticiones/[id]",
          // El círculo viaja con el enlace: la pantalla de comentarios no
          // tiene la petición delante y sin esto no podría saber si hay
          // alguien al mando ahí dentro.
          params: { id, circulo },
        }),
      report: (id) =>
        void run(
          () => report({ id, kind: "post" }),
          t("moderation.reportDone"),
        ),
      block: askBlock,
      hide: (id) => void run(() => hide(id), t("moderation.hideContentDone")),
      markAnswered: (id) => void run(() => markAnswered(id)),
      remove: (id) => void run(() => remove(id)),
    }),
    [
      run,
      togglePrayer,
      circulo,
      report,
      t,
      askBlock,
      hide,
      markAnswered,
      remove,
    ],
  );

  const renderItem = useCallback<ListRenderItem<PrayerRequest>>(
    ({ item }) => (
      <RequestRow request={item} canHide={isAdmin} actions={actions} />
    ),
    [isAdmin, actions],
  );

  const loadMore = useLoadMoreOnEnd({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isLoadingError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <>
      <FlatList
        data={requests ?? NO_REQUESTS}
        keyExtractor={rowId}
        renderItem={renderItem}
        contentContainerClassName="flex-grow gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center md:px-10"
        contentContainerStyle={{ paddingBottom: scrollBottom }}
        onEndReached={loadMore}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
        ListHeaderComponent={
          <View className="gap-5">
            <Txt variant="body" tone="secondary">
              {t("feed.subtitle")}
            </Txt>

            {/* Said out loud rather than implied. An open wall with no
                moderator is a real property of this screen, and pretending
                otherwise would be the dishonest version. */}
            {!circulo ? (
              <Txt variant="caption">{t("feed.wallNoAdmin")}</Txt>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              circulo
                ? t("feed.emptyCircle")
                : wallClosed
                  ? t("community.closedTitle")
                  : t("feed.empty")
            }
            body={wallClosed ? t("community.closedBody") : t("feed.emptyBody")}
          />
        }
        // Sin más páginas no hay pie: una celda vacía se llevaría su hueco.
        ListFooterComponent={
          hasNextPage ? (
            <LoadMore
              hasMore={hasNextPage}
              loading={isFetchingNextPage}
              onPress={() => void fetchNextPage()}
            />
          ) : null
        }
      />

      {/* Fuera del scroll: pedir oración es a lo que se viene, y estaba al
        final del muro entero — había que recorrer todas las peticiones de
        otros para poder escribir la tuya. */}
      <View
        className="px-7 pt-3 md:w-full md:max-w-read md:self-center md:px-10"
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

      {blockDialog}
    </>
  );
};
