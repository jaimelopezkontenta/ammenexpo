import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

export type Streak = {
  streak_count: number;
  streak_last_day: string | null;
};

const daysBetween = (from: string, to: Date) =>
  Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

/**
 * The stored count is only true up to the last day the user prayed. A trigger
 * cannot fire for a day nobody showed up, so a streak that has already lapsed
 * would keep reading as alive until the next prayer reset it. The database is
 * the only writer; this just refuses to display a number we know is stale.
 *
 * Mirrors the grace rule in bump_personal_streak: one missed day is forgiven.
 */
export const liveStreak = (streak: Streak | null | undefined, now = new Date()) => {
  if (!streak?.streak_last_day || streak.streak_count <= 0) {
    return 0;
  }

  return daysBetween(streak.streak_last_day, now) > 2 ? 0 : streak.streak_count;
};

export const useStreak = (userId: string | undefined) =>
  useQuery({
    queryKey: ["streak", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Streak | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("streak_count, streak_last_day")
        .eq("id", userId!)
        .maybeSingle();

      if (error) throw error;

      return data as Streak | null;
    },
  });
