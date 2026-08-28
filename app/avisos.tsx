import { Link } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { LoadMore } from "@/components/LoadMore";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/core/notifications/queries";

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
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data,
    isLoading,
    isError,
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

  if (isLoading) {
    return <ScreenScaffold title={t("notifications.title")} loading />;
  }

  if (isError) {
    return (
      <ScreenScaffold
        title={t("notifications.title")}
        error
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <ScreenScaffold
      title={t("notifications.title")}
      contentClassName="flex-grow gap-4"
    >
      {(data ?? []).length === 0 ? (
        <EmptyState title={t("notifications.empty")} />
      ) : (
        (data ?? []).map((entry) => {
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
            <Link
              key={entry.id}
              href={{ pathname: "/persona/[id]", params: { id: who } }}
              asChild
            >
              <ListRow accessibilityRole="link" {...props} />
            </Link>
          ) : (
            <ListRow key={entry.id} disabled chevron={false} {...props} />
          );
        })
      )}

      <LoadMore
        hasMore={hasNextPage}
        loading={isFetchingNextPage}
        onPress={() => void fetchNextPage()}
      />
    </ScreenScaffold>
  );
}
