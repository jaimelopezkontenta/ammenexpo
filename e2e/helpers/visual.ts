import type {
  Page,
  PageAssertionsToHaveScreenshotOptions,
} from "@playwright/test";

import path from "node:path";

import { runSql } from "./sql";

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
 * ese punto oculto (visual.css), 30 píxeles de margen dejan pasar el
 * antialiasing y paran una palabra.
 */
export const snapshotOpts = (
  page: Page,
): PageAssertionsToHaveScreenshotOptions => ({
  maxDiffPixels: 30,
  fullPage: false,
  // Oculto con CSS y no con `mask`: ver visual.css.
  stylePath: path.join(__dirname, "visual.css"),
});

/**
 * La posición de lectura del usuario del seed, fija en Juan 3.
 *
 * La captura de `capitulo` abre Juan 3 y la app guarda esa posición; Biblia y
 * el índice del libro la enseñan («Continuar leyendo»). Con móvil y escritorio
 * corriendo en paralelo, lo que veía cada uno dependía de quién llegaba antes.
 * Fijarla antes de esas capturas deja el mismo estado pase lo que pase: la
 * única otra escritura posible es exactamente esta.
 */
export const pinReadingPosition = () =>
  runSql(`
    update public.profile_settings
       set last_read_book_id = 43,
           last_read_chapter = 3,
           last_read_verse = 1,
           last_read_at = '2026-01-01T10:00:00Z'
     where id = '5eed0000-0000-0000-0000-000000000001';
  `);

/**
 * La 404 en local se sirve con Metro, que a veces pinta abajo a la izquierda
 * su botón de desarrollo (⚡); no existe en producción ni en el export que usa
 * CI. En esa pantalla, que no tiene nada abajo, se captura sin la franja.
 */
export const notFoundOpts = (
  page: Page,
): PageAssertionsToHaveScreenshotOptions => {
  const size = page.viewportSize() ?? { width: 390, height: 844 };
  return {
    ...snapshotOpts(page),
    clip: { x: 0, y: 0, width: size.width, height: size.height - 90 },
  };
};
