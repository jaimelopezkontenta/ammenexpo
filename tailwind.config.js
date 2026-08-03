/** @type {import('tailwindcss').Config} */

/**
 * Ammen — el sistema visual "Amanecer".
 *
 * Sustituye al tema papel/tinta/arcilla, que era plano a propósito: un blanco
 * roto y una sola tinta cálida. Funcionaba, pero no se parecía a nada. Este
 * sale del montaje de diseño en `diseno/MONTAJE FINAL/JPG/` y del prototipo
 * navegable de `prototipo/`, que es donde se aprobaron los valores.
 *
 * **El amanecer está despastelado ~40 %.** Los fondos del montaje eran naranjas
 * plenos y en pantalla, sostenidos durante una lectura larga, cansaban. La
 * referencia de tono aprobada es la pantalla de Círculos (`dawn.comm`). El
 * naranja pleno queda reservado para lo que pide acción: el CTA, el acento, el
 * relleno del progreso y el indicador de la pestaña activa.
 *
 * **Dos tokens tienen pareja, y no es un descuido.** El acento y el gris de
 * niebla vienen del diseño y ninguno de los dos llega a AA:
 *
 *   ember.accent #E2703F sobre crema → 2,85:1 (ni el 3:1 de elemento no textual)
 *   mist         #8A8494 sobre blanco → 3,61:1
 *
 * Así que los dos son **solo decoración** —labels grandes, iconos, bordes,
 * indicadores— y el texto que hay que leer usa `ember.ink` (4,85:1 sobre crema)
 * y `mist.ink` (5,34:1 sobre blanco, 4,80:1 sobre crema). El tema anterior ya
 * tenía sus grises medidos a 5-6:1; esta app la lee gente mayor y lo que hace
 * es leer, así que heredar un token bonito que no se ve habría sido una
 * regresión disfrazada de rediseño.
 *
 * Por el mismo motivo **el label del CTA es plum y no blanco**: sobre el
 * degradado melocotón el blanco daba 2,0:1 al principio y 1,3:1 al final. Plum
 * da 5,6:1 y 8,8:1, y de paso se lee más editorial.
 *
 * `plum` sobre crema da 10,1:1 y sobre blanco 11,2:1 — el texto principal va
 * sobrado en cualquier tamaño.
 *
 * Los colores viven aquí y no en las pantallas para que el modo oscuro, si
 * llega, sea una capa y no una reescritura. La referencia completa, con la
 * tabla de contraste y las recetas de vidrio, está en `prototipo/TOKENS.md`.
 */
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
      colors: {
        // El fondo es uno solo y vive dentro de `DawnBackground`, que es quien
        // conoce sus paradas. Lo que queda aquí son los tonos que sí se usan
        // sueltos: el crema de los editores de nota y de petición, y el durazno
        // del versículo subrayado y de la imagen que se comparte.
        //
        // Hubo tres más —`sky-soft`, `comm` y los degradados por flujo que los
        // usaban—, y se fueron con ellos: un token de color sin un solo uso es
        // una invitación a volver a tener seis fondos.
        dawn: {
          sky: "#C7D6F2",
          cream: "#FFF1DD",
          "cream-bg": "#FFF6EA",
          peach: "#F9DBBF",
          "peach-mid": "#FCEBD8",
        },
        ember: {
          DEFAULT: "#F2A578",
          pale: "#FBDFC2",
          // Decoración. Nunca texto: 2,85:1 sobre crema.
          accent: "#E2703F",
          // El naranja que sí se lee: 4,85:1 sobre crema.
          ink: "#B24A22",
        },
        plum: {
          DEFAULT: "#413653",
          chip: "#4D405C",
        },
        mist: {
          // Decoración. Nunca texto: 3,61:1 sobre blanco.
          DEFAULT: "#8A8494",
          // Texto secundario y placeholders: 5,34:1 sobre blanco.
          ink: "#6F6879",
        },
        surface: "#FFFFFF",
        // Los errores estaban en `red-400`/`red-500` sueltos, que es como no
        // tenerlos. 5,44:1 sobre blanco y 4,89:1 sobre crema.
        danger: "#C0392B",
      },
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
      boxShadow: {
        soft: "0 8px 24px rgba(65, 54, 83, 0.10)",
        card: "0 10px 30px rgba(65, 54, 83, 0.12)",
      },
      borderRadius: {
        // Los radios del sistema, para no repetir el número en cada pantalla.
        card: "20px",
        input: "16px",
        cta: "15px",
        chip: "9px",
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
