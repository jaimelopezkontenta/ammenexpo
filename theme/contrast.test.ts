import { describe, expect, it } from "vitest";

import { colors, colorsDark } from "./tokens";
import { withAlpha } from "./gradients";

/**
 * El contrato de contraste, ejecutable.
 *
 * `prototipo/TOKENS.md` congeló la paleta clara con una tabla medida a mano;
 * el anochecer (F7) nació ya medido. Este test es esa tabla convertida en
 * barrera: quien toque un token y rompa un par legible se entera aquí, no en
 * los ojos de una lectora de sesenta años.
 *
 * Los pares decorativos (ember.accent, mist.DEFAULT) NO aparecen: son
 * decoración a propósito y no tienen que llegar a AA.
 */

const luminance = (hex: string) => {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Una superficie translúcida, aplanada sobre su fondo. */
const blend = (fgRgba: string, bg: string) => {
  const m = fgRgba.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  if (!m) throw new Error(`rgba inesperado: ${fgRgba}`);
  const alpha = Number(m[4]);
  const mix = (fgC: number, i: number) =>
    Math.round(fgC * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha));
  const to2 = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to2(mix(+m[1], 1))}${to2(mix(+m[2], 3))}${to2(mix(+m[3], 5))}`;
};

const AA = 4.5;

describe("amanecer (paleta clara)", () => {
  const glass = blend(withAlpha(colors.glass, 0.58), colors.dawn.sky);

  it.each([
    ["plum sobre crema", colors.plum.DEFAULT, colors.dawn.cream, 10],
    ["plum sobre blanco", colors.plum.DEFAULT, colors.surface, 11],
    ["plum sobre vidrio legible", colors.plum.DEFAULT, glass, 7],
    ["mist.ink sobre blanco", colors.mist.ink, colors.surface, AA],
    ["mist.ink sobre crema", colors.mist.ink, colors.dawn.cream, AA],
    ["ember.ink sobre crema", colors.ember.ink, colors.dawn.cream, AA],
    ["danger sobre blanco", colors.danger, colors.surface, AA],
    ["blanco sobre plum.chip", "#FFFFFF", colors.plum.chip, AA],
    // El label del CTA sobre los dos extremos del degradado melocotón.
    ["cta-ink sobre ember", colors["cta-ink"], colors.ember.DEFAULT, AA],
    ["cta-ink sobre ember.pale", colors["cta-ink"], colors.ember.pale, AA],
  ])("%s ≥ %d:1", (_name, fg, bg, min) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

describe("anochecer (paleta oscura)", () => {
  const sky = colorsDark.dawn.sky;
  const glass = blend(withAlpha(colorsDark.glass, 0.6), sky);

  it.each([
    ["plum (tinta) sobre cielo", colorsDark.plum.DEFAULT, sky, 10],
    ["plum sobre vidrio", colorsDark.plum.DEFAULT, glass, 10],
    ["plum sobre surface", colorsDark.plum.DEFAULT, colorsDark.surface, 10],
    [
      "plum sobre cream-bg",
      colorsDark.plum.DEFAULT,
      colorsDark.dawn["cream-bg"],
      9,
    ],
    ["mist.ink sobre cielo", colorsDark.mist.ink, sky, AA],
    ["mist.ink sobre vidrio", colorsDark.mist.ink, glass, AA],
    ["ember.ink sobre cielo", colorsDark.ember.ink, sky, AA],
    ["ember.ink sobre vidrio", colorsDark.ember.ink, glass, AA],
    ["danger sobre cielo", colorsDark.danger, sky, AA],
    ["blanco sobre plum.chip", "#FFFFFF", colorsDark.plum.chip, AA],
    // El subrayado del versículo, con la tinta clara encima.
    [
      "plum sobre ember.pale (subrayado)",
      colorsDark.plum.DEFAULT,
      colorsDark.ember.pale,
      AA,
    ],
    // El CTA no cambia de tema: la misma pareja fija que en claro.
    [
      "cta-ink sobre ember",
      colorsDark["cta-ink"],
      colorsDark.ember.DEFAULT,
      AA,
    ],
  ])("%s ≥ %d:1", (_name, fg, bg, min) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
