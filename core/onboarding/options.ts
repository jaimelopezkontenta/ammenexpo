/**
 * The one place the option lists live.
 *
 * `TOPIC_KEYS` used to be duplicated byte-for-byte between
 * `app/(onboarding)/bienvenida.tsx` and `app/plan/nuevo.tsx`, and
 * `REMINDER_HOURS` between the onboarding and `app/(tabs)/perfil.tsx` — the
 * latter with a comment asking the two copies not to diverge. At eight options
 * that was a nuisance; at sixteen it is a list somebody forgets.
 *
 * The server keeps its own Spanish labels in `generate-prayer-plan/prompt.ts`,
 * because a Deno edge function cannot import from here. A vitest asserts the
 * two agree rather than trusting them to.
 */

/**
 * What somebody is going through. Multi-select, capped — see SEASON_MAX.
 *
 * The last two matter more than they look. *Lejos de casa* is the case for a
 * large part of the Spanish-speaking world, and *la enfermedad de alguien
 * querido* is a different thing from your own health, which is the only place
 * it could go before.
 */
export const SEASON_KEYS = [
  "grief",
  "anxiety",
  "work",
  "family",
  "health",
  "decision",
  "gratitude",
  "faith",
  "loneliness",
  "relationship",
  "breakup",
  "money",
  "children",
  "studies",
  "farFromHome",
  "lovedOneIll",
] as const;

export const TOPIC_KEYS = [
  "peace",
  "wisdom",
  "health",
  "family",
  "provision",
  "forgiveness",
  "purpose",
  "gratitude",
  "strength",
  "patience",
  "hope",
  "protection",
  "guidance",
  "comfort",
  "rest",
  "courage",
] as const;

export const GENDER_KEYS = ["feminine", "masculine", "neutral"] as const;

/** The same hours and keys the profile offers, because it is the same list. */
export const REMINDER_HOURS: { key: string; hour: number }[] = [
  { key: "early", hour: 6 },
  { key: "morning", hour: 8 },
  { key: "noon", hour: 12 },
  { key: "evening", hour: 18 },
  { key: "night", hour: 21 },
];

/**
 * A plan written from eight simultaneous life situations describes none of them
 * in particular. Three is enough for the combinations that genuinely overlap —
 * anxiety, work and a decision to make — without the result going generic.
 */
export const SEASON_MAX = 3;

/**
 * Every hour chosen becomes a daily notification once push exists. Three is
 * already a lot for a reminder somebody set themselves; more is the app
 * talking to itself.
 */
export const REMINDER_MAX = 3;

/** Free text, and the same cap the server enforces twice on the way in. */
export const CUSTOM_TOPIC_MAX = 200;

/**
 * Add, remove, or refuse once the limit is reached.
 *
 * Refusing rather than dropping the oldest: silently evicting a choice somebody
 * made two taps ago is the kind of helpfulness nobody asks for.
 */
export const toggleWithLimit = (
  list: readonly string[],
  value: string,
  max?: number,
): string[] => {
  if (list.includes(value)) {
    return list.filter((entry) => entry !== value);
  }

  if (max !== undefined && list.length >= max) {
    return [...list];
  }

  return [...list, value];
};
