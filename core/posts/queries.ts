import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PAGE_SIZE, usePagedQuery } from "@/core/paging";
import { supabase } from "@/utils/supabase";

export const POST_MAX = 2000;
export const COMMENT_MAX = 1000;

export type PrayerRequest = {
  id: string;
  body: string;
  is_anonymous: boolean;
  /** Null for anonymous requests — deliberately, so two cannot be correlated. */
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  prayer_count: number;
  comment_count: number;
  answered_at: string | null;
  /**
   * Retenida para revisión por el filtro de contenido. La ve su autor —con la
   * nota— y nadie más: eso lo decide la policy, no esta pantalla.
   */
  held_at: string | null;
  /**
   * B1b: distinto de `held_at` a propósito. Un post retenido por espam espera
   * turno en una cola; uno marcado de crisis nunca debió esperar nada — el
   * cliente lo usa para mostrar recursos de inmediato, no para explicar por
   * qué tarda en publicarse.
   */
  crisis_flagged_at: string | null;
  created_at: string;
  i_prayed: boolean;
  is_mine: boolean;
};

export type PostComment = {
  id: string;
  body: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  /** Retenido para revisión: lo ve su autor y nadie más. */
  held_at: string | null;
  /** B1b: ver la nota equivalente en `PrayerRequest`. */
  crisis_flagged_at: string | null;
  created_at: string;
  is_mine: boolean;
};

/**
 * Prayer requests — the open wall when no circle is given, that circle's
 * otherwise.
 *
 * `posts` has had policies, trigger-maintained counters and grants since the
 * first migration with no screen at all. It is what people actually do in a
 * prayer group, and until now it only fitted in the chat, where it scrolls away
 * and where there is no way to say "I prayed too".
 */
export const usePrayerFeed = (circleId?: string) =>
  usePagedQuery<PrayerRequest>({
    queryKey: ["prayerFeed", circleId ?? "wall"],
    keyOf: (row) => row.id,
    fetchPage: async (cursor) => {
      const { data, error } = await supabase.rpc("prayer_feed_page", {
        p_group_id: circleId ?? null,
        p_before: cursor?.created_at ?? null,
        p_before_id: cursor?.id ?? null,
        p_limit: PAGE_SIZE,
      });

      if (error) throw error;

      return (data ?? []) as PrayerRequest[];
    },
  });

export const useWritePrayerRequest = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      body: string;
      isAnonymous: boolean;
      circleId?: string;
    }) => {
      // `.select()` en vez de un insert a ciegas: B1b necesita saber, en el
      // momento, si esto se marcó de crisis — no en la siguiente carga del
      // muro — para poder llevar a quien escribió directo a los recursos.
      const { data, error } = await supabase
        .from("posts")
        .insert({
          author_id: userId!,
          body: input.body.trim().slice(0, POST_MAX),
          is_anonymous: input.isAnonymous,
          group_id: input.circleId ?? null,
        })
        .select("crisis_flagged_at")
        .single();

      if (error) throw error;

      return { crisisFlagged: data.crisis_flagged_at !== null };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
    },
  });
};

/**
 * "I prayed for this", and taking it back.
 *
 * Undo matters as much as the gesture: a counter that only ever goes up stops
 * meaning anything the first time somebody taps it by accident.
 */
export const useTogglePostPrayer = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { postId: string; prayed: boolean }) => {
      if (input.prayed) {
        const { error } = await supabase
          .from("post_prayers")
          .delete()
          .eq("post_id", input.postId)
          .eq("user_id", userId!);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("post_prayers")
        .insert({ post_id: input.postId, user_id: userId! });

      // Two taps in a row is not a failure — you did pray.
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
    },
  });
};

export const usePostComments = (postId: string | undefined) =>
  useQuery({
    queryKey: ["postComments", postId],
    enabled: Boolean(postId),
    queryFn: async (): Promise<PostComment[]> => {
      const { data, error } = await supabase.rpc("post_comments", {
        p_post_id: postId!,
      });

      if (error) throw error;

      return (data ?? []) as PostComment[];
    },
  });

export const useWriteComment = (
  postId: string | undefined,
  userId: string | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return { crisisFlagged: false };

      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: postId!,
          author_id: userId!,
          body: trimmed.slice(0, COMMENT_MAX),
        })
        .select("crisis_flagged_at")
        .single();

      if (error) throw error;

      return { crisisFlagged: data.crisis_flagged_at !== null };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["postComments", postId],
      });
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
    },
  });
};

/** Marking a request answered is what opens the door to writing a testimony. */
export const useMarkAnswered = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase
        .from("posts")
        .update({ answered_at: new Date().toISOString() })
        .eq("id", postId)
        .select("id");

      if (error) throw error;

      // A row count of zero is how RLS refuses an update: no error, no rows.
      if (!data?.length) throw new Error("mark_answered_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
    },
  });
};

export const useDeletePrayerRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .select("id");

      if (error) throw error;
      if (!data?.length) throw new Error("delete_post_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
    },
  });
};

/** Circle admins only; the open wall has nobody in charge, and says so. */
export const useHidePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.rpc("hide_post", {
        p_post_id: postId,
      });

      if (error) throw error;

      // The RPC answers false rather than raising when you are not an admin, so
      // ignoring the payload would show success on a write that did nothing.
      if (data !== true) throw new Error("hide_post_refused");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
    },
  });
};

/**
 * Ocultar un comentario, que es lo que faltaba de la moderación.
 *
 * `hide_comment()` existía en la base desde que existen las peticiones y **no
 * la llamaba nadie**: quien administra un círculo podía ocultar un mensaje y una
 * petición, pero no un comentario — que es donde más fácil es dejar algo feo,
 * porque cuelga de lo que otra persona escribió.
 */
export const useHideComment = (postId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data, error } = await supabase.rpc("hide_comment", {
        p_comment_id: commentId,
      });

      if (error) throw error;

      // Contesta `false` en vez de lanzar cuando no administras, así que
      // ignorar el payload enseñaría un éxito sobre una escritura que no ocurrió.
      if (data !== true) throw new Error("hide_comment_refused");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["postComments", postId],
      });
      // El contador de comentarios vive en la tarjeta de la petición.
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
      void queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
    },
  });
};

export const useReportPost = (userId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { id: string; kind: "post" | "comment" }) => {
      const { error } = await supabase.from("reports").insert({
        reporter_id: userId!,
        target_type: input.kind,
        target_id: input.id,
      });

      if (error) throw error;
    },
  });
