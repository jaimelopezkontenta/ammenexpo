import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import {
  cacheTodayDay,
  enqueuePrayed,
  isNetworkError,
  readCachedTodayDay,
  readPrayedQueue,
} from "@/core/plans/offline";
import {
  classifyContinueReject,
  CreateAttemptKey,
  functionErrorStatus,
  readFunctionErrorCode,
} from "@/core/plans/requestId";
import {
  isStuckGenerating,
  STUCK_AFTER_MS,
  type PlanProgressLike,
} from "@/core/plans/stuckDetection";
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
  /**
   * General row timestamp. It changes for a rename too, so recovery must not
   * use it as a generation clock.
   */
  updated_at: string;
  /**
   * Dedicated generation clock, independent of rename/visibility writes. This
   * is the heartbeat `isStuckGenerating` prefers; it falls back directly to
   * `created_at`, never to `updated_at`.
   */
  generation_heartbeat_at: string | null;
};

export { isStuckGenerating, STUCK_AFTER_MS };
export type { PlanProgressLike };

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

export type PlanProgress = {
  days_total: number;
  days_written: number;
  days_unlocked: number;
  days_prayed: number;
  intercessions_received: number;
  finished: boolean;
};

const PLAN_COLUMNS =
  "id, title, theme, status, duration_days, start_date, generation_error, created_at, updated_at, generation_heartbeat_at";

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
      try {
        // Through a function rather than the table: prayer_body and
        // daily_action are no longer in the caller's column grant, because a
        // plan you shared used to let the recipient read your own first-person
        // prayer.
        const { data, error } = await supabase.rpc("get_my_day", {
          p_plan_id: planId!,
        });

        if (error) throw error;

        const day = ((data ?? []) as PlanDay[])[0] ?? null;

        // Cachear cada lectura exitosa es lo que permite releer el día sin
        // red: la próxima vez que `get_my_day` falle por red, se sirve esto.
        if (day) {
          await cacheTodayDay(planId!, day);
        }

        return day;
      } catch (e) {
        // Solo se tira de caché cuando el fallo es de red. Un error de RLS o
        // un 23505 no es "no hay conexión", y debe seguir propagándose para
        // que la UI muestre el error real en vez de un día viejo.
        if (isNetworkError(e)) {
          const cached = await readCachedTodayDay(planId!);
          if (cached) return cached;
        }

        throw e;
      }
    },
  });

export const usePrayedToday = (dayId: string | undefined) =>
  useQuery({
    queryKey: ["prayedToday", dayId],
    enabled: Boolean(dayId),
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("prayer_logs")
          .select("id", { count: "exact", head: true })
          .eq("plan_day_id", dayId!);

        if (error) throw error;

        return (count ?? 0) > 0;
      } catch (e) {
        // Sin red, un "oré" encolado tiene que seguir leyéndose como orado:
        // si no, al refetch o al reabrir Hoy el orbe desaparece.
        if (isNetworkError(e) && dayId) {
          const queue = await readPrayedQueue();
          if (queue.some((entry) => entry.dayId === dayId)) return true;
        }

        throw e;
      }
    },
  });

export class PlanLimitReached extends Error {
  constructor() {
    super("plan_limit_reached");
    this.name = "PlanLimitReached";
  }
}

/**
 * Another invocation is already writing the next stretch of this plan (the
 * server lease is held). Not a failure: the work is already happening, and
 * saying "algo salió mal" would be a lie at the exact moment it is working.
 */
export class GenerationInFlight extends Error {
  constructor() {
    super("generation_in_flight");
    this.name = "GenerationInFlight";
  }
}

/**
 * This request_id already belongs to another ledger row (another plan, or
 * this plan's own reservation). Definitive: the next tap must mint a new key.
 */
export class RequestIdConflict extends Error {
  constructor() {
    super("request_id_conflict");
    this.name = "RequestIdConflict";
  }
}

/**
 * The AI provider is not configured or unreachable (503 from the function).
 * Distinct from "you ran out" so the screen can say something true instead of
 * a generic red line.
 */
export class GenerationUnavailable extends Error {
  constructor() {
    super("generation_unavailable");
    this.name = "GenerationUnavailable";
  }
}

