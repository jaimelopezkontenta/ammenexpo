import { describe, expect, it } from "vitest";

import { SEASON_KEYS, TOPIC_KEYS } from "../onboarding/options";
import { sanitizeOnboardingAnswers } from "./onboardingAnswers";

/**
 * El cinturón de `useOnboardingAnswers`: `onboarding_answers` es jsonb libre y
 * hubo filas con etiquetas traducidas donde el catálogo usa claves («paz» vs
 * `peace` — el propio seed hasta 2026-08-28). Una clave desconocida marcaba
 * cero chips, pintaba `onboarding.topics.paz` literal en el resumen de
 * plan/nuevo y mandaba temas que el generador descartaba en silencio.
 */
describe("sanitizeOnboardingAnswers", () => {
  it("filtra las claves que el catálogo no conoce", () => {
    const dirty = {
      topics: ["peace", "paz", "familia", "family"],
      seasons: ["decision", "una decisión importante"],
      gender: "male",
    };

    const clean = sanitizeOnboardingAnswers(dirty);

    expect(clean?.topics).toEqual(["peace", "family"]);
    expect(clean?.seasons).toEqual(["decision"]);
    // El resto viaja intacto: el filtro es de listas, no un validador total.
    expect(clean?.gender).toBe("male");
  });

  it("deja pasar tal cual una respuesta limpia y el null", () => {
    const clean = {
      topics: [...TOPIC_KEYS.slice(0, 2)],
      seasons: [...SEASON_KEYS.slice(0, 1)],
    };

    expect(sanitizeOnboardingAnswers(clean)).toEqual(clean);
    expect(sanitizeOnboardingAnswers(null)).toBeNull();
  });

  it("tolera respuestas sin listas (filas viejas)", () => {
    expect(sanitizeOnboardingAnswers({ season: "work" })).toEqual({
      season: "work",
      topics: undefined,
      seasons: undefined,
    });
  });
});
