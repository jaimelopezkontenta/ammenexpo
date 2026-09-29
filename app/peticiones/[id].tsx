import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useBlockConfirm } from "@/components/BlockConfirm";
import { Txt } from "@/components/ui/Text";
import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { useCircleMembers } from "@/core/circles/queries";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  COMMENT_MAX,
  useHideComment,
  usePostComments,
  useReportPost,
  useWriteComment,
} from "@/core/posts/queries";

import { Tap } from "@/components/ui/Tap";

/**
 * The words people leave on a request.
 *
 * The request itself is not repeated here: it is on the card you tapped, and
 * fetching it again would need a second RPC for something already on screen a
 * moment ago.
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

  const { data: comments, isLoading, isError, refetch } = usePostComments(id);
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

  const run = async (action: () => Promise<unknown>, done: string) => {
    setError(null);
    setNotice(null);

    try {
      await action();
      setNotice(done);
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

  if (isError) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("feed.comment"), headerShown: true }}
        />
        <ErrorState onRetry={() => void refetch()} />
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
