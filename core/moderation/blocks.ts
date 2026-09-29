import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import { qk } from "@/core/query/keys";
export type Block = {
  blocked_id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

/**
 * Blocking is silent and one-sided: the other person is never told, is not
 * removed from anything, and keeps their voice. What changes is what reaches
 * you — their messages, their "oré por ti", and their plan on the Orar tab.
 *
 * That breadth is the point. A block that only muted the chat would still let
 * someone's message land on the most personal screen in the app.
 */
export const useMyBlocks = (userId: string | undefined) =>
  useQuery({
    queryKey: qk.blocks(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Block[]> => {
      const { data, error } = await supabase
        .from("blocks")
        .select(
          "blocked_id, created_at, profiles!blocks_blocked_id_fkey(display_name, avatar_url)",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const entry = row as unknown as {
          blocked_id: string;
          created_at: string;
          profiles: { display_name: string; avatar_url: string | null } | null;
        };

        return {
          blocked_id: entry.blocked_id,
          created_at: entry.created_at,
          display_name: entry.profiles?.display_name ?? "",
          avatar_url: entry.profiles?.avatar_url ?? null,
        };
      });
    },
  });

/**
 * Everything a block hides is cached under a key of its own, and nothing in
 * this app refetches on focus — so without invalidating all of them the person
 * you just blocked stays on screen until the app is killed.
 */
const invalidateBlockedSurfaces = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
) => {
  void queryClient.invalidateQueries({ queryKey: qk.blocks(userId) });
  void queryClient.invalidateQueries({ queryKey: qk.circleMessages.root });
  void queryClient.invalidateQueries({ queryKey: qk.whoPrayedForMe.root });
  void queryClient.invalidateQueries({ queryKey: qk.sharedWithMe(userId) });
  // Added when the wall and the testimonies arrived. Missing them meant the
  // person you had just blocked stayed on screen — the block *had* worked
  // server-side, so it was a lie that only a restart would clear.
  void queryClient.invalidateQueries({ queryKey: qk.prayerFeed.root });
  void queryClient.invalidateQueries({ queryKey: qk.postComments.root });
  void queryClient.invalidateQueries({ queryKey: qk.testimonies.root });
  void queryClient.invalidateQueries({ queryKey: qk.unreadCounts(userId) });
  void queryClient.invalidateQueries({ queryKey: qk.circleSharedPlans.root });
  // Y el perfil de la persona, que a partir del bloqueo deja de existir para
  // ti — y cuyos contadores acaban de cambiar, porque bloquear deshace el
  // seguimiento en los dos sentidos.
  void queryClient.invalidateQueries({ queryKey: qk.publicProfile.root });
};

export const useBlockUser = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase
        .from("blocks")
        .insert({ blocker_id: userId!, blocked_id: blockedId });

      if (error) throw error;
    },
    onSuccess: () => invalidateBlockedSurfaces(queryClient, userId),
  });
};

/** Undoing matters as much as doing: blocking in anger with no way back is its own trap. */
export const useUnblockUser = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { data, error } = await supabase
        .from("blocks")
        .delete()
        .eq("blocker_id", userId!)
        .eq("blocked_id", blockedId)
        .select("blocked_id");

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("unblock_no_rows");
      }
    },
    onSuccess: () => invalidateBlockedSurfaces(queryClient, userId),
  });
};
