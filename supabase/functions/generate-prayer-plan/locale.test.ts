import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BIBLE_VERSION_LANGUAGE,
  BIBLE_VERSIONS,
  bibleVersionForLanguage,
} from "../../../core/bible/versions";
import {
  BIBLE_VERSION_FOR_LOCALE,
  DEFAULT_PLAN_LOCALE,
  isPlanLocale,
  PLAN_LOCALES,
  planLocaleFrom,
} from "./locale.ts";

describe("planLocaleFrom: el idioma que manda es el del plan", () => {
  it("lee el guardado", () => {
    expect(planLocaleFrom({ answers: {}, locale: "en" })).toBe("en");
    expect(planLocaleFrom({ answers: {}, locale: "es" })).toBe("es");
  });

  it("un plan sin idioma es de antes de EN-3: español", () => {
    expect(planLocaleFrom({ answers: { topics: ["peace"] } })).toBe("es");
    expect(planLocaleFrom(null)).toBe("es");
    expect(planLocaleFrom(undefined)).toBe("es");
  });

  it("un jsonb con la forma equivocada no inventa un idioma", () => {
    for (const bad of [
      { locale: "fr" },
      { locale: "EN" },
      { locale: ["en"] },
      { locale: 1 },
      "en",
      ["en"],
    ]) {
      expect(planLocaleFrom(bad), JSON.stringify(bad)).toBe("es");
    }
  });

  it("el idioma por defecto es el español", () => {
    expect(DEFAULT_PLAN_LOCALE).toBe("es");
    expect(isPlanLocale("en")).toBe(true);
    expect(isPlanLocale("constructor")).toBe(false);
  });
});

/**
 * La tabla idioma → Biblia es copia de la del cliente (una función de Deno no
 * puede importar de `core/`). Si divergieran, el plan citaría una versión y el
 * lector abriría otra.
 */
describe("la Biblia de cada idioma es la del cliente", () => {
  it("la misma versión que abre el lector con esa interfaz", () => {
    for (const locale of PLAN_LOCALES) {
      expect(BIBLE_VERSION_FOR_LOCALE[locale], locale).toBe(
        bibleVersionForLanguage(locale),
      );
    }
  });

  it("y cada versión es del idioma del plan", () => {
    for (const locale of PLAN_LOCALES) {
      const version = BIBLE_VERSION_FOR_LOCALE[locale];

      expect(BIBLE_VERSIONS).toContain(version);
      expect(BIBLE_VERSION_LANGUAGE[version]).toBe(locale);
    }
  });

  it("cada idioma de plan tiene su traducción de la interfaz", () => {
    for (const locale of PLAN_LOCALES) {
      const file = fileURLToPath(
        new URL(`../../../translation/${locale}.json`, import.meta.url),
      );

      expect(existsSync(file), file).toBe(true);
    }
  });
});
