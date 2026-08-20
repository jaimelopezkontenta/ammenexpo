import { colors, colorsDark } from "./tokens";

/**
 * Los degradados del sistema, derivados de los tokens.
 *
 * Antes el par del CTA vivía copiado en `Button` y `WizardHeader`, y la
 * tarjeta de acción del día llevaba sus rgba a mano. Si un degradado cambia,
 * cambia aquí y en ningún otro sitio.
 */

/** Convierte un hex de la paleta en rgba con la opacidad dada. */
export const withAlpha = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const gradients = {
  /** El melocotón del CTA y del progreso del wizard, de izquierda a derecha. */
  cta: [colors.ember.DEFAULT, colors.ember.pale] as const,

  /** El periwinkle del amanecer, que se abre un poco por el centro. */
  dawn: [colors.dawn.sky, colors.dawn["sky-mid"], colors.dawn.sky] as const,

  /**
   * La tarjeta de "acción" del día: crema → durazno medio en diagonal, con la
   * translucidez del material. (Los rgba originales usaban 233/216 donde la
   * paleta dice 234/216 — un desvío de un punto que no era intencional.)
   */
  dayAction: [
    withAlpha(colors.dawn["cream-bg"], 0.92),
    withAlpha(colors.dawn["peach-mid"], 0.92),
  ] as const,

  /** El durazno de la imagen 9:16 que se comparte (`VerseStory`). */
  story: [
    colors.dawn.cream,
    colors.dawn["peach-mid"],
    colors.dawn.peach,
  ] as const,

  /* — Los gemelos nocturnos. El CTA y la imagen que se comparte NO tienen
     gemelo a propósito: el melocotón es la marca, y una foto para WhatsApp
     no cambia con el modo del teléfono de quien la manda. — */

  /** El anochecer: violeta profundo que se abre apenas por el centro. */
  dawnDark: [
    colorsDark.dawn.sky,
    colorsDark.dawn["sky-mid"],
    colorsDark.dawn.sky,
  ] as const,

  /** La tarjeta de "acción" en oscuro: violeta cálido, misma diagonal. */
  dayActionDark: [
    withAlpha(colorsDark.dawn["cream-bg"], 0.92),
    withAlpha(colorsDark.dawn["peach-mid"], 0.92),
  ] as const,
};
