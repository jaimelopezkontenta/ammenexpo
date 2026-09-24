import { describe, expect, it } from "vitest";

import type { Resource } from "i18next";

import { fallbackChecker } from "./fallbackChecker";

const resources = (languages: Record<string, Record<string, unknown>>) =>
  languages as Resource;

describe("fallbackChecker", () => {
  it("returns the fallbackLng when it exists in resources", () => {
    const r = resources({
      es: { greeting: "Hola" },
      en: { greeting: "Hello" },
    });

    expect(fallbackChecker(r, "es")).toBe("es");
    expect(fallbackChecker(r, "en")).toBe("en");
  });

  it("returns the fallbackLng when it is the only language", () => {
    const r = resources({
      es: { greeting: "Hola" },
    });

    expect(fallbackChecker(r, "es")).toBe("es");
  });

  it("throws when fallbackLng is not among the loaded resources", () => {
    const r = resources({
      es: { greeting: "Hola" },
      en: { greeting: "Hello" },
    });

    expect(() => fallbackChecker(r, "fr")).toThrow(
      'fallbackLng "fr" is not among the loaded resources. Available languages: es, en',
    );
  });

  it("lists available languages in the error message", () => {
    const r = resources({
      es: { greeting: "Hola" },
      en: { greeting: "Hello" },
      fr: { greeting: "Bonjour" },
      de: { greeting: "Hallo" },
    });

    expect(() => fallbackChecker(r, "pt")).toThrow(
      'fallbackLng "pt" is not among the loaded resources. Available languages: es, en, fr, de',
    );
  });
});
