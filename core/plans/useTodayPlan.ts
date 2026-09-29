import {
  isStuckGenerating,
  useActivePlanId,
  useMyPlans,
  usePlanProgress,
  usePrayedToday,
  useTodayDay,
} from "./queries";
import { pickActivePlan } from "./todayView";

/**
 * El plan que Hoy enseña y su día: los planes, cuál es el activo, el día que
 * toca, si ya se oró y cuánto lleva escrito. Lo que la pestaña pedía en
 * cabeza, con las mismas consultas y en el mismo orden.
 */
export const useTodayPlan = (userId: string | undefined) => {
  const plansQuery = useMyPlans(userId);
  const { data: activePlanId } = useActivePlanId(userId);
  const plans = plansQuery.data;

  // Falls back to the newest plan, which is what this screen always showed and
  // is the right default for someone who has never chosen.
  const plan = pickActivePlan(plans, activePlanId);

  // Days appear one stretch at a time, so today's day is readable long before
  // the whole plan is written. Waiting for 'active' would hide a plan the user
  // could already be praying.
  const dayQuery = useTodayDay(
    plan && plan.status !== "failed" ? plan.id : undefined,
    plan?.status === "generating",
  );
  const day = dayQuery.data;
  const { data: prayed } = usePrayedToday(day?.id);
  const { data: progress } = usePlanProgress(plan?.id);

  return {
    plans,
    plansQuery,
    plan,
    day,
    dayQuery,
    prayed,
    progress,
    stuck: isStuckGenerating(plan, progress),
  };
};
