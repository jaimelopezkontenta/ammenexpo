import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useBlockConfirm } from "@/components/BlockConfirm";
import { Txt } from "@/components/ui/Text";
import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { PrayerRequestCard } from "@/components/PrayerRequestCard";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSession } from "@/core/auth/SessionProvider";
import { useCircleMembers } from "@/core/circles/queries";
import { useBlockUser } from "@/core/moderation/blocks";
import { goBackOr } from "@/core/nav/safeBack";
import {
  COMMENT_MAX,
  useDeletePrayerRequest,
  useHideComment,
  useMarkAnswered,
  usePostComments,
  usePrayerFeed,
  useReportPost,
  useTogglePostPrayer,
  useWriteComment,
} from "@/core/posts/queries";

import { Tap } from "@/components/ui/Tap";

/**
 * The words people leave on a request — with the request above them.
 *
 * Solo se enseñaban los comentarios, como si la petición estuviera en la
 * tarjeta que acabas de tocar: cierto desde el muro, falso al recargar la
 * página o abrirla desde un enlace, y de todos modos con treinta comentarios
 * la petición quedaba arriba, fuera de la vista. No hay una RPC para una sola
 * petición, así que se lee del mismo feed que pinta el muro (misma clave de
 * caché, así que al venir del muro no cuesta una petición): con `circulo` el
 * del círculo, sin él el abierto. Si no está entre las páginas cargadas —un
 * enlace en frío a una petición antigua— la pantalla es la de siempre.
 */
