import { Link, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, type ListRenderItem, View } from "react-native";

import { useBlockConfirm } from "@/components/BlockConfirm";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";
import { LoadMore } from "@/components/LoadMore";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import {
  TestimonyCard,
  type TestimonyActions,
} from "@/components/TestimonyCard";
import { useSession } from "@/core/auth/SessionProvider";
import { buildShareUrl, shareOrCopy } from "@/core/share";
import { useBlockUser } from "@/core/moderation/blocks";
import { END_REACHED_THRESHOLD, rowId, useLoadMoreOnEnd } from "@/core/paging";
import {
  type Testimony,
  useDeleteTestimony,
  useReportTestimony,
  useSetTestimonyVisibility,
  useVisibleTestimonies,
} from "@/core/testimonies/queries";
import { useToast } from "@/core/toast/ToastProvider";
import { useAction } from "@/core/toast/useAction";

const NO_TESTIMONIES: Testimony[] = [];

/**
 * El botón de escribir va al fondo aunque la lista sea corta: el contenedor
 * crece hasta la pantalla y este margen lo empuja abajo. En una `FlatList` el
 * pie va dentro de su propia celda, así que el margen va en la celda.
 */
const FOOTER_AT_BOTTOM = { marginTop: "auto" } as const;

/**
 * What was answered — yours, and your circles'.
 *
 * There is no visibility filter to choose here: the policy already decided
 * what comes back, so the screen cannot accidentally show something somebody
 * kept private.
 */
export default function Testimonies() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: testimonies,
    isLoading,
    isLoadingError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useVisibleTestimonies(userId);

  // `mutateAsync` es estable entre renders; el objeto de la mutación no.
  const { mutateAsync: setVisibility } = useSetTestimonyVisibility(userId);
  const { mutateAsync: remove } = useDeleteTestimony(userId);
  const { mutateAsync: report } = useReportTestimony(userId);
  const { mutateAsync: block } = useBlockUser(userId);

  // Lo que sale bien y lo que falla, por el toast del sistema: el aviso en
  // línea encima de la lista la empujaba hacia abajo justo al tocar.
  const toast = useToast();
  const { run } = useAction();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Bloquear pregunta antes: estaba junto a «Reportar» y bastaba un toque suelto.
  const { ask: askBlock, dialog: blockDialog } = useBlockConfirm(
    (blockedId) => void run(() => block(blockedId), t("moderation.blockDone")),
  );

  const actions = useMemo<TestimonyActions>(
    () => ({
      share: (body) => {
        // El enlace va a la app, no al testimonio: no hay pantalla pública de
        // un testimonio, y mandar a alguien a una que no existe es peor que no
        // mandarlo.
        void shareOrCopy(
          t("testimony.shareMessage", { body }),
          buildShareUrl("/", "invitacion"),
        ).then((outcome) => {
          if (outcome === "copied") toast.success(t("share.linkCopied"));
          if (outcome === "failed") toast.error(t("share.shareFailed"));
        });
      },
      makePrivate: (id) =>
        void run(
          () => setVisibility({ id, visibility: "private" }),
          t("testimony.saved"),
        ),
      askDelete: (id) => setConfirmingDelete(id),
      confirmDelete: (id) => {
        setConfirmingDelete(null);
        void run(() => remove(id), t("testimony.saved"));
      },
      report: (id) => void run(() => report(id), t("moderation.reportDone")),
      block: askBlock,
    }),
    [t, toast, run, setVisibility, remove, report, askBlock],
  );

  const renderItem = useCallback<ListRenderItem<Testimony>>(
    ({ item }) => (
      <TestimonyCard
        entry={item}
        confirmingDelete={confirmingDelete === item.id}
        actions={actions}
      />
    ),
    [confirmingDelete, actions],
  );

  const loadMore = useLoadMoreOnEnd({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("testimony.title"), headerShown: true }}
        />
        <LoadingState />
      </>
    );
  }

  if (isLoadingError) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("testimony.title"), headerShown: true }}
        />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: t("testimony.title"), headerShown: true }}
      />
      <DawnBackground>
        <FlatList
          data={testimonies ?? NO_TESTIMONIES}
          keyExtractor={rowId}
          renderItem={renderItem}
          contentContainerClassName="flex-grow gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
          onEndReached={loadMore}
          onEndReachedThreshold={END_REACHED_THRESHOLD}
          ListHeaderComponent={
            <Txt variant="body" tone="secondary">
              {t("testimony.subtitle")}
            </Txt>
          }
          ListEmptyComponent={
            <EmptyState
              title={t("testimony.empty")}
              body={t("testimony.emptyBody")}
            />
          }
          ListFooterComponentStyle={FOOTER_AT_BOTTOM}
          ListFooterComponent={
            <View className="gap-5">
              <View className="pt-6">
                <Link href="/testimonios/nuevo" asChild>
                  <Button title={t("testimony.markAnswered")} />
                </Link>
              </View>
              <LoadMore
                hasMore={hasNextPage}
                loading={isFetchingNextPage}
                onPress={() => void fetchNextPage()}
              />
            </View>
          }
        />
      </DawnBackground>
      {blockDialog}
    </>
  );
}
