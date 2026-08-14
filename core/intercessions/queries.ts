import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/core/observability/track";
import { supabase } from "@/utils/supabase";

/** A plan someone else shared with me, showing their day for today. */
export type SharedPlan = {
  plan_id: string;
  plan_title: string;
  owner_id: string;
  owner_name: string;
  owner_avatar_url: string | null;
  day_id: string;
  day_number: number;
  day_title: string;
  scripture_ref: string | null;
  scripture_text: string | null;
  intercessor_prayer: string | null;
  already_prayed: boolean;
};

/** Someone who prayed for my day. */
export type Intercession = {
  intercession_id: string;
  intercessor_id: string;
  intercessor_name: string;
  intercessor_avatar_url: string | null;
  message: string | null;
  day_number: number;
  created_at: string;
};

export const MESSAGE_MAX = 280;

/**
 * Short warmths that carry the gesture without asking anyone to compose a
 * sentence. Keys resolve through i18n so they arrive in the reader's language,
 * and the emoji travels with the phrase rather than sitting on its own.
 */
export const QUICK_MESSAGE_KEYS = [
  "withYou",
  "strength",
  "godHears",
  "hugs",
] as const;

export const usePlansSharedWithMe = (userId: string | undefined) =>
  useQuery({
    queryKey: ["sharedWithMe", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<SharedPlan[]> => {
      const { data, error } = await supabase.rpc("plans_shared_with_me");

      if (error) throw error;

      return (data ?? []) as SharedPlan[];
    },
  });

/**
 * One shared day, resolved on the server rather than found inside the list
 * above.
 *
 * `/orar/[planId]` used to look this plan up by filtering
 * `usePlansSharedWithMe`'s result client-side. That happened to read right,
 * but it made the authorization real answer whatever the list's cache said —
 * a stale or partial cache would show a day that a fresh check would refuse,
 * or hide one that is genuinely shared. `get_shared_plan_day` applies the same
 * B2 contract (explicit share or circle, never a bare `public`) directly in
 * Postgres for this one plan, so a direct link — including a push deep link —
 * gets the real answer instead of whatever happened to be cached.
 */
export const useSharedPlanDay = (planId: string | undefined) =>
  useQuery({
    queryKey: ["sharedPlanDay", planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<SharedPlan | null> => {
      const { data, error } = await supabase.rpc("get_shared_plan_day", {
        p_plan_id: planId!,
      });

      if (error) throw error;

      return ((data ?? []) as SharedPlan[])[0] ?? null;
    },
  });

export const useWhoPrayedForMe = (userId: string | undefined) =>
  useQuery({
    queryKey: ["whoPrayedForMe", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Intercession[]> => {
      const { data, error } = await supabase.rpc("who_prayed_for_me");

      if (error) throw error;

      return (data ?? []) as Intercession[];
    },
  });

export class AlreadyPrayed extends Error {
  constructor() {
    super("already_prayed");
    this.name = "AlreadyPrayed";
  }
}

/**
 * The button the whole product rests on. `plan_owner_id` is set by a trigger, so
 * the client cannot claim to have prayed for someone else's plan.
 */
export const usePrayForSomeone = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dayId,
      message,
    }: {
      dayId: string;
      message?: string;
    }) => {
      const { error } = await supabase.from("intercessions").insert({
        plan_day_id: dayId,
        intercessor_id: userId!,
        message: message?.trim().slice(0, MESSAGE_MAX) || null,
      });

      if (error) {
        // The unique constraint is the anti-spam rule, not a bug: pressing the
        // button twice means the same thing as pressing it once.
        if (error.code === "23505") {
          throw new AlreadyPrayed();
        }

        throw error;
      }
    },
    // onSettled, not onSuccess: pressing twice throws AlreadyPrayed, which the
    // screen deliberately swallows. With the refresh on the success path only,
    // the card kept offering "Oré por ti" and every further press did nothing
    // visible — indistinguishable from a broken button.
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["sharedWithMe", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["sharedPlanDay"],
      });
    },
    onSuccess: () => {
      track("intercession", { outcome: "created" });
    },
    onError: (caught) => {
      // El doble tap no es un fallo del funnel: es la misma intercesión
      // contada una vez, que es exactamente el punto de "una sola entrega
      // por oración" — se distingue del evento de arriba, nunca se cuenta
      // como una segunda `created`.
      track("intercession", {
        outcome: caught instanceof AlreadyPrayed ? "already_prayed" : "error",
      });
    },
  });
};

/**
 * Free text travelling from one user to another is a moderation surface, so it
 * has to be reportable from the screen where it is read.
 *
 * Reporting used to file a row and change nothing the reporter could see: the
 * message stayed, and came back on the next refetch. It now also hides the text
 * for them, server-side, so no cache is holding it and it cannot reappear. The
 * prayer itself still counts — only the words go away.
 */
export const useReportIntercession = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      intercessionId,
      reason,
    }: {
      intercessionId: string;
      reason?: string;
    }) => {
      const { error } = await supabase.from("reports").insert({
        reporter_id: userId!,
        target_type: "intercession",
        target_id: intercessionId,
        reason: reason?.slice(0, 1000) ?? null,
      });

      if (error) throw error;

      const { error: hideError } = await supabase
        .from("intercessions")
        .update({ message_hidden_at: new Date().toISOString() })
        .eq("id", intercessionId);

      if (hideError) throw hideError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["whoPrayedForMe", userId],
      });
    },
  });
};
