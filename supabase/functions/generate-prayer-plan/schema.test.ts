import { describe, expect, it } from "vitest";

import { isGeneratedPlan } from "./schema";

describe("isGeneratedPlan", () => {
  it("accepts a valid plan with integer day_number", () => {
    const plan = {
      title: "Descanso en la tormenta",
      theme: "Confianza en medio de la ansiedad",
      days: [
        {
          day_number: 1,
          title: "Primer paso",
          scripture_ref: "Filipenses 4:6-7",
          interpretation: "Dios nos llama a no andar ansiosos.",
          daily_action: "Escribe tres cosas por las que agradece.",
          prayer_body: "Señor, ayúdame a confiar en ti.",
          intercessor_prayer: "Te pido por Ana, que necesita paz.",
        },
      ],
    };

    expect(isGeneratedPlan(plan)).toBe(true);
  });

  it("rejects a plan with decimal day_number", () => {
    const plan = {
      title: "Descanso",
      theme: "Confianza",
      days: [
        {
          day_number: 1.5,
          title: "Día uno",
          scripture_ref: "Salmo 23:1",
          interpretation: "El Señor es mi pastor.",
          daily_action: "Lee el salmo.",
          prayer_body: "Señor, guíame.",
          intercessor_prayer: "Te pido por Luis.",
        },
      ],
    };

    expect(isGeneratedPlan(plan)).toBe(false);
  });

  it("rejects a plan with day_number equal to 0", () => {
    const plan = {
      title: "Descanso",
      theme: "Confianza",
      days: [
        {
          day_number: 0,
          title: "Inicio",
          scripture_ref: "Mateo 11:28",
          interpretation: "Jesús invita al descanso.",
          daily_action: "Descansa diez minutos.",
          prayer_body: "Señor, dame reposo.",
          intercessor_prayer: "Te pido por Carlos.",
        },
      ],
    };

    expect(isGeneratedPlan(plan)).toBe(false);
  });

  it("rejects a plan missing a required field", () => {
    const plan = {
      title: "Descanso",
      theme: "Confianza",
      days: [
        {
          day_number: 1,
          title: "Día uno",
          // scripture_ref is missing
          interpretation: "El Señor es mi pastor.",
          daily_action: "Lee el salmo.",
          prayer_body: "Señor, guíame.",
          intercessor_prayer: "Te pido por Ana.",
        },
      ],
    };

    expect(isGeneratedPlan(plan)).toBe(false);
  });

  it("rejects null", () => {
    expect(isGeneratedPlan(null)).toBe(false);
  });

  it("rejects an empty object", () => {
    expect(isGeneratedPlan({})).toBe(false);
  });
});
