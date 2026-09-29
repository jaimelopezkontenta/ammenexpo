/**
 * Cuánto crece la letra con la del sistema, y cómo la sigue la web.
 *
 * Nadie ponía tope: con el texto más grande de iOS (hasta ~3,1×) o de Android
 * (2×) una pill, un título o la barra se partían por la mitad. Esta app la lee
 * gente mayor, así que el tope no es para que la letra no crezca — crece hasta
 * la mitad más, que es donde los rótulos todavía caben — sino para que lo que
 * crece siga siendo una pantalla. Quien necesite más para un texto largo lo
 * pide en ese `Txt` con `maxFontSizeMultiplier` (0 lo quita).
 *
 * En web el multiplicador no existe: allí la letra sigue a la del navegador
 * porque NativeWind emite los tamaños en `rem`. Lo que va por `style` en
 * números (las opciones de react-navigation) sale en px y no crece; para eso
 * está `remFromPx`.
 */
export const MAX_FONT_SCALE = 1.5;

/** La raíz por defecto del navegador: con ella, `remFromPx(n)` mide n px. */
export const ROOT_FONT_PX = 16;

/**
 * Un tamaño en px pasado a `rem`, para lo que en web tiene que crecer con la
 * letra del navegador y no pasa por NativeWind. Con la raíz por defecto mide
 * exactamente lo mismo que el número de antes.
 */
export const remFromPx = (px: number) => `${px / ROOT_FONT_PX}rem`;
