import { describe, expect, it } from "vitest";

import en from "@/translation/en.json";
import es from "@/translation/es.json";

import {
  CRISIS_LINES,
  emergencyNumberFor,
  FIND_A_HELPLINE_URL,
  selectCrisisLines,
  telUrl,
} from "./resources";

const regions = (lines: { region: string }[]) => lines.map((l) => l.region);

describe("selectCrisisLines", () => {
  it("puts the device's country first, then Spain when the app is in Spanish", () => {
    expect(
      regions(selectCrisisLines({ regionCode: "MX", language: "es" })),
    ).toEqual(["MX", "ES"]);
    expect(
      regions(selectCrisisLines({ regionCode: "US", language: "es" })),
    ).toEqual(["US", "ES"]);
  });

  it("never lists Spain twice", () => {
    expect(
      regions(selectCrisisLines({ regionCode: "ES", language: "es" })),
    ).toEqual(["ES"]);
  });

  it("shows the country alone when the app is in English", () => {
    expect(
      regions(selectCrisisLines({ regionCode: "GB", language: "en" })),
    ).toEqual(["GB"]);
    expect(
      regions(selectCrisisLines({ regionCode: "ES", language: "en" })),
    ).toEqual(["ES"]);
  });

  it("falls back to Spain, or to nothing, when the country is unknown or not in the table", () => {
    expect(
      regions(selectCrisisLines({ regionCode: null, language: "es" })),
    ).toEqual(["ES"]);
    expect(
      regions(selectCrisisLines({ regionCode: "DE", language: "es" })),
    ).toEqual(["ES"]);
    // Android da regiones numéricas (es-419, «Latinoamérica»): no son un país.
    expect(
      regions(selectCrisisLines({ regionCode: "419", language: "es" })),
    ).toEqual(["ES"]);
    expect(selectCrisisLines({ regionCode: "DE", language: "en" })).toEqual([]);
    expect(
      selectCrisisLines({ regionCode: undefined, language: undefined }),
    ).toEqual([]);
  });

  it("tolerates lower case and spaces in what the platform returns", () => {
    expect(
      regions(selectCrisisLines({ regionCode: " ar ", language: "en" })),
    ).toEqual(["AR"]);
    expect(
      regions(selectCrisisLines({ regionCode: null, language: "es-MX" })),
    ).toEqual(["ES"]);
  });
});

describe("emergencyNumberFor", () => {
  it("offers only the device country's own emergency number", () => {
    expect(emergencyNumberFor("ES")).toBe("112");
    expect(emergencyNumberFor("US")).toBe("911");
    expect(emergencyNumberFor("GB")).toBe("999");
    expect(emergencyNumberFor("AU")).toBe("000");
  });

  it("offers none when the country is unknown, missing from the table or uncertain", () => {
    expect(emergencyNumberFor(null)).toBeNull();
    expect(emergencyNumberFor("DE")).toBeNull();
    expect(emergencyNumberFor("AR")).toBeNull();
  });
});

describe("CRISIS_LINES", () => {
  it("has one entry per country", () => {
    const all = regions([...CRISIS_LINES]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("dials only digits, and the label shows the same digits", () => {
    for (const line of CRISIS_LINES) {
      expect(telUrl(line.phone)).toMatch(/^tel:\d{3,15}$/);
      expect(line.display.replace(/\D/g, "")).toBe(line.phone);
      if (line.emergency) {
        expect(telUrl(line.emergency)).toMatch(/^tel:\d{3}$/);
      }
    }
  });

  it("has its title and body in Spanish and English", () => {
    const esLines = (es as { crisis: { lines: Record<string, unknown> } })
      .crisis.lines;
    const enLines = (en as { crisis: { lines: Record<string, unknown> } })
      .crisis.lines;

    for (const { region } of CRISIS_LINES) {
      for (const lines of [esLines, enLines]) {
        expect(lines[region]).toEqual({
          title: expect.any(String),
          body: expect.any(String),
        });
      }
    }
    // Y ninguna traducción de un país que ya no está en la tabla.
    expect(Object.keys(esLines).sort()).toEqual(
      regions([...CRISIS_LINES]).sort(),
    );
  });

  it("sends the rest of the world to an https helpline finder", () => {
    expect(FIND_A_HELPLINE_URL).toMatch(/^https:\/\//);
  });
});
