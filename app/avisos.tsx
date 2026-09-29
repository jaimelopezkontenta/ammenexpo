import { Link } from "expo-router";
import { memo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, type ListRenderItem } from "react-native";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { LoadMore } from "@/components/LoadMore";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useSession } from "@/core/auth/SessionProvider";
import {
  type AppNotification,
  useMarkNotificationsRead,
  useNotifications,
} from "@/core/notifications/queries";
import { END_REACHED_THRESHOLD, rowId, useLoadMoreOnEnd } from "@/core/paging";

const NO_NOTIFICATIONS: AppNotification[] = [];

/**
 * Un aviso. Memorizado: la lista se vuelve a pintar al llegar cada página y al
 * marcarse todo como leído, y solo deben repintarse las filas que cambian.
 */
const NotificationRow = memo(function NotificationRow({
  entry,
}: {
  entry: AppNotification;
}) {
  const { t, i18n } = useTranslation();
  const name = entry.payload.intercessor_name ?? "";
  const who = entry.payload.intercessor_id;
  const props = {
    leading: <Avatar name={name} seed={who ?? entry.id} size={36} />,
    title: t("notifications.prayedForYou", {
      name,
      planTitle: entry.payload.plan_title ?? "",
    }),
    meta: new Date(entry.created_at).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "long",
    }),
    // Sin leer, y sin contarlo: el número exacto no ayuda a nadie
    // dentro de una lista que se acaba de marcar entera.
    dot: !entry.read_at,
  };

  // A dónde lleva un aviso: al perfil de quien oró. Sin autor (aviso
  // anónimo o borrado) la fila es informativa: sin chevron y sin tap.
  return who ? (
    <Link href={{ pathname: "/persona/[id]", params: { id: who } }} asChild>
      <ListRow accessibilityRole="link" {...props} />
    </Link>
  ) : (
    <ListRow disabled chevron={false} {...props} />
  );
});

const renderNotification: ListRenderItem<AppNotification> = ({ item }) => (
  <NotificationRow entry={item} />
);

/**
 * Los avisos.
 *
 * La tabla lleva llenándose desde la Fase 1 —una fila por cada persona que ora
 * por ti, con su nombre dentro— y nunca la había leído nadie. Esto no es una
 * función nueva: es desenterrar algo que ya estaba pasando.
 *
 * Y es la lista que en Hoy no existe: allí solo se ve quién oró **hoy**, así que
 * cada medianoche el producto olvidaba a todos los de ayer.
 */
export default function Notifications() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data,
    isLoading,
    isLoadingError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useNotifications(userId);
  const markRead = useMarkNotificationsRead(userId);

  // Al abrir, y una sola vez: entrar aquí es haberlos visto. `mutate` y no
  // `mutateAsync` a propósito — si falla, lo peor que pasa es que el punto
  // sigue puesto, y eso no merece un mensaje de error encima de la lista.
  useEffect(() => {
    if (userId) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadMore = useLoadMoreOnEnd({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });
  const loadMorePressed = useCallback(
    () => void fetchNextPage(),
    [fetchNextPage],
  );

  if (isLoading) {
    return <ScreenScaffold title={t("notifications.title")} loading />;
  }

  if (isLoadingError) {
    return (
      <ScreenScaffold
        title={t("notifications.title")}
        error
        cause={error}
        onRetry={() => void refetch()}
      />
    );
  }

  // `scroll={false}`: la lista es virtualizada y trae su propio scroll. Las
  // clases del contenedor son las mismas que el andamio pone a su ScrollView.
  return (
    <ScreenScaffold title={t("notifications.title")} scroll={false}>
      <FlatList
        data={data ?? NO_NOTIFICATIONS}
        keyExtractor={rowId}
        renderItem={renderNotification}
        contentContainerClassName="gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center flex-grow gap-4"
        contentContainerStyle={{ paddingBottom: scrollBottom }}
        onEndReached={loadMore}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
        ListEmptyComponent={<EmptyState title={t("notifications.empty")} />}
        // Sin más páginas no hay pie: una celda vacía se llevaría su hueco.
        ListFooterComponent={
          hasNextPage ? (
            <LoadMore
              hasMore={hasNextPage}
              loading={isFetchingNextPage}
              onPress={loadMorePressed}
            />
          ) : null
        }
      />
    </ScreenScaffold>
  );
}
