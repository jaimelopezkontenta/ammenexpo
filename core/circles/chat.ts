import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/utils/supabase";

import {
  type ChatMessage,
  flattenMessages,
  MESSAGE_PAGE_SIZE,
  type MessageCursor,
  type MessagePage,
  nextMessageCursor,
  olderThanFilter,
  withNewestPage,
} from "@/core/circles/chatPages";
import { requireUserId } from "@/core/auth/requireUserId";
import { qk } from "@/core/query/keys";

export type { ChatMessage } from "@/core/circles/chatPages";

/** The circle's conversation, created by a trigger when the circle is. */
export const useCircleConversation = (circleId: string | undefined) =>
  useQuery({
    queryKey: qk.circleConversation(circleId),
    enabled: Boolean(circleId),
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("circle_conversation", {
        p_group_id: circleId!,
      });

      if (error) throw error;

      return (data as string | null) ?? null;
    },
  });

/**
 * Una página de mensajes, del más nuevo hacia atrás desde `cursor`.
 *
 * Consulta directa a la tabla y no la RPC `circle_messages`: esa pagina solo
 * por fecha (`p_before`), y dos mensajes en el mismo instante a caballo entre
 * páginas se perdían o se repetían. Aquí el cursor es `(created_at, id)`,
 * igual que las RPC `*_page` del resto de listas. Lo que se ve es lo mismo que
 * daba la RPC —que era `security invoker`—: la policy de SELECT deja fuera lo
 * oculto y lo de quien has bloqueado, y el `!inner` del perfil hace lo que su
 * `join`.
 */
export const fetchMessagePage = async (
  circleId: string,
  userId: string,
  cursor: MessageCursor | null,
): Promise<MessagePage> => {
  let query = supabase
    .from("messages")
    .select(
      "id, sender_id, body, created_at, sender:profiles!messages_sender_id_fkey!inner(display_name, avatar_url), conversations!inner(group_id)",
    )
    .eq("conversations.group_id", circleId);

  if (cursor) query = query.or(olderThanFilter(cursor));

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) throw error;

  const rows = (data ?? []).map((row): ChatMessage => ({
    id: row.id,
    sender_id: row.sender_id,
    sender_name: row.sender.display_name,
    sender_avatar_url: row.sender.avatar_url,
    body: row.body,
    created_at: row.created_at,
    is_mine: row.sender_id === userId,
  }));

  return { rows, more: rows.length === MESSAGE_PAGE_SIZE };
};

type MessagesCache = InfiniteData<MessagePage, MessageCursor | null>;

/**
 * Newest first, which is what an inverted list wants — and now paged
 * backwards: `fetchNextPage` brings the fifty before the oldest on screen.
 *
 * Hidden messages and messages from people you have blocked never arrive: both
 * are filtered by the SELECT policy, so no cache anywhere is holding the text
 * and a refetch cannot bring them back.
 */
export const useCircleMessages = (
  circleId: string | undefined,
  userId: string | undefined,
) =>
  useInfiniteQuery({
    queryKey: qk.circleMessages(circleId),
    enabled: Boolean(circleId) && Boolean(userId),
    initialPageParam: null as MessageCursor | null,
    queryFn: ({ pageParam }) =>
      fetchMessagePage(circleId!, requireUserId(userId), pageParam),
    getNextPageParam: nextMessageCursor,
    // De módulo, no en línea: así React Query no la vuelve a pasar por cada
    // página en cada render.
    select: flattenMessages,
  });

/**
 * Lo nuevo, sin volver a pedir lo viejo.
 *
 * Invalidar la query paginada pide otra vez **todas** sus páginas, una detrás
 * de otra: con tres páginas cargadas, cada mensaje que llegaba costaba tres
 * viajes. Aquí se pide solo la página más nueva y se mezcla con lo que hay
 * (`withNewestPage`: sin repetir, sin desordenar, y quitando lo que ya no se
 * puede ver en su tramo).
 *
 * Si hay otra lectura en vuelo (la carga inicial, «cargar más», un refresco),
 * su resultado pisaría esta mezcla al llegar: entonces se invalida y ya, que
 * es lo que se hacía siempre. Y si esta petición falla, igual.
 */
export const refreshNewestMessages = async (
  queryClient: QueryClient,
  circleId: string | undefined,
  userId: string | undefined,
) => {
  const queryKey = qk.circleMessages(circleId);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  if (!circleId || !userId || !queryClient.getQueryData(queryKey)) {
    invalidate();
    return;
  }

  let head: MessagePage;
  try {
    head = await fetchMessagePage(circleId, userId, null);
  } catch {
    invalidate();
    return;
  }

  if (queryClient.getQueryState(queryKey)?.fetchStatus === "fetching") {
    invalidate();
    return;
  }

  queryClient.setQueryData<MessagesCache>(queryKey, (data) =>
    data ? withNewestPage(data, head) : data,
  );
};

/**
 * The first Realtime subscription in the project.
 *
 * The publication has carried seven tables since the first migration with
 * nothing listening. On an insert this refetches rather than appending the
 * payload: the row arrives raw, without the sender's name, and — more to the
 * point — without having passed the policy that hides blocked and moderated
 * messages. Appending it would put on screen exactly what the server refuses
 * to send. Lo que se vuelve a pedir es solo la página más nueva
 * (`refreshNewestMessages`), no todas las que haya cargadas.
 */
export const useCircleChatRealtime = (
  circleId: string | undefined,
  conversationId: string | null | undefined,
  userId: string | undefined,
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!circleId || !conversationId) return;

    const channel = supabase
      .channel(`circle-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void refreshNewestMessages(queryClient, circleId, userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, conversationId, userId, queryClient]);
};

export const useSendMessage = (
  circleId: string | undefined,
  conversationId: string | null | undefined,
  userId: string | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId!,
        sender_id: requireUserId(userId),
        body: trimmed,
      });

      if (error) throw error;
    },
    // Your own message arrives over Realtime too, but not always before you
    // stop looking at the screen — and a chat that does not show what you just
    // sent reads as broken.
    onSuccess: () => {
      void refreshNewestMessages(queryClient, circleId, userId);
    },
  });
};

/**
 * Admins only; the RPC answers `false` rather than raising for everyone else.
 *
 * Aquí sí se invalida todo: el mensaje oculto puede estar en cualquier página
 * de las cargadas, no solo en la más nueva.
 */
export const useHideMessage = (circleId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase.rpc("hide_message", {
        p_message_id: messageId,
      });

      if (error) throw error;

      if (data !== true) {
        throw new Error("hide_message_refused");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.circleMessages(circleId),
      });
    },
  });
};

/**
 * Reporting files a row for review out of band. It does not remove anything on
 * its own — that is what blocking (for you) and hiding (for the circle) do —
 * so the screen has to offer those next to it rather than in its place.
 */
export const useReportMessage = (userId: string | undefined) =>
  useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from("reports").insert({
        reporter_id: requireUserId(userId),
        target_type: "message",
        target_id: messageId,
      });

      if (error) throw error;
    },
  });
