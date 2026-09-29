import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  KeyboardAvoidingView,
  type ListRenderItem,
  Platform,
  View,
} from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useBlockConfirm } from "@/components/BlockConfirm";
import { ChatComposer } from "@/components/chat/ChatComposer";
import {
  type MessageActions,
  MessageBubble,
} from "@/components/chat/MessageBubble";
import { LoadMore } from "@/components/LoadMore";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import {
  type ChatMessage,
  useCircleChatRealtime,
  useCircleConversation,
  useCircleMessages,
  useHideMessage,
  useReportMessage,
} from "@/core/circles/chat";
import { bubbleOpenings } from "@/core/circles/chatPages";
import {
  useCircle,
  useCircleMembers,
  useMarkConversationRead,
} from "@/core/circles/queries";
import { useBlockUser } from "@/core/moderation/blocks";
import { END_REACHED_THRESHOLD, useLoadMoreOnEnd } from "@/core/paging";
import { useAction } from "@/core/toast/useAction";

import { EmptyState } from "@/components/ui/EmptyState";

const NO_MESSAGES: ChatMessage[] = [];

const messageKey = (item: ChatMessage) => item.id;

export default function CircleChat() {
  const { t, i18n } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: circle } = useCircle(id);
  const { data: members } = useCircleMembers(id);
  const { data: conversationId, isLoadingError: conversationFailed } =
    useCircleConversation(id);
  const {
    data: messages,
    isLoading,
    isLoadingError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useCircleMessages(id, userId);

  useCircleChatRealtime(id, conversationId, userId);

  // `mutateAsync` es estable entre renders; el objeto de la mutación no.
  const { mutateAsync: hide } = useHideMessage(id);
  const { mutateAsync: report } = useReportMessage(userId);
  const { mutateAsync: block } = useBlockUser(userId);
  const markRead = useMarkConversationRead(id, userId);

  // On open, and again whenever something new arrives at the bottom — a
  // message that arrives over Realtime while the chat is on screen has been
  // read by anybody looking at it. Por el más nuevo y no por el total: subir a
  // leer mensajes antiguos también cambia el total, y eso no es leer nada
  // nuevo.
  const newestId = messages?.[0]?.id;

  useEffect(() => {
    if (!id || !conversationId) return;
    markRead.mutate();
    // `markRead` is a fresh object every render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversationId, newestId]);

  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Los resultados de acción van por el toast del sistema: caducan solos y no
  // empujan el composer. (El `noticeTimer` que vivía aquí era una copia literal
  // del de la pantalla del círculo.)
  const { run } = useAction();

  const isAdmin = (members ?? []).some(
    (m) => m.user_id === userId && m.role !== "member",
  );

  const locale = i18n.resolvedLanguage ?? "es";
  // Cambia a medianoche: las burbujas memorizadas recalculan «Hoy» y «Ayer».
  const today = new Date().toDateString();

  // Bloquear pregunta antes de hacerlo (ConfirmDialog): en el menú de un
  // mensaje estaba pegado a «Reportar» y bastaba un toque suelto.
  const { ask: askBlock, dialog: blockDialog } = useBlockConfirm(
    (blockedId) => void run(() => block(blockedId), t("moderation.blockDone")),
  );

  const actions = useMemo<MessageActions>(
    () => ({
      toggleMenu: (messageId) =>
        setOpenMenu((current) => (current === messageId ? null : messageId)),
      report: (messageId) => {
        setOpenMenu(null);
        void run(() => report(messageId), t("moderation.reportDone"));
      },
      block: (senderId, name) => {
        setOpenMenu(null);
        askBlock(senderId, name);
      },
      hide: (messageId) => {
        setOpenMenu(null);
        void run(() => hide(messageId), t("moderation.hideDone"));
      },
    }),
    [run, report, t, askBlock, hide],
  );

  const renderItem = useCallback<ListRenderItem<ChatMessage>>(
    ({ item, index }) => {
      // Con la lista invertida, el vecino de índice+1 es el mensaje anterior
      // en el tiempo: de él sale si este abre día o racha.
      const { opensDay, opensRun } = bubbleOpenings(
        item,
        (messages ?? NO_MESSAGES)[index + 1],
      );

      return (
        <MessageBubble
          message={item}
          index={index}
          opensDay={opensDay}
          opensRun={opensRun}
          menuOpen={openMenu === item.id}
          isAdmin={isAdmin}
          locale={locale}
          today={today}
          actions={actions}
        />
      );
    },
    [messages, openMenu, isAdmin, locale, today, actions],
  );

  // Hacia atrás: en la lista invertida el «final» es arriba, lo más antiguo.
  const loadOlder = useLoadMoreOnEnd({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

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
  if (isLoadingError || conversationFailed) {
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
          {/* Una conversación solo crece: virtualizada, y paginada hacia
            atrás (50 cada vez) en vez de quedarse en los últimos 50. Inverted
            because the query returns newest first and because a chat is read
            from the bottom — y porque así cargar lo antiguo arriba no mueve
            lo que estás leyendo. */}
          <FlatList
            className="flex-1"
            contentContainerClassName="gap-4 px-7 py-6 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            data={messages ?? NO_MESSAGES}
            inverted
            keyExtractor={messageKey}
            renderItem={renderItem}
            onEndReached={loadOlder}
            onEndReachedThreshold={END_REACHED_THRESHOLD}
            ListEmptyComponent={
              // La lista está invertida (scaleY -1) y el empty no pasa por el
              // wrapper de fila que lo desvoltea: sin el contra-volteo, el
              // orbe y el texto saldrían cabeza abajo.
              <View className="py-16" style={{ transform: [{ scaleY: -1 }] }}>
                <EmptyState size="inline" title={t("chat.empty")} />
              </View>
            }
            // El pie de una lista invertida queda arriba, sobre el mensaje más
            // antiguo: ahí va «ver anteriores» para quien no hace scroll
            // (lector de pantalla, teclado). Sin más historia, no hay pie.
            ListFooterComponent={
              hasNextPage ? (
                <LoadMore
                  hasMore={hasNextPage}
                  loading={isFetchingNextPage}
                  onPress={() => void fetchNextPage()}
                  label={t("chat.loadOlder")}
                />
              ) : null
            }
          />

          <ChatComposer
            circleId={id}
            conversationId={conversationId}
            userId={userId}
          />
        </KeyboardAvoidingView>
      </DawnBackground>
      {blockDialog}
    </>
  );
}
