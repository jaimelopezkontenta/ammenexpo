import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

export type ShareLink = {
  id: string;
  token: string;
  expires_at: string | null;
};

export type PlanShare = {
  id: string;
  group_id: string | null;
};

/**
 * The live public link for a plan, if there is one.
 *
 * Revoked and expired links are filtered here rather than in the screen so
 * "there is no link" and "the link no longer works" collapse into the same
 * state: the owner is offered a fresh one either way.
 */
export const usePlanShareLink = (planId: string | undefined) =>
  useQuery({
    queryKey: ["planShareLink", planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<ShareLink | null> => {
      const { data, error } = await supabase
        .from("share_links")
        .select("id, token, expires_at")
        .eq("plan_id", planId!)
        .eq("scope", "plan")
        .is("revoked_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return data as ShareLink | null;
    },
  });

export const useCreateShareLink = (planId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from("share_links")
        .insert({ scope: "plan", plan_id: planId!, created_by: userId })
        .select("id, token, expires_at")
        .single();

      if (error) throw error;

      return data as ShareLink;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["planShareLink", planId] });
    },
  });
};

/**
 * Revoking keeps the row and stamps it, so a link that was once shared stays
 * auditable instead of vanishing. `get_shared_plan_preview` already refuses
 * revoked tokens, so this closes the tap for everyone immediately.
 */
export const useRevokeShareLink = (planId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["planShareLink", planId] });
    },
  });
};

/** Which circles this plan is currently shared with. */
export const usePlanCircles = (planId: string | undefined) =>
  useQuery({
    queryKey: ["planCircles", planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("plan_shares")
        .select("group_id")
        .eq("plan_id", planId!)
        .not("group_id", "is", null);

      if (error) throw error;

      return (data ?? []).map((row) => (row as PlanShare).group_id!);
    },
  });

export const useTogglePlanCircle = (
  planId: string | undefined,
  userId: string | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      circleId,
      shared,
    }: {
      circleId: string;
      shared: boolean;
    }) => {
      if (shared) {
        const { error } = await supabase
          .from("plan_shares")
          .delete()
          .eq("plan_id", planId!)
          .eq("group_id", circleId);

        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("plan_shares").insert({
        plan_id: planId!,
        group_id: circleId,
        created_by: userId!,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["planCircles", planId] });
    },
  });
};

/** Just enough of a plan to title the share screen and write the invitation. */
export const usePlanSummary = (planId: string | undefined) =>
  useQuery({
    queryKey: ["planSummary", planId],
    enabled: Boolean(planId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prayer_plans")
        .select("id, title, theme, duration_days, visibility")
        .eq("id", planId!)
        .maybeSingle();

      if (error) throw error;

      return data as {
        id: string;
        title: string;
        theme: string | null;
        duration_days: number;
        visibility: string;
      } | null;
    },
  });
