/** @type {import('tailwindcss').Config} */

/**
 * Ammen — el sistema visual.
 *
 * `theme.extend` estuvo vacío hasta aquí, así que toda la app era el gris
 * pizarra por defecto de Tailwind sobre blanco puro, con la tipografía del
 * sistema. Para una app de oración eso no es sobrio: es clínico. Se lee como un
 * formulario.
 *
 * **Papel cálido, y una sola tinta.** El fondo no es blanco sino un blanco roto
 * templado; el texto no es negro sino una tinta cálida. La diferencia es
 * pequeña en el código y grande en pantalla: le quita el zumbido de pantalla
 * retroiluminada a una superficie donde la gente va a leer despacio.
 *
 * **Solo dos grises de texto, no tres.** El tercero que se suele añadir para
 * "menos importante" acaba siempre por debajo de 4.5:1 y se usa igual para
 * texto normal. Aquí la jerarquía la hacen el tamaño y el peso, y los dos
 * grises que hay están medidos: `ink-muted` da 6.21:1 sobre el papel y
 * `ink-soft` 5.02:1 — el segundo salió de subirlo hasta que pasara AA también
 * sobre el fondo hundido, que es el caso apretado: ahí da 4.60, y el candidato
 * anterior se quedaba en 4.47, que el navegador cazó por tres centésimas.
 *
 * `ink-soft` **no** vale sobre `clay-soft` (4.37): ese fondo es más claro que
 * los tres neutros. Sobre el acento va `ink-muted`, que da 5.41. Un cuarto gris
 * solo para ese caso sería justo el gris de más que este sistema evita.
 *
 * Los colores viven aquí y no en las pantallas para que el modo oscuro, si
 * llega, sea una capa y no una reescritura.
 */
module.exports = {
  content: ["./app/**/*.{js,ts,tsx}", "./components/**/*.{js,ts,tsx}"],

  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#FBF8F4",
          raised: "#FFFFFF",
          sunken: "#F3EEE7",
        },
        ink: {
          DEFAULT: "#1C1917",
          muted: "#635C55",
          soft: "#726A62",
          line: "#E6DFD5",
        },
        // Barro, no azul corporativo. Se reserva para lo que de verdad pide
        // atención —la acción del día, la racha— y no para cada botón: un
        // acento en todas partes deja de ser un acento.
        clay: {
          DEFAULT: "#8C5A3C",
          deep: "#7A4C31",
          soft: "#F3E7DC",
        },
      },
      fontFamily: {
        // Para el versículo, la oración y el testimonio: lo que se lee
        // despacio. La navegación y los botones se quedan con la tipografía del
        // sistema, que es la que mejor se comporta en cada plataforma y no
        // cuesta un solo byte.
        serif: ["Lora_400Regular"],
        "serif-bold": ["Lora_600SemiBold"],
      },
      lineHeight: {
        // Medida generosa para las dos pantallas donde se lee de verdad: el día
        // y el lector de la Biblia.
        reading: "2rem",
      },
    },
  },
  plugins: [],
};
