export type Streak = {
  streak_count: number;
  streak_last_day: string | null;
};

/**
 * Whole calendar days between a stored date and a moment in time.
 *
 * Both sides are reduced to a calendar date first. `streak_last_day` is written
 * by the database in the user's own timezone, and `to` is read from the device,
 * which is in that same timezone — so this compares like with like. Subtracting
 * the raw timestamps instead would drift by the time of day.
 */
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
export const liveStreak = (
  streak: Streak | null | undefined,
  now = new Date(),
) => {
  if (!streak?.streak_last_day || streak.streak_count <= 0) {
    return 0;
  }

  return daysBetween(streak.streak_last_day, now) > 2 ? 0 : streak.streak_count;
};
