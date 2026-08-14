/**
 * Detección pura de "un plan quedó atascado a mitad de generación".
 *
 * Separado de `queries.ts` a propósito: es lógica pura, sin Supabase ni
 * `@react-native-async-storage`, para poder probarla con Vitest sin arrastrar
 * el cliente de datos — el mismo motivo por el que `core/notifications/resolveTarget.ts`
 * vive en su propio archivo.
 */

export type StuckPlanStatus =
  "generating" | "failed" | "active" | "completed" | "archived";

/**
 * The portion of a plan that the detector needs. `OwnPlan` (from `queries.ts`)
 * is structurally compatible, so no conversion is needed.
 */
export type StuckPlan = {
  status: StuckPlanStatus;
  duration_days: number;
  created_at: string;
  /**
   * Present for structural compatibility with `OwnPlan`; never a stuck clock.
   */
  updated_at?: string;
  /**
   * Dedicated generation heartbeat, refreshed on every claim and completion.
   * Independent of `updated_at` (rename/visibility) so non-generation writes
   * do not reset the stuck clock. May be `null` on rows whose first stretch has
   * not completed yet, or absent on rows cached before the column existed.
   */
  generation_heartbeat_at?: string | null;
};

/**
 * Generation runs in a background task with a wall-clock budget. If the isolate
 * is killed mid-flight nothing ever updates the row, so a plan can sit in
 * 'generating' forever and the app would spin on it indefinitely. After this
 * long we stop believing it and offer a retry. It matches the server's lease
 * (5 minutes), so the client and the database agree on when a generation is
 * truly gone.
 */
export const STUCK_AFTER_MS = 5 * 60 * 1000;

/** The sliver of `plan_progress` the stuck detector needs. */
export type PlanProgressLike =
  | {
      days_written: number;
      days_total: number;
    }
  | null
  | undefined;

/**
 * Is this plan stalled — generation should have moved by now, but has not?
 *
 * The detector answers one question: "should I offer a way to continue this
 * generation?" It is true only when a plan is *supposed* to be generating
 * (`generating`, or `active` with days still missing) and has not made progress
 * for longer than `STUCK_AFTER_MS`.
 *
 * A `failed`, `completed` or `archived` plan is never stalled: it is terminal,
 * and continuing it would be a lie (or, for `failed`, would restart a plan that
 * already spent its slot). A plan with every day written is never stalled
 * either — its generation is done even if the status has not caught up.
 *
 * `plan_progress` has an INNER JOIN to `prayer_plan_days`, so a `generating`
 * plan with no written days has no progress row at all. That `null` is not a
 * loading state for a generating plan: it is the real representation of a
 * first stretch that never landed. An `active` plan, in contrast, treats an
 * unknown progress row as still loading and is not stalled yet.
 *
 * The only clocks are `generation_heartbeat_at` → `created_at`. `updated_at`
 * must never be used: renaming a plan changes it without doing generation.
 */
export const isStuckGenerating = (
  plan: StuckPlan | null | undefined,
  progress: PlanProgressLike = null,
  now: number = Date.now(),
): boolean => {
  if (!plan) return false;

  // Terminal states: never offer continue to a plan that is done or dead.
  if (
    plan.status === "failed" ||
    plan.status === "completed" ||
    plan.status === "archived"
  ) {
    return false;
  }

  // Only these two states are ever mid-generation.
  if (plan.status !== "generating" && plan.status !== "active") {
    return false;
  }

  // `plan_progress` returns no row for an active plan while its query is still
  // loading/failed. It is not safe to offer a continuation until its known
  // progress says that generation is incomplete.
  if (!progress) {
    if (plan.status === "active") return false;

    // For `generating`, null is the real RPC shape for a plan with zero days.
    const clock = plan.generation_heartbeat_at ?? plan.created_at;
    return now - new Date(clock).getTime() > STUCK_AFTER_MS;
  }

  // A plan whose days are all written is complete even if its status has not
  // caught up with the last unlock date: generation is finished, not stalled.
  const daysTotal = progress.days_total;
  const daysWritten = progress.days_written;
  if (daysTotal > 0 && daysWritten >= daysTotal) {
    return false;
  }

  // In all incomplete cases, a rename cannot reset the recovery clock.
  const heartbeatRaw = plan.generation_heartbeat_at ?? plan.created_at;
  const heartbeat = new Date(heartbeatRaw).getTime();
  return now - heartbeat > STUCK_AFTER_MS;
};
