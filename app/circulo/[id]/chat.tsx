import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Avatar } from "@/components/Avatar";
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
import { useToast } from "@/core/toast/ToastProvider";

import Animated from "react-native-reanimated";

import { useThemeColors } from "@/theme";
import { enterListItem } from "@/theme/motion";

import { EmptyState } from "@/components/ui/EmptyState";
import { Tap } from "@/components/ui/Tap";

const sameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function CircleChat() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { bottom, scrollBottom } = useScreenPadding();
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

  // Los resultados de acción van por el toast del sistema: caducan solos y no
  // empujan el composer. (El `noticeTimer` que vivía aquí era una copia literal
  // del de la pantalla del círculo.)
  const toast = useToast();

  // El fallo de envío sí es local: vive junto al composer, con el borrador
  // restaurado, hasta el siguiente intento.
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

  // Un chat sin fechas ni horas es una conversación sin memoria: "¿esto fue
  // hoy?" no debería ser una pregunta. La hora vive dentro de la burbuja; el
  // día, en un separador cuando cambia.
  const locale = i18n.resolvedLanguage ?? "es";

  const dayLabel = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (sameCalendarDay(date, today)) return t("chat.today");
    if (sameCalendarDay(date, yesterday)) return t("chat.yesterday");
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
    }).format(date);
  };

  const timeLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const runModeration = async (label: string, action: () => Promise<void>) => {
    setOpenMenu(null);

    try {
      await action();
      toast.success(label);
    } catch {
      toast.error(t("common.errorGeneric"));
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
      <DawnBackground>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* The first virtualized list in the project. Everything else is a
            ScrollView with a .map(), which is fine for a 30-day plan and not
            fine for a conversation that only grows. Inverted because the RPC
            returns newest first and because a chat is read from the bottom. */}
          <FlatList
            className="flex-1"
            contentContainerClassName="gap-4 px-7 py-6 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            data={messages ?? []}
            inverted
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              // La lista está invertida (scaleY -1) y el empty no pasa por el
              // wrapper de fila que lo desvoltea: sin el contra-volteo, el
              // orbe y el texto saldrían cabeza abajo.
              <View className="py-16" style={{ transform: [{ scaleY: -1 }] }}>
                <EmptyState size="inline" title={t("chat.empty")} />
              </View>
            }
            renderItem={({ item, index }) => {
              // Con la lista invertida, el vecino de índice+1 es el mensaje
              // anterior en el tiempo: si es de otro día (o no existe), este
              // abre día y lleva el separador encima.
              const older = (messages ?? [])[index + 1];
              const opensDay =
                !older ||
                !sameCalendarDay(
                  new Date(older.created_at),
                  new Date(item.created_at),
                );
              // Racha: si el mensaje de encima (más antiguo) es de la misma
              // persona y del mismo día, la cara y el nombre no se repiten.
              const opensRun =
                opensDay || !older || older.sender_id !== item.sender_id;

              return (
                // Entrada solo en las burbujas visibles al abrir (la lista está
                // invertida: 0 es la más reciente); el resto llega por scroll y
                // animarlo sería trabajo que nadie ve.
                <Animated.View entering={enterListItem(index)}>
                  {opensDay ? (
                    <Txt
                      variant="editorial"
                      className="pb-3 pt-1 text-center text-base"
                    >
                      {dayLabel(item.created_at)}
                    </Txt>
                  ) : null}
                  <View className={item.is_mine ? "items-end" : "items-start"}>
                    <View className="max-w-[85%] gap-1">
                      {!item.is_mine && opensRun ? (
                        <View className="flex-row items-center gap-2">
                          <Avatar
                            name={item.sender_name}
                            url={item.sender_avatar_url}
                            seed={item.sender_id}
                            size={20}
                          />
                          <Txt
                            variant="label"
                            tone="secondary"
                            className="text-xs"
                          >
                            {item.sender_name}
                          </Txt>
                        </View>
                      ) : null}

                      <Tap
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
                        // La burbuja propia es vidrio oscuro y la ajena vidrio
                        // claro, como en el diseño. Ninguna de las dos desenfoca: van
                        // dentro de una lista virtualizada, y ahí el desenfoque se
                        // recompone en cada fila que entra.
                        className={`rounded-card border px-4 py-3 ${
                          item.is_mine
                            ? "border-white/30 bg-plum-chip"
                            : "border-glassedge/60 bg-glass/60"
                        }`}
                      >
                        <Txt
                          variant="body"
                          tone={item.is_mine ? "onDark" : "primary"}
                        >
                          {item.body}
                        </Txt>
                        {/* La hora dentro de la burbuja, como en cualquier chat:
                      pequeña, al filo, sin robarle línea al mensaje. */}
                        <Txt
                          variant="caption"
                          className={`self-end pt-0.5 text-xs ${
                            item.is_mine ? "text-white/70" : ""
                          }`}
                        >
                          {timeLabel(item.created_at)}
                        </Txt>
                      </Tap>

                      {/* Behind a tap rather than always visible: every message
                    carrying three moderation links would make the circle read
                    like a place where trouble is expected. */}
                      {openMenu === item.id && !item.is_mine ? (
                        <View className="flex-row flex-wrap gap-4 pt-1">
                          <Tap
                            accessibilityRole="button"
                            onPress={() =>
                              void runModeration(
                                t("moderation.reportDone"),
                                () => report.mutateAsync(item.id),
                              )
                            }
                            className="min-h-11 justify-center"
                          >
                            <Txt variant="caption">
                              {t("moderation.report")}
                            </Txt>
                          </Tap>

                          <Tap
                            accessibilityRole="button"
                            onPress={() =>
                              void runModeration(
                                t("moderation.blockDone"),
                                () => block.mutateAsync(item.sender_id),
                              )
                            }
                            className="min-h-11 justify-center"
                          >
                            <Txt variant="caption">{t("moderation.block")}</Txt>
                          </Tap>

                          {isAdmin ? (
                            <Tap
                              accessibilityRole="button"
                              onPress={() =>
                                void runModeration(
                                  t("moderation.hideDone"),
                                  () => hide.mutateAsync(item.id),
                                )
                              }
                              className="min-h-11 justify-center"
                            >
                              <Txt variant="caption">
                                {t("moderation.hide")}
                              </Txt>
                            </Tap>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
              );
            }}
          />

          {error ? (
            <Txt
              variant="caption"
              tone="danger"
              className="px-7 pb-2"
              accessibilityRole="alert"
            >
              {error}
            </Txt>
          ) : null}

          <View
            className="flex-row items-end gap-2 border-t border-glassedge/60 px-5 pt-3"
            style={{ paddingBottom: bottom }}
          >
            {/* A bare TextInput rather than TextField: the composer wants no
              visible label above it, and the accessible name is what matters. */}
            <TextInput
              className="max-h-32 min-w-0 flex-1 rounded-input border border-glassedge/70 bg-surface px-4 py-3 font-sans text-base text-plum"
              accessibilityLabel={t("chat.inputLabel")}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("chat.placeholder")}
              placeholderTextColor={colors.mist.ink}
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
            <Tap
              accessibilityRole="button"
              accessibilityLabel={t("chat.send")}
              accessibilityState={{
                disabled: !canSend,
                busy: send.isPending,
              }}
              aria-busy={send.isPending}
              disabled={!canSend}
              onPress={() => void handleSend()}
              className={`h-12 shrink-0 items-center justify-center rounded-input bg-plum-chip px-5 ${
                canSend ? "" : "opacity-40"
              }`}
            >
              {send.isPending ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Txt variant="subheading" tone="onDark">
                  {t("chat.send")}
                </Txt>
              )}
            </Tap>
          </View>
        </KeyboardAvoidingView>
      </DawnBackground>
    </>
  );
}