export type PlanVisibility = "private" | "circles" | "link" | "public";

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

  // A stable idempotency key per create attempt. A network timeout and an
  // immediate retry of the SAME form must not consume another slot, so the key
  // is minted once and reused across retries; `clear()` on definitive success
  // guarantees the next create never reuses a consumed key.
  const attemptKey = useRef(new CreateAttemptKey());

  return useMutation({
    mutationFn: async (input: NewPlanInput) => {
      const { data, error } = await supabase.functions.invoke(
        "generate-prayer-plan",
        { body: { ...input, request_id: attemptKey.current.acquire() } },
      );

      if (error) {
        // 402 is the paywall, not a failure: surface it as its own state.
        const status = (error as { context?: { status?: number } }).context
          ?.status;

        if (status === 402) {
          throw new PlanLimitReached();
        }

        // 503 means the provider is off or misconfigured, not that the user
        // did anything wrong.
        if (status === 503) {
          throw new GenerationUnavailable();
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
      // The reservation went through: this attempt is closed, and the next
      // create must mint a fresh key (reusing it would return the old plan).
      attemptKey.current.clear();

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
    onError: (error) => {
      // Discard the key on definitive errors (402 paywall, 400/403/409) so the
      // next attempt gets a fresh request_id. Network timeouts and 500/503 keep
      // the key so a retry stays idempotent.
      if (error instanceof PlanLimitReached) {
        // 402 (quota exhausted) is definitive: the mutation rethrows it as
        // PlanLimitReached, which has no context.status for clearOnError to see.
        attemptKey.current.clear();
        return;
      }

      attemptKey.current.clearOnError(error);
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

/**
 * Archives an active/completed plan you own. Quota is not refunded — the
 * ledger is not touched. Status writes go through the RPC because the
 * client grant on `prayer_plans.status` was revoked.
 */
export const useArchivePlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.rpc("archive_my_plan", {
        p_plan_id: planId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myPlans", userId] });
      void queryClient.invalidateQueries({ queryKey: ["activePlan", userId] });
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
      if (!error || error.code === "23505") return;

      // Sin red: se encola en vez de fallar. La UI igual marca "Oraste hoy"
      // (onSuccess invalida) y el flush lo manda a la base al volver la red.
      if (isNetworkError(error)) {
        await enqueuePrayed({ dayId: dayId!, userId: userId! });
        return;
      }

      throw error;
    },
    onMutate: async () => {
      // Fijar "orado" antes de que vuelva la red: invalidar prayedToday
      // dispara un refetch que sin red conserva el false anterior y el
      // orbe nunca aparece.
      await queryClient.cancelQueries({ queryKey: ["prayedToday", dayId] });
      const previous = queryClient.getQueryData<boolean>([
        "prayedToday",
        dayId,
      ]);
      queryClient.setQueryData(["prayedToday", dayId], true);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(["prayedToday", dayId], context.previous);
      }
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

export type PlanDaySummary = {
  /** Null until the day opens: a locked day has no readable row. */
  id: string | null;
  day_number: number;
  title: string | null;
  scripture_ref: string | null;
  prayed: boolean;
  unlock_date: string;
  unlocked: boolean;
};

/**
 * Every day of the plan, newest first — including the ones still to come.
 *
 * The days ahead carry their number and their date and nothing else. Showing
 * that day 12 opens on Thursday is what makes a plan feel like a path; showing
 * what it says would be the way around the one-day-at-a-time mechanic the whole
 * product rests on.
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

export type PublicPlanDay = {
  plan_id: string;
  plan_title: string;
  plan_theme: string | null;
  owner_id: string;
  owner_name: string;
  owner_avatar_url: string | null;
  day_number: number;
  day_title: string;
  scripture_ref: string | null;
  scripture_text: string | null;
  intercession_count: number;
};

/**
 * A `public` plan opened from Comunidad — descubrible/abrible for anybody,
 * per the B2 contract, but read-only: this is not the Orar surface, so it
 * never returns the first-person prayer and there is no way to pray for it
 * from here. Praying requires an explicit share, which is `/orar/[planId]`
 * backed by `get_shared_plan_day`.
 */
export const usePublicPlanDay = (planId: string | undefined) =>
  useQuery({
    queryKey: ["publicPlanDay", planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<PublicPlanDay | null> => {
      const { data, error } = await supabase.rpc("get_public_plan_day", {
        p_plan_id: planId!,
      });

      if (error) throw error;

      return ((data ?? []) as PublicPlanDay[])[0] ?? null;
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

  // Stable idempotency key per plan. A timeout and an immediate retry of the
  // same "Continue" tap must not mint a new request_id — the server would see
  // it as a new claim and either reclaim (new lease, old worker orphaned) or
  // report `in_flight` (stuck behind the old lease). Each plan gets its own
  // CreateAttemptKey: 400/402/403/409-conflict/422 discard it; in_flight and
  // network/5xx keep it.
  const continueKeys = useRef(new Map<string, CreateAttemptKey>());

  return useMutation({
    mutationFn: async (planId: string) => {
      let attempt = continueKeys.current.get(planId);
      if (!attempt) {
        attempt = new CreateAttemptKey();
        continueKeys.current.set(planId, attempt);
      }

      const { error } = await supabase.functions.invoke(
        "generate-prayer-plan",
        {
          body: { continue_plan_id: planId, request_id: attempt.acquire() },
        },
      );

      if (error) {
        const status = functionErrorStatus(error);
        const code = await readFunctionErrorCode(error);
        const reject = classifyContinueReject(status, code);

        // in_flight is not definitive: keep the key so a retry is the same
        // request instead of minting one that then sits behind the live lease.
        if (reject === "in_flight") {
          throw new GenerationInFlight();
        }

        attempt.clearOnError(error);

        if (reject === "request_id_conflict") {
          throw new RequestIdConflict();
        }

        throw error;
      }
    },
    onSuccess: (_result, planId) => {
      // The continuation was accepted: close this attempt so the next cycle
      // gets a fresh key.
      continueKeys.current.get(planId)?.clear();

      void queryClient.invalidateQueries({ queryKey: ["myPlans", userId] });
      void queryClient.invalidateQueries({ queryKey: ["todayDay"] });
      void queryClient.invalidateQueries({ queryKey: ["planProgress"] });
    },
  });
};