export default function PrayerRequestComments() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { id, circulo } = useLocalSearchParams<{
    id: string;
    circulo?: string;
  }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: comments,
    isLoading,
    isLoadingError,
    error: loadError,
    refetch,
  } = usePostComments(id);
  const { data: feed } = usePrayerFeed(circulo);
  const request = (feed ?? []).find((entry) => entry.id === id) ?? null;
  const togglePrayer = useTogglePostPrayer(userId);
  const markAnswered = useMarkAnswered();
  const removeRequest = useDeletePrayerRequest();
  const write = useWriteComment(id, userId);
  const report = useReportPost(userId);
  const block = useBlockUser(userId);
  const hide = useHideComment(id);
  const { data: members } = useCircleMembers(circulo);

  // Ocultar es de quien administra el círculo, y en el muro abierto no manda
  // nadie — la propia pantalla del muro ya lo dice en voz alta.
  const isAdmin =
    Boolean(circulo) &&
    (members ?? []).some((m) => m.user_id === userId && m.role !== "member");

  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = draft.trim().length > 0 && !write.isPending;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;

    setError(null);
    setDraft("");

    try {
      const result = await write.mutateAsync(body);

      // B1b: igual que la petición, nunca se enseña como comentado con
      // normalidad — se lleva a los recursos en el momento.
      if (result.crisisFlagged) {
        router.replace("/crisis");
      }
    } catch {
      setDraft(body);
      setError(t("common.errorGeneric"));
    }
  };

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

  // Bloquear pregunta antes: estaba junto a «Reportar» y bastaba un toque suelto.
  const blockConfirm = useBlockConfirm(
    (blockedId) =>
      void run(() => block.mutateAsync(blockedId), t("moderation.blockDone")),
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("feed.comment"), headerShown: true }}
        />
        <LoadingState />
      </>
    );
  }

  if (isLoadingError) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("feed.comment"), headerShown: true }}
        />
        <ErrorState error={loadError} onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("feed.comment"), headerShown: true }} />
      <DawnBackground>
        <ScrollView
          contentContainerClassName="flex-grow gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
          keyboardShouldPersistTaps="handled"
        >
          {notice ? (
            <Txt
              variant="caption"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {notice}
            </Txt>
          ) : null}

          {error ? (
            <Txt variant="caption" tone="danger" accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}

          {/* La petición, con lo que trae la tarjeta del muro. Sin `onOpen`
            (ya estás en los comentarios) y sin ocultar: en esta pantalla
            «Ocultar» es de los comentarios, y ocultar la petición entera se
            hace desde el muro. */}
          {request ? (
            <PrayerRequestCard
              request={request}
              canHide={false}
              onTogglePrayer={() =>
                void run(() =>
                  togglePrayer.mutateAsync({
                    postId: request.id,
                    prayed: request.i_prayed,
                  }),
                )
              }
              onReport={() =>
                void run(
                  () => report.mutateAsync({ id: request.id, kind: "post" }),
                  t("moderation.reportDone"),
                )
              }
              onBlock={blockConfirm.ask}
              onHide={() => undefined}
              onMarkAnswered={() =>
                void run(() => markAnswered.mutateAsync(request.id))
              }
              // Borrada la petición, estos comentarios no cuelgan de nada:
              // se vuelve.
              onDelete={() =>
                void run(async () => {
                  await removeRequest.mutateAsync(request.id);
                  goBackOr("/peticiones");
                })
              }
            />
          ) : null}

          {(comments ?? []).length === 0 ? (
            <EmptyState
              size="inline"
              title={t("feed.commentsEmpty")}
              body={t("feed.commentsEmptyBody")}
            />
          ) : null}

          {(comments ?? []).map((comment) => (
            <View key={comment.id} className="gap-1">
              <View className="flex-row items-center gap-2">
                <Avatar
                  name={comment.author_name}
                  url={comment.author_avatar_url}
                  seed={comment.author_id}
                  size={24}
                />
                <Txt variant="label" tone="secondary">
                  {comment.author_name}
                </Txt>
              </View>
              {comment.held_at ? (
                <Txt variant="label" tone="secondary">
                  {t("moderation.held")} · {t("moderation.heldHint")}
                </Txt>
              ) : null}

              <Txt variant="body">{comment.body}</Txt>

              {!comment.is_mine ? (
                <View className="flex-row gap-4 pt-0.5">
                  <Tap
                    accessibilityRole="button"
                    onPress={() =>
                      void run(
                        () =>
                          report.mutateAsync({
                            id: comment.id,
                            kind: "comment",
                          }),
                        t("moderation.reportDone"),
                      )
                    }
                  >
                    <Txt variant="caption" className="underline">
                      {t("moderation.report")}
                    </Txt>
                  </Tap>

                  <Tap
                    accessibilityRole="button"
                    accessibilityLabel={`${t("moderation.block")} ${comment.author_name}`}
                    onPress={() =>
                      blockConfirm.ask(comment.author_id, comment.author_name)
                    }
                  >
                    <Txt variant="caption" className="underline">
                      {t("moderation.block")}
                    </Txt>
                  </Tap>

                  {/* Bloquear solo te lo quita a ti de delante; ocultar lo quita
                    para todo el círculo, y es lo que hacía falta para que la
                    moderación no se acabara en el mensaje y la petición. */}
                  {isAdmin ? (
                    <Tap
                      accessibilityRole="button"
                      onPress={() =>
                        void run(
                          () => hide.mutateAsync(comment.id),
                          t("moderation.hideContentDone"),
                        )
                      }
                    >
                      <Txt variant="caption" className="underline">
                        {t("moderation.hide")}
                      </Txt>
                    </Tap>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}

          <View className="mt-auto flex-row items-end gap-2 pt-6">
            <View className="min-w-0 flex-1">
              <TextField
                skin="dawn"
                hideLabel
                label={t("feed.comment")}
                className="max-h-32 py-3"
                value={draft}
                onChangeText={setDraft}
                placeholder={t("feed.commentPlaceholder")}
                multiline
                numberOfLines={1}
                maxLength={COMMENT_MAX}
              />
            </View>
            <Button
              title={t("chat.send")}
              disabled={!canSend}
              loading={write.isPending}
              onPress={() => void handleSend()}
              className="w-auto shrink-0"
            />
          </View>
        </ScrollView>
      </DawnBackground>
      {blockConfirm.dialog}
    </>
  );
}
