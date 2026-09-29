export type GreetingKey =
  | "common.greetingMorning"
  | "common.greetingAfternoon"
  | "common.greetingEvening"
  | "common.greetingNight";

/**
 * Saludo por hora local. La madrugada (antes de las 5) no es "buenos días".
 */
export function greetingKey(hour: number): GreetingKey {
  if (hour < 5) return "common.greetingNight";
  if (hour < 12) return "common.greetingMorning";
  if (hour < 18) return "common.greetingAfternoon";
  if (hour < 21) return "common.greetingEvening";
  return "common.greetingNight";
}
