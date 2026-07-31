import { describe, expect, it } from "vitest";

import { sanitizeGeneratedText } from "./sanitize";

describe("sanitizeGeneratedText", () => {
  // The failure this exists for. A real generation ended an interpretation with
  // JSON punctuation, and it was stored and would have been shown to someone
  // who opened the app to pray.
  it("cuts the serialisation fragment that leaked into a real plan", () => {
    expect(
      sanitizeGeneratedText(
        "...sin vergüenza ni prisa por resolverlo todo hoy.},{",
      ),
    ).toBe("...sin vergüenza ni prisa por resolverlo todo hoy.");
  });

  it("leaves ordinary Spanish prose exactly as written", () => {
    const prose =
      "Señor, hoy no traigo soluciones. Traigo cansancio. Enséñame a descansar.";

    expect(sanitizeGeneratedText(prose)).toBe(prose);
  });

  // Punctuation that looks structural but is not: these must survive, or the
  // cure is worse than the disease.
  it("keeps question marks, quotation marks and accents", () => {
    expect(sanitizeGeneratedText("¿Qué te pesa hoy?")).toBe(
      "¿Qué te pesa hoy?",
    );
    expect(sanitizeGeneratedText('Él dijo: "ven a mí" y esperó.')).toBe(
      'Él dijo: "ven a mí" y esperó.',
    );
  });

  it("strips structure from the front as well as the back", () => {
    expect(sanitizeGeneratedText('{"Escribe en una nota')).toBe(
      "Escribe en una nota",
    );
    expect(sanitizeGeneratedText('Una acción concreta"}]')).toBe(
      "Una acción concreta",
    );
  });

  // An empty field is a worse outcome than a stray brace: the day would render
  // with a missing section rather than a slightly ugly one.
  it("keeps the original rather than returning nothing", () => {
    expect(sanitizeGeneratedText("}{[]")).toBe("}{[]");
  });

  it("passes null and undefined straight through", () => {
    expect(sanitizeGeneratedText(null)).toBeNull();
    expect(sanitizeGeneratedText(undefined)).toBeNull();
    expect(sanitizeGeneratedText("")).toBe("");
  });

  it("trims the whitespace models like to leave behind", () => {
    expect(sanitizeGeneratedText("  Confía en Jehová.  ")).toBe(
      "Confía en Jehová.",
    );
  });
});
