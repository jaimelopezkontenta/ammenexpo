import { describe, expect, it } from "vitest";

import { FONT_CLASSES, FONT_STEPS } from "./readerPrefs";

/**
 * A−/A+ no hacían nada en el paso pequeño: entre dos clases de la misma familia
 * gana la que va después en la hoja de Tailwind (`text-base` < `text-lg` <
 * `text-xl`, `leading-6` < `leading-7` < `leading-9` < `leading-reading`), no la
 * del `className`. El versículo parte de `bodySerif` (`text-base leading-6`), así
 * que cada paso solo puede SUPERAR a la base, nunca ser menor que ella.
 */
const SIZE_ORDER = ["text-base", "text-lg", "text-xl"];

describe("FONT_CLASSES", () => {
  it("has a class set for every step", () => {
    for (const step of FONT_STEPS) expect(FONT_CLASSES[step]).toBeTruthy();
  });

  it("never asks for a size smaller than the base variant's text-base", () => {
    for (const step of FONT_STEPS) {
      const sizes = FONT_CLASSES[step]
        .split(/\s+/)
        .filter((c) => c.startsWith("text-"));
      for (const size of sizes) {
        expect(SIZE_ORDER.indexOf(size)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("the default step is the size the reader always had", () => {
    expect(FONT_CLASSES.md).toBe("text-lg leading-reading");
  });

  it("the large step raises both size and line height", () => {
    expect(FONT_CLASSES.lg).toContain("text-xl");
    expect(FONT_CLASSES.lg).toContain("leading-9");
  });
});
