import { describe, expect, it } from "vitest";

import en from "./en.json";
import es from "./es.json";

/** Flatten a nested object into a map of dot-path → leaf value. */
function flatten(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result[path] = value;
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      Object.assign(result, flatten(value as Record<string, unknown>, path));
    }
  }
  return result;
}

const esFlat = flatten(es as Record<string, unknown>);
const enFlat = flatten(en as Record<string, unknown>);

const esKeys = new Set(Object.keys(esFlat));
const enKeys = new Set(Object.keys(enFlat));

describe("translation parity", () => {
  it("en.json has every key that es.json has", () => {
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
    expect(missingInEn).toEqual([]);
  });

  it("es.json has every key that en.json has", () => {
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
    expect(missingInEs).toEqual([]);
  });

  it("no leaf value is empty or whitespace-only in es.json", () => {
    const emptyInEs = Object.entries(esFlat)
      .filter(([, v]) => v.trim() === "")
      .map(([key]) => key);
    expect(emptyInEs).toEqual([]);
  });

  it("no leaf value is empty or whitespace-only in en.json", () => {
    const emptyInEn = Object.entries(enFlat)
      .filter(([, v]) => v.trim() === "")
      .map(([key]) => key);
    expect(emptyInEn).toEqual([]);
  });

  it("interpolation placeholders match between es.json and en.json", () => {
    const extractPlaceholders = (text: string): string[] =>
      [...text.matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]).sort();

    const mismatches: string[] = [];
    for (const [key, esVal] of Object.entries(esFlat)) {
      const enVal = enFlat[key];
      if (enVal === undefined) continue; // already reported above
      const esPh = extractPlaceholders(esVal);
      const enPh = extractPlaceholders(enVal);
      if (JSON.stringify(esPh) !== JSON.stringify(enPh)) {
        mismatches.push(
          `${key}: es=${JSON.stringify(esPh)} en=${JSON.stringify(enPh)}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});
