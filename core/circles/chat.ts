import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/utils/supabase";

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar_url: string | null;
  body: string;
  created_at: string;
  is_mine: boolean;
};

/** The circle's conversation, created by a trigger when the circle is. */
export const useCircleConversation = (circleId: string | undefined) =>
  useQuery({
    queryKey: ["circleConversation", circleId],
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
 * Newest first, which is what an inverted list wants.
 *
 * Hidden messages and messages from people you have blocked never arrive: both
 * are filtered by the SELECT policy, so no cache anywhere is holding the text
 * and a refetch cannot bring them back.
 */
export const useCircleMessages = (circleId: string | undefined) =>
  useQuery({
    queryKey: ["circleMessages", circleId],
    enabled: Boolean(circleId),
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase.rpc("circle_messages", {
        p_group_id: circleId!,
      });

      if (error) throw error;

      return (data ?? []) as ChatMessage[];
    },
  });

/**
 * The first Realtime subscription in the project.
 *
 * The publication has carried seven tables since the first migration with
 * nothing listening. On an insert this refetches rather than appending the
 * payload: the row arrives raw, without the sender's name, and — more to the
 * point — without having passed the policy that hides blocked and moderated
 * messages. Appending it would put on screen exactly what the server refuses
 * to send.
 */
export const useCircleChatRealtime = (
  circleId: string | undefined,
  conversationId: string | null | undefined,
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
          void queryClient.invalidateQueries({
            queryKey: ["circleMessages", circleId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, conversationId, queryClient]);
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
        sender_id: userId!,
        body: trimmed,
      });

      if (error) throw error;
    },
    // Your own message arrives over Realtime too, but not always before you
    // stop looking at the screen — and a chat that does not show what you just
    // sent reads as broken.
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["circleMessages", circleId],
      });
    },
  });
};

/** Admins only; the RPC answers `false` rather than raising for everyone else. */
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
        queryKey: ["circleMessages", circleId],
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
        reporter_id: userId!,
        target_type: "message",
        target_id: messageId,
      });

      if (error) throw error;
    },
  });
