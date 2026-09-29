/**
 * The one place the option lists live.
 *
 * `TOPIC_KEYS` used to be duplicated byte-for-byte between
 * `app/(onboarding)/bienvenida.tsx` and `app/plan/nuevo.tsx`, and
 * `REMINDER_HOURS` between the onboarding and `app/(tabs)/perfil.tsx` — the
 * latter with a comment asking the two copies not to diverge. At eight options
 * that was a nuisance; at sixteen it is a list somebody forgets.
 *
 * The server keeps its own labels, in Spanish and English, in
 * `generate-prayer-plan/prompt.ts`, because a Deno edge function cannot import
 * from here. A vitest asserts they agree rather than trusting them to.
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

/**
 * Las familias de las dos paredes de 16 chips del onboarding. Dieciséis
 * píldoras de golpe se leen como inventario; en cuatro grupos con rótulo cada
 * opción tiene vecindario y la pantalla se recorre con la vista, no se
 * escanea. Los rótulos viven en `onboarding.seasonGroups.*` /
 * `onboarding.topicGroups.*` (es+en); un vitest garantiza que los grupos son
 * una partición exacta de sus KEYS — ni huérfanos ni repetidos.
 */
export const SEASON_GROUPS: { key: string; keys: string[] }[] = [
  { key: "inside", keys: ["anxiety", "grief", "loneliness", "gratitude"] },
  {
    key: "mine",
    keys: ["family", "relationship", "breakup", "children", "lovedOneIll"],
  },
  {
    key: "path",
    keys: ["work", "studies", "decision", "money", "farFromHome"],
  },
  { key: "faithBody", keys: ["faith", "health"] },
];

export const TOPIC_GROUPS: { key: string; keys: string[] }[] = [
  { key: "innerPeace", keys: ["peace", "rest", "comfort", "hope"] },
  { key: "path", keys: ["wisdom", "guidance", "purpose", "courage"] },
  { key: "mine", keys: ["family", "health", "provision", "protection"] },
  {
    key: "heart",
    keys: ["gratitude", "forgiveness", "strength", "patience"],
  },
];

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
