import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  COMMENT_MAX,
  usePostComments,
  useReportPost,
  useWriteComment,
} from "@/core/posts/queries";

/**
 * The words people leave on a request.
 *
 * The request itself is not repeated here: it is on the card you tapped, and
 * fetching it again would need a second RPC for something already on screen a
 * moment ago.
 */
export default function PrayerRequestComments() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: comments, isLoading, isError, refetch } = usePostComments(id);
  const write = useWriteComment(id, userId);
  const report = useReportPost(userId);
  const block = useBlockUser(userId);

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
      await write.mutateAsync(body);
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
      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="flex-grow gap-5 px-7 py-8"
        keyboardShouldPersistTaps="handled"
      >
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

        {(comments ?? []).map((comment) => (
          <View key={comment.id} className="gap-1">
            <Text className="text-sm font-medium text-ink-soft">
              {comment.author_name}
            </Text>
            <Text className="text-base leading-6 text-ink">{comment.body}</Text>

            {!comment.is_mine ? (
              <View className="flex-row gap-4 pt-0.5">
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void run(
                      () =>
                        report.mutateAsync({ id: comment.id, kind: "comment" }),
                      t("moderation.reportDone"),
                    )
                  }
                >
                  <Text className="text-sm text-ink-soft underline">
                    {t("moderation.report")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("moderation.block")} ${comment.author_name}`}
                  onPress={() =>
                    void run(
                      () => block.mutateAsync(comment.author_id),
                      t("moderation.blockDone"),
                    )
                  }
                >
                  <Text className="text-sm text-ink-soft underline">
                    {t("moderation.block")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}

        <View className="mt-auto flex-row items-end gap-2 pt-6">
          <TextInput
            className="max-h-32 min-w-0 flex-1 rounded-2xl border border-ink-line bg-paper px-4 py-3 text-base text-ink"
            accessibilityLabel={t("feed.comment")}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("feed.commentPlaceholder")}
            placeholderTextColor="#726A62"
            multiline
            numberOfLines={1}
            maxLength={COMMENT_MAX}
          />
          <Button
            title={t("chat.send")}
            disabled={!canSend}
            loading={write.isPending}
            onPress={() => void handleSend()}
            className="w-auto shrink-0"
          />
        </View>
      </ScrollView>
    </>
  );
}
