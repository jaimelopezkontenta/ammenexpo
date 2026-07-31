import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useCircleChatRealtime,
  useCircleConversation,
  useCircleMessages,
  useHideMessage,
  useReportMessage,
  useSendMessage,
} from "@/core/circles/chat";
import {
  useCircle,
  useCircleMembers,
  useMarkConversationRead,
} from "@/core/circles/queries";
import { useBlockUser } from "@/core/moderation/blocks";

export default function CircleChat() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: circle } = useCircle(id);
  const { data: members } = useCircleMembers(id);
  const { data: conversationId, isError: conversationFailed } =
    useCircleConversation(id);
  const { data: messages, isLoading, isError, refetch } = useCircleMessages(id);

  useCircleChatRealtime(id, conversationId);

  const send = useSendMessage(id, conversationId, userId);
  const hide = useHideMessage(id);
  const report = useReportMessage(userId);
  const block = useBlockUser(userId);
  const markRead = useMarkConversationRead(id, userId);

  // On open, and again whenever the list changes underneath — a message that
  // arrives over Realtime while the chat is on screen has been read by anybody
  // looking at it.
  const messageCount = messages?.length ?? 0;

  useEffect(() => {
    if (!id || !conversationId) return;
    markRead.mutate();
    // `markRead` is a fresh object every render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversationId, messageCount]);

  const [draft, setDraft] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [notice, setNoticeState] = useState<string | null>(null);

  // A notice with no expiry outlives the action it describes: "Listo. No
  // volverás a ver a esta persona" was still sitting there several unrelated
  // taps later, reading as a response to whatever had just been pressed.
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setNotice = useCallback((message: string | null) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNoticeState(message);

    if (message) {
      noticeTimer.current = setTimeout(() => setNoticeState(null), 6000);
    }
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const [error, setError] = useState<string | null>(null);

  const isAdmin = (members ?? []).some(
    (m) => m.user_id === userId && m.role !== "member",
  );

  // A send button that does nothing on an empty draft reads as broken; dimming
  // it says the same thing without the tap.
  const canSend = draft.trim().length > 0 && !send.isPending;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;

    setError(null);
    // Cleared before the round trip so typing the next line is not blocked by
    // the network, and restored if the send actually fails.
    setDraft("");

    try {
      await send.mutateAsync(body);
    } catch {
      setDraft(body);
      setError(t("chat.sendFailed"));
    }
  };

  const runModeration = async (label: string, action: () => Promise<void>) => {
    setError(null);
    setOpenMenu(null);

    try {
      await action();
      setNotice(label);
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("chat.title"), headerShown: true }} />
        <LoadingState />
      </>
    );
  }

  // Without the conversation id there is nothing to send to: the insert would
  // go out with `conversation_id: undefined`, fail, and report a generic
  // "no hemos podido enviar tu mensaje" — while Realtime never subscribed, so
  // nothing anyone else wrote would arrive either.
  if (isError || conversationFailed) {
    return (
      <>
        <Stack.Screen options={{ title: t("chat.title"), headerShown: true }} />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: circle?.name ?? t("chat.title"), headerShown: true }}
      />
      <KeyboardAvoidingView
        className="flex-1 bg-paper"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* The first virtualized list in the project. Everything else is a
            ScrollView with a .map(), which is fine for a 30-day plan and not
            fine for a conversation that only grows. Inverted because the RPC
            returns newest first and because a chat is read from the bottom. */}
        <FlatList
          className="flex-1"
          contentContainerClassName="gap-4 px-7 py-6"
          data={messages ?? []}
          inverted
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <Text className="text-center text-base text-ink-muted">
                {t("chat.empty")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className={item.is_mine ? "items-end" : "items-start"}>
              <View className="max-w-[85%] gap-1">
                {!item.is_mine ? (
                  <Text className="text-xs font-medium text-ink-soft">
                    {item.sender_name}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.messageActions", {
                    name: item.sender_name,
                  })}
                  // A tap, not a long press. Long press is invisible — on the
                  // web it is not even a convention — and the stores require
                  // reporting and blocking to be *findable*, which a gesture
                  // nothing on screen hints at is not.
                  onPress={() =>
                    setOpenMenu(openMenu === item.id ? null : item.id)
                  }
                  className={`rounded-2xl px-4 py-3 ${
                    item.is_mine ? "bg-ink" : "bg-paper-sunken"
                  }`}
                >
                  <Text
                    className={`text-base leading-6 ${
                      item.is_mine ? "text-paper" : "text-ink"
                    }`}
                  >
                    {item.body}
                  </Text>
                </Pressable>

                {/* Behind a tap rather than always visible: every message
                    carrying three moderation links would make the circle read
                    like a place where trouble is expected. */}
                {openMenu === item.id && !item.is_mine ? (
                  <View className="flex-row flex-wrap gap-4 pt-1">
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void runModeration(t("moderation.reportDone"), () =>
                          report.mutateAsync(item.id),
                        )
                      }
                    >
                      <Text className="text-sm text-ink-soft">
                        {t("moderation.report")}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void runModeration(t("moderation.blockDone"), () =>
                          block.mutateAsync(item.sender_id),
                        )
                      }
                    >
                      <Text className="text-sm text-ink-soft">
                        {t("moderation.block")}
                      </Text>
                    </Pressable>

                    {isAdmin ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          void runModeration(t("moderation.hideDone"), () =>
                            hide.mutateAsync(item.id),
                          )
                        }
                      >
                        <Text className="text-sm text-ink-soft">
                          {t("moderation.hide")}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          )}
        />

        {notice ? (
          <Text
            className="px-7 pb-2 text-sm text-ink-muted"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {notice}
          </Text>
        ) : null}

        {error ? (
          <Text
            className="px-7 pb-2 text-sm text-red-500"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}

        <View className="flex-row items-end gap-2 border-t border-ink-line px-5 py-3">
          {/* A bare TextInput rather than TextField: the composer wants no
              visible label above it, and the accessible name is what matters. */}
          <TextInput
            className="max-h-32 min-w-0 flex-1 rounded-2xl border border-ink-line bg-paper px-4 py-3 text-base text-ink"
            accessibilityLabel={t("chat.inputLabel")}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("chat.placeholder")}
            placeholderTextColor="#726A62"
            multiline
            // react-native-web renders a multiline input as `rows={2}`, so an
            // empty composer stood two lines tall next to a one-line button.
            // Most messages are one line; it grows from there on native and
            // scrolls inside `max-h-32` on the web.
            numberOfLines={1}
            maxLength={4000}
          />

          {/* Not the shared Button: that one is `w-full`, sized for a screen's
              primary action, so in this row it claimed everything and left the
              composer 33px wide. A send control belongs to its own label. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("chat.send")}
            accessibilityState={{
              disabled: !canSend,
              busy: send.isPending,
            }}
            aria-busy={send.isPending}
            disabled={!canSend}
            onPress={() => void handleSend()}
            className={`h-12 shrink-0 items-center justify-center rounded-2xl bg-ink px-5 ${
              canSend ? "" : "opacity-40"
            }`}
          >
            {send.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-paper">
                {t("chat.send")}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
