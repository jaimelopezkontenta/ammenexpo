import type {
  Page,
  PageAssertionsToHaveScreenshotOptions,
} from "@playwright/test";

/**
 * Las opciones de captura de toda la red visual (claro, oscuro y onboarding).
 *
 * Hasta el 2026-09-29 cada spec llevaba su `maxDiffPixelRatio: 0.02`: un 2 %
 * de 390×844 son ~6.600 píxeles, y un cambio de texto entero cabía dentro. Las
 * baselines de Hoy y Orar decían «Buenas tardes» (con el reloj fijo a las
 * 10:00) y «Círculos» (la pestaña se llama «Juntos») y la suite pasaba.
 *
 * Medido ese día con tolerancia cero: el cambio «Círculos» → «Juntos» en la
 * barra son 132 píxeles, y el único ruido entre dos corridas (59–66 píxeles)
 * era el punto de avisos sin leer, que aparece cuando llega su consulta. Con
 * ese punto enmascarado, 30 píxeles de margen dejan pasar el antialiasing y
 * paran una palabra.
 */
export const snapshotOpts = (
  page: Page,
): PageAssertionsToHaveScreenshotOptions => ({
  maxDiffPixels: 30,
  fullPage: false,
  mask: [page.getByTestId("unread-dot")],
});
