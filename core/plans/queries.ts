import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

export type PlanStatus =
  "generating" | "failed" | "active" | "completed" | "archived";

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
  interpretation: string | null;
  daily_action: string | null;
  prayer_body: string;
  unlock_date: string;
  intercession_count: number;
};

const today = () => new Date().toISOString().slice(0, 10);

export type PlanProgress = {
  days_total: number;
  days_written: number;
  days_unlocked: number;
  days_prayed: number;
  intercessions_received: number;
  finished: boolean;
};

const PLAN_COLUMNS =
  "id, title, theme, status, duration_days, start_date, generation_error, created_at";

/**
 * All the plans you own, newest first.
 *
 * `useOwnPlan` returned only the most recent one, which was fine while the free
 * allowance was a single plan. At three, the other two existed, counted against
 * the allowance, and could not be opened from anywhere in the app.
 */
export const useMyPlans = (userId: string | undefined) =>
  useQuery({
    queryKey: ["myPlans", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<OwnPlan[]> => {
      const { data, error } = await supabase
        .from("prayer_plans")
        .select(PLAN_COLUMNS)
        .eq("owner_id", userId!)
        .in("status", ["generating", "active", "failed"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as OwnPlan[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((plan) => plan.status === "generating")
        ? 3000
        : false,
  });

/**
 * Which plan the home screen is walking.
 *
 * Kept on the server rather than in the client because a choice that lives on
 * the device is lost on reinstall — and because the reminder push will need to
 * know which plan it is talking about.
 */
export const useActivePlanId = (userId: string | undefined) =>
  useQuery({
    queryKey: ["activePlan", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("profile_settings")
        .select("active_plan_id")
        .eq("id", userId!)
        .maybeSingle();

      if (error) throw error;

      return (
        (data as { active_plan_id: string | null } | null)?.active_plan_id ??
        null
      );
    },
  });

export const useSetActivePlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase
        .from("profile_settings")
        .update({ active_plan_id: planId })
        .eq("id", userId!)
        .select("active_plan_id");

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("set_active_plan_no_rows");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activePlan", userId] });
    },
  });
};

/** How far along a plan is, and whether it is over. */
export const usePlanProgress = (planId: string | undefined) =>
  useQuery({
    queryKey: ["planProgress", planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<PlanProgress | null> => {
      const { data, error } = await supabase.rpc("plan_progress", {
        p_plan_id: planId!,
      });

      if (error) throw error;

      return ((data ?? []) as PlanProgress[])[0] ?? null;
    },
  });

/**
 * The latest unlocked day. Future days are invisible by policy, so this is
 * simply the highest day number the database is willing to return.
 *
 * `isGenerating` matters more than it looks. This query switches on as soon as
 * the plan row exists — which is *before* any day has been written — so it
 * caches null. Nothing ever invalidated this key, and useOwnPlan stops polling
 * the moment the status leaves 'generating', so that null used to survive
 * forever: you created your first plan and Hoy sat on "Cargando…" until the app
 * was killed. Polling until the first day arrives is what closes that hole.
 */
export const useTodayDay = (planId: string | undefined, isGenerating = false) =>
  useQuery({
    queryKey: ["todayDay", planId],
    enabled: Boolean(planId),
    refetchInterval: (query) =>
      isGenerating && !query.state.data ? 3000 : false,
    queryFn: async (): Promise<PlanDay | null> => {
      // Through a function rather than the table: prayer_body and daily_action
      // are no longer in the caller's column grant, because a plan you shared
      // used to let the recipient read your own first-person prayer.
      const { data, error } = await supabase.rpc("get_my_day", {
        p_plan_id: planId!,
      });

      if (error) throw error;

      return ((data ?? []) as PlanDay[])[0] ?? null;
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

export type PlanVisibility = "private" | "circles" | "link";

export type NewPlanInput = {
  duration_days: number;
  topics?: string[];
  custom_topic?: string;
  visibility?: PlanVisibility;
  circle_ids?: string[];
  /** Set for a circle's own plan: it belongs to the circle, not to you. */
  group_id?: string;
};

export const useGeneratePlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewPlanInput) => {
      const { data, error } = await supabase.functions.invoke(
        "generate-prayer-plan",
        { body: input },
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

      // The server creates the share link when visibility is "link" and hands
      // back the token. Dropping it here is what left people with a "public
      // link" they could never actually see.
      return data as {
        plan_id: string;
        status: string;
        share_token: string | null;
      };
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: ["myPlans", userId] });

      // A circle's plan is not one of yours, so invalidating `myPlans` alone
      // left the circle screen still offering to create the plan it had just
      // created. Nothing in this app refetches on focus, so that state would
      // have survived until the app was killed.
      if (input.group_id) {
        void queryClient.invalidateQueries({
          queryKey: ["circlePlan", input.group_id],
        });
        void queryClient.invalidateQueries({
          queryKey: ["canCreateCirclePlan", input.group_id],
        });
      }
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
      void queryClient.invalidateQueries({ queryKey: ["myPlans", userId] });
    },
  });
};

