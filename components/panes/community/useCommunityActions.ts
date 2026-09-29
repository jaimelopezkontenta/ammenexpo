import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBlockConfirm } from "@/components/BlockConfirm";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  useDeletePrayerRequest,
  useMarkAnswered,
  useReportPost,
  useTogglePostPrayer,
} from "@/core/posts/queries";
import type { FeedKind } from "@/core/social/feed";
import { useFollowUser, useUnfollowUser } from "@/core/social/follows";
import { useReportTestimony } from "@/core/testimonies/queries";
import { useAction } from "@/core/toast/useAction";

/**
 * Lo que una fila del feed puede pedir, con el id por argumento: un solo
 * objeto estable para todas, así las filas memorizadas no se repintan porque
 * sí. Con un cierre nuevo por fila y por render, `memo` no serviría de nada.
 */
export type CommunityActions = {
  togglePrayer: (id: string, prayed: boolean) => void;
  openRequest: (id: string) => void;
  reportPost: (id: string) => void;
  /** Un testimonio o un plan: cada uno se reporta por su puerta. */
  reportStory: (kind: FeedKind, id: string) => void;
  /** Bloquear pregunta antes, venga de una petición o de un testimonio. */
  askBlock: (userId: string, name: string) => void;
  markAnswered: (id: string) => void;
  remove: (id: string) => void;
};

/**
 * Los gestos de Comunidad: orar, reportar, bloquear, seguir…
 *
 * Lo que sale bien y lo que falla va por el toast del sistema (`useAction`),
 * que además distingue «sin conexión» de «algo salió mal». Antes eran dos
 * líneas en línea encima de la lista que la empujaban hacia abajo justo en el
 * momento de tocar.
 */
export const useCommunityActions = (
  userId: string | undefined,
  refetchPeople: () => unknown,
) => {
  const { t } = useTranslation();
  const { run } = useAction();

  // `mutateAsync` es estable entre renders; el objeto de la mutación no.
  const { mutateAsync: togglePrayer } = useTogglePostPrayer(userId);
  const { mutateAsync: reportPost } = useReportPost(userId);
  const { mutateAsync: reportTestimony } = useReportTestimony(userId);
  const { mutateAsync: block } = useBlockUser(userId);
  const { mutateAsync: markAnswered } = useMarkAnswered();
  const { mutateAsync: remove } = useDeletePrayerRequest();
  const { mutateAsync: follow } = useFollowUser();
  const { mutateAsync: unfollow } = useUnfollowUser();

  // Una sola mutación para todas las tarjetas: sin saber cuál está en vuelo,
  // pulsar dos seguidas dejaría las dos con el indicador puesto.
  const [pendingFollow, setPendingFollow] = useState<string | null>(null);

  const { ask: askBlock, dialog: blockDialog } = useBlockConfirm(
    (blockedId) => void run(() => block(blockedId), t("moderation.blockDone")),
  );

  // Orar, marcar y borrar ya refrescan el feed desde la propia mutación
  // (`invalidateFeeds`): el `feed.refetch()` que venía detrás pedía todas las
  // páginas por segunda vez.
  const actions = useMemo<CommunityActions>(
    () => ({
      togglePrayer: (id, prayed) =>
        void run(() => togglePrayer({ postId: id, prayed })),
      openRequest: (id) =>
        router.push({ pathname: "/peticiones/[id]", params: { id } }),
      reportPost: (id) =>
        void run(
          () => reportPost({ id, kind: "post" }),
          t("moderation.reportDone"),
        ),
      reportStory: (kind, id) =>
        void run(
          () =>
            kind === "testimony"
              ? reportTestimony(id)
              : reportPost({ id, kind: "post" }),
          t("moderation.reportDone"),
        ),
      askBlock,
      markAnswered: (id) => void run(() => markAnswered(id)),
      remove: (id) => void run(() => remove(id)),
    }),
    [
      run,
      togglePrayer,
      reportPost,
      reportTestimony,
      t,
      askBlock,
      markAnswered,
      remove,
    ],
  );

  const onFollow = useCallback(
    async (targetId: string, following: boolean) => {
      if (!userId) return;

      setPendingFollow(targetId);
      await run(async () => {
        const input = { userId, targetId };
        if (following) {
          await unfollow(input);
        } else {
          await follow(input);
        }
        void refetchPeople();
      });
      setPendingFollow(null);
    },
    [userId, run, follow, unfollow, refetchPeople],
  );

  return { actions, onFollow, pendingFollow, blockDialog };
};
