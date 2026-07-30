import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

export type PlanStatus =
  | "generating"
  | "failed"
  | "active"
  | "completed"
  | "archived";

export type OwnPlan = {
  id: string;
  title: string;
  theme: string | null;
  status: PlanStatus;
  duration_days: number;
  start_date: string;
  generation_error: string | null;
  created_at: string;
};

/**
 * Generation runs in a background task with a wall-clock budget. If the isolate
 * is killed mid-flight nothing ever updates the row, so a plan can sit in
 * 'generating' forever and the app would spin on it indefinitely. After this
 * long we stop believing it and offer a retry.
 */
export const STUCK_AFTER_MS = 5 * 60 * 1000;

export const isStuckGenerating = (plan: OwnPlan | null | undefined) =>
  plan?.status === "generating" &&
  Date.now() - new Date(plan.created_at).getTime() > STUCK_AFTER_MS;

export type PlanDay = {
  id: string;
  day_number: number;
  title: string;
  scripture_ref: string | null;
  scripture_text: string | null;
  prayer_body: string;
  reflection_question: string | null;
  unlock_date: string;
  intercession_count: number;
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The user's own most recent plan. Filtered by owner because RLS also lets a
 * user read plans other people shared with them, which must not show up as
 * "your plan of the day".
 */
export const useOwnPlan = (userId: string | undefined) =>
  useQuery({
    queryKey: ["ownPlan", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<OwnPlan | null> => {
      const { data, error } = await supabase
        .from("prayer_plans")
        .select(
          "id, title, theme, status, duration_days, start_date, generation_error, created_at",
        )
        .eq("owner_id", userId!)
        .in("status", ["generating", "active", "failed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return data as OwnPlan | null;
    },
    // Generation finishes in the background, so keep checking while it runs.
    refetchInterval: (query) =>
      query.state.data?.status === "generating" ? 3000 : false,
  });

/**
 * The latest unlocked day. Future days are invisible by policy, so this is
 * simply the highest day number the database is willing to return.
 */
export const useTodayDay = (planId: string | undefined) =>
  useQuery({
    queryKey: ["todayDay", planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<PlanDay | null> => {
      const { data, error } = await supabase
        .from("prayer_plan_days")
        .select(
          "id, day_number, title, scripture_ref, scripture_text, prayer_body, reflection_question, unlock_date, intercession_count",
        )
        .eq("plan_id", planId!)
        .order("day_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return data as PlanDay | null;
    },
  });

export const usePrayedToday = (dayId: string | undefined) =>
  useQuery({
    queryKey: ["prayedToday", dayId],
    enabled: Boolean(dayId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("prayer_logs")
        .select("id", { count: "exact", head: true })
        .eq("plan_day_id", dayId!);

      if (error) throw error;

      return (count ?? 0) > 0;
    },
  });

export class PlanLimitReached extends Error {
  constructor() {
    super("plan_limit_reached");
    this.name = "PlanLimitReached";
  }
}

export const useGeneratePlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (durationDays: number) => {
      const { data, error } = await supabase.functions.invoke(
        "generate-prayer-plan",
        { body: { duration_days: durationDays } },
      );

      if (error) {
        // 402 is the paywall, not a failure: surface it as its own state.
        const status = (error as { context?: { status?: number } }).context
          ?.status;

        if (status === 402) {
          throw new PlanLimitReached();
        }

        throw error;
      }

      return data as { plan_id: string; status: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ownPlan", userId] });
    },
  });
};

/**
 * Marks an abandoned generation as failed before retrying. Failed plans are
 * excluded from the free-plan allowance, so a crashed attempt does not burn the
 * user's only free plan.
 */
export const useAbandonPlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("prayer_plans")
        .update({ status: "failed", generation_error: "abandoned" })
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ownPlan", userId] });
    },
  });
};

export const useMarkPrayed = (dayId: string | undefined, userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("prayer_logs")
        .insert({ plan_day_id: dayId!, user_id: userId! });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prayedToday", dayId] });
    },
  });
};

export const todayIso = today;