/** The AI proposes a title; the owner can always change it. */
export const useRenamePlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      planId,
      title,
    }: {
      planId: string;
      title: string;
    }) => {
      const { error } = await supabase
        .from("prayer_plans")
        .update({ title: title.trim().slice(0, 140) })
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myPlans", userId] });
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

      // Marking the same day from two devices trips the unique index on
      // (user_id, plan_day_id). It is not a failure — you did pray — and
      // reporting "Algo salió mal" for it made the app look broken at the exact
      // moment it had worked. `usePrayForSomeone` has treated this code as a
      // success since the start; this one did not.
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prayedToday", dayId] });
      // The streak is bumped by a trigger, so the cached value is stale the
      // moment this succeeds.
      void queryClient.invalidateQueries({ queryKey: ["streak", userId] });
      // And the closing summary counts the days you prayed.
      void queryClient.invalidateQueries({ queryKey: ["planProgress"] });
    },
  });
};

export const todayIso = today;

export type PlanDaySummary = {
  id: string;
  day_number: number;
  title: string;
  scripture_ref: string | null;
  prayed: boolean;
};

/**
 * Every day of the plan that has unlocked, newest first.
 *
 * Future days stay hidden even here: unlocking one a day is the mechanic, and
 * a history screen must not become the way around it.
 */
export const usePlanDays = (planId: string | undefined) =>
  useQuery({
    queryKey: ["planDays", planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<PlanDaySummary[]> => {
      const { data, error } = await supabase.rpc("my_plan_days", {
        p_plan_id: planId!,
      });

      if (error) throw error;

      return (data ?? []) as PlanDaySummary[];
    },
  });

/** A specific day of your own plan, by its number. */
export const usePlanDay = (
  planId: string | undefined,
  dayNumber: number | undefined,
) =>
  useQuery({
    queryKey: ["planDay", planId, dayNumber],
    enabled: Boolean(planId) && Number.isInteger(dayNumber),
    queryFn: async (): Promise<PlanDay | null> => {
      const { data, error } = await supabase.rpc("get_my_day", {
        p_plan_id: planId!,
        p_day_number: dayNumber!,
      });

      if (error) throw error;

      return ((data ?? []) as PlanDay[])[0] ?? null;
    },
  });

/**
 * Asks the server to write the stretches a stalled generation never got to.
 *
 * A plan whose first stretch landed and whose second crashed sat on the home
 * screen saying "seguimos preparándolo" forever: `isStuckGenerating` was true,
 * but both branches that handle it require *no* day, and this plan has one. So
 * the only state that offered a way out was the one where nothing had been
 * written at all — and this one, which keeps everything it already has, offered
 * none.
 *
 * The server's continuation path skips the paywall by design: the plan was
 * already paid for by being created.
 */
export const useContinuePlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.functions.invoke(
        "generate-prayer-plan",
        {
          body: { continue_plan_id: planId },
        },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myPlans", userId] });
      void queryClient.invalidateQueries({ queryKey: ["todayDay"] });
      void queryClient.invalidateQueries({ queryKey: ["planProgress"] });
    },
  });
};
