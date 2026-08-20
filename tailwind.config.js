/** @type {import('tailwindcss').Config} */

/**
 * Ammen — el sistema visual "Amanecer".
 *
 * Los valores viven en `theme/tokens.js`, junto con la historia de cada
 * decisión (el despastelado, los pares decorativo/legible, el label plum del
 * CTA) y la referencia a `prototipo/TOKENS.md`. Aquí solo se montan: este
 * archivo es la vista Tailwind de esos tokens, y `theme/index.ts` es la vista
 * del JSX — la misma fuente para los dos mundos, que es lo que deja el modo
 * oscuro, si llega, como una capa y no una reescritura.
 */
const plugin = require("tailwindcss/plugin");

const tokens = require("./theme/tokens");

module.exports = {
  // `core/` entra en el escaneo: `core/auth/AuthGate.tsx` pinta pantalla
  // completa y se quedó con los estilos del scaffold justamente porque sus
  // clases nunca se generaban.
  content: [
    "./app/**/*.{js,ts,tsx}",
    "./components/**/*.{js,ts,tsx}",
    "./core/**/*.{js,ts,tsx}",
  ],

  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // No los hex: cada color es `rgb(var(--rgb-…) / <alpha-value>)`, y las
      // variables cambian con el esquema del sistema (plugin de abajo). Así
      // el modo oscuro es literalmente una tabla, no cincuenta pantallas.
      colors: tokens.tailwindColors,
      fontFamily: {
        // General Sans lleva toda la interfaz. Es la sustituta libre de Aeonik,
        // que es comercial.
        sans: ["GeneralSans-Regular"],
        "sans-medium": ["GeneralSans-Medium"],
        "sans-semibold": ["GeneralSans-Semibold"],
        "sans-bold": ["GeneralSans-Bold"],
        // Cormorant itálica es para lo editorial y nada más: el wordmark, los
        // labels ("Versículo del día") y las referencias. Nunca un párrafo.
        editorial: ["CormorantGaramond_400Regular_Italic"],
        // **Lora se queda.** Es la serif de lo que se lee despacio —el
        // versículo, la oración, el testimonio, el capítulo entero— y Cormorant
        // Light, que es preciosa en un label, es demasiado fina para eso.
        serif: ["Lora_400Regular"],
        "serif-bold": ["Lora_600SemiBold"],
      },
      boxShadow: tokens.boxShadow,
      // Los radios del sistema, para no repetir el número en cada pantalla.
      // En tokens son números (el JSX los usa tal cual); aquí ganan el `px`.
      borderRadius: Object.fromEntries(
        Object.entries(tokens.borderRadius).map(([k, v]) => [k, `${v}px`]),
      ),
      // `max-w-read` = ~672px, medida de lectura. `max-w-page` = cascarón
      // desktop. No reescribas 50 pantallas: esto existe para que una sola
      // línea por pantalla pueda anclar el ancho sin repetir el número.
      maxWidth: {
        read: "42rem",
        page: "72rem",
      },
      lineHeight: {
        // Medida generosa para las dos pantallas donde se lee de verdad: el día
        // y el lector de la Biblia.
        reading: "2rem",
      },
    },
  },
  plugins: [
    // La paleta como variables en `:root`. El anochecer está APAGADO a
    // propósito (decisión de producto: solo tema claro): para encenderlo,
    // añadir aquí `"@media (prefers-color-scheme: dark)": { ":root":
    // tokens.cssVars.dark }`, junto con los otros dos interruptores que
    // documenta app.config.js.
    plugin(({ addBase }) => {
      addBase({
        ":root": tokens.cssVars.light,
      });
    }),
  ],
};
