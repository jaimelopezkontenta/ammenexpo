import { SEASON_KEYS, TOPIC_KEYS } from "../onboarding/options";

export type OnboardingAnswers = {
  /** Several since the onboarding went multi-select. */
  seasons?: string[];
  /** The single-season shape, kept so older rows still read. */
  season?: string;
  topics?: string[];
  custom_topic?: string;
  gender?: string;
  reminder_keys?: string[];
};

/**
 * `onboarding_answers` es jsonb libre y el RPC lo guarda tal cual: hubo filas
 * (el propio seed hasta 2026-08-28) con etiquetas traducidas («paz») donde el
 * catálogo usa claves (`peace`). Una clave desconocida aguas abajo es triple
 * veneno: chips que no se marcan, `t()` devolviendo la clave cruda en el
 * resumen de plan/nuevo, y temas que el generador descarta en silencio. El
 * cinturón filtra aquí, en la única puerta de lectura, para todo consumidor.
 *
 * Módulo propio y con imports relativos para que el test hermano corra en
 * Vitest sin arrastrar el cliente de Supabase que vive en `queries.ts`.
 */
export const sanitizeOnboardingAnswers = (
  answers: OnboardingAnswers | null,
): OnboardingAnswers | null => {
  if (!answers) return null;

  return {
    ...answers,
    topics: answers.topics?.filter((key) =>
      (TOPIC_KEYS as readonly string[]).includes(key),
    ),
    seasons: answers.seasons?.filter((key) =>
      (SEASON_KEYS as readonly string[]).includes(key),
    ),
  };
};
