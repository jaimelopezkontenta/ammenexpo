/**
 * Ammen — los tokens del sistema visual "Amanecer", en un solo sitio.
 *
 * Este módulo es CommonJS a propósito: `tailwind.config.js` lo evalúa con Node
 * (sin TypeScript) y el JSX lo importa vía Metro. Un `.ts` aquí rompería el
 * pipeline de NativeWind. Los tipos viven al lado, en `tokens.d.ts`.
 *
 * Sale del montaje de diseño en `diseno/MONTAJE FINAL/JPG/` y del prototipo
 * navegable de `prototipo/`, que es donde se aprobaron los valores.
 *
 * **El amanecer está despastelado ~40 %.** Los fondos del montaje eran naranjas
 * plenos y en pantalla, sostenidos durante una lectura larga, cansaban. El
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
 * y `mist.ink` (5,34:1 sobre blanco, 4,80:1 sobre crema). Esta app la lee gente
 * mayor y lo que hace es leer: un token bonito que no se ve sería una regresión
 * disfrazada de rediseño.
 *
 * Por el mismo motivo **el label del CTA es plum y no blanco**: sobre el
 * degradado melocotón el blanco daba 2,0:1 al principio y 1,3:1 al final. Plum
 * da 5,6:1 y 8,8:1, y de paso se lee más editorial.
 *
 * `plum` sobre crema da 10,1:1 y sobre blanco 11,2:1 — el texto principal va
 * sobrado en cualquier tamaño.
 *
 * Los colores viven aquí y no en las pantallas — y eso es exactamente lo que
 * dejó que el modo oscuro llegara (F7) como una capa, `colorsDark`, y no como
 * una reescritura. La referencia de la paleta clara, con la tabla de
 * contraste y las recetas de vidrio, está en `prototipo/TOKENS.md`
 * (CONGELADO 2026-08-03); las dos paletas quedan congeladas ejecutablemente
 * en `theme/contrast.test.ts`.
 */

const colors = {
  // El fondo es uno solo y vive dentro de `DawnBackground` (sus paradas están
  // en `theme/gradients.ts`). Lo que queda aquí son los tonos que sí se usan
  // sueltos: el crema de los editores de nota y de petición, y el durazno del
  // versículo subrayado y de la imagen que se comparte.
  dawn: {
    sky: "#C7D6F2",
    // La parada central del amanecer: el periwinkle que se abre por el centro.
    "sky-mid": "#D2DEF4",
    cream: "#FFF1DD",
    "cream-bg": "#FFF6EA",
    peach: "#F9DBBF",
    "peach-mid": "#FCEBD8",
  },
  // El material de vidrio, como base con alfa (`bg-glass/60`,
  // `border-glassedge/60`): en claro es blanco — exactamente lo que eran las
  // clases `white/60` que sustituye — y en oscuro deja de serlo, que es toda
  // la razón de que tenga nombre propio.
  glass: "#FFFFFF",
  glassedge: "#FFFFFF",
  // El label del CTA es el mismo en los dos temas: el degradado melocotón no
  // cambia con el modo, así que su tinta tampoco (5,6:1 y 8,8:1 medidos).
  "cta-ink": "#413653",
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
};

/**
 * La base del velo de hojas y menús: plum TINTA, y el MISMO en los dos temas
 * a propósito. En el anochecer `plum` invierte a casi blanco — derivar el
 * scrim de la paleta activa lo convertiría en un velo blanco que ilumina en
 * vez de atenuar. Por eso no vive dentro de `colors`/`colorsDark` ni pasa por
 * las variables CSS: es una constante de marca, como `cta-ink`.
 */
const scrimBase = "#413653";

/**
 * El anochecer: la misma estructura, remedida para fondos oscuros.
 *
 * Contrastes medidos (scripts en el historial de trabajo; el test que los
 * congela vive en `theme/contrast.test.ts`):
 *
 *   plum (tinta)   #ECE8F4 sobre cielo → 13,5:1 · sobre vidrio 60 % → 11,9:1
 *   mist.ink       #B6AEC6 sobre cielo →  7,7:1 · sobre vidrio 60 % →  6,8:1
 *   ember.ink      #F0A26B sobre cielo →  7,8:1
 *   danger         #E8887A sobre cielo →  6,4:1
 *   blanco sobre plum.chip #514463     →  8,9:1
 *   cta-ink sobre el degradado melocotón → 5,6:1 y 8,8:1 (igual que en claro)
 *
 * Los decorativos conservan su papel de solo-decoración: `mist` da 3,6:1 y el
 * acento 5,1:1 sobre el cielo oscuro. El CTA no cambia de tema: el melocotón
 * es la marca, y su tinta (`cta-ink`) es fija.
 */
const colorsDark = {
  dawn: {
    sky: "#211D33",
    "sky-mid": "#282243",
    // Los "cremas" nocturnos: superficies cálidas violeta, no beige oscurecido.
    cream: "#3A3050",
    "cream-bg": "#382E4B",
    peach: "#5C3F28",
    "peach-mid": "#453853",
  },
  glass: "#332C4A",
  // El canto del vidrio en oscuro es lavanda apagada: blanco al 60 % sería un
  // neón alrededor de cada tarjeta.
  glassedge: "#A79DBE",
  "cta-ink": "#413653",
  ember: {
    DEFAULT: "#F2A578",
    // La clase `bg-ember-pale` es el subrayado del versículo: ámbar profundo.
    // (El degradado del CTA no pasa por aquí: usa la paleta clara, fija.)
    pale: "#5C3F28",
    accent: "#E2703F",
    ink: "#F0A26B",
  },
  plum: {
    // "plum" es *la tinta*: en oscuro, la tinta es clara.
    DEFAULT: "#ECE8F4",
    chip: "#514463",
  },
  mist: {
    DEFAULT: "#7A7390",
    ink: "#B6AEC6",
  },
  surface: "#2E2842",
  danger: "#E8887A",
};

// Los radios del sistema, en números para que el JSX pueda usarlos tal cual;
// `tailwind.config.js` les añade el `px`.
const borderRadius = {
  card: 20,
  input: 16,
  cta: 15,
  chip: 9,
};

const boxShadow = {
  soft: "0 8px 24px rgba(65, 54, 83, 0.10)",
  card: "0 10px 30px rgba(65, 54, 83, 0.12)",
};

// La escala de iconos (Lucide no pasa por NativeWind, así que el tamaño y el
// trazo salen de aquí y no de números repetidos por las pantallas).
const icon = {
  sm: 20,
  md: 24,
  lg: 28,
  strokeWidth: 1.7,
};

/* --- Fontanería del modo oscuro -----------------------------------------
 *
 * Las clases de Tailwind no llevan el hex directamente: llevan
 * `rgb(var(--rgb-…) / <alpha-value>)`. Las variables se definen en `:root`
 * (claro), bajo `@media (prefers-color-scheme: dark)` (Sistema) y en
 * `html.dark` / `html.light` (el toggle de Perfil). Así `text-plum` o
 * `bg-glass/60` cambian de tema solos, sin tocar una sola pantalla.
 */

const hexToTriplet = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

const flatten = (tree, path = []) =>
  Object.entries(tree).flatMap(([key, value]) => {
    const next = key === "DEFAULT" ? path : [...path, key];
    return typeof value === "string"
      ? [[next.join("-"), value]]
      : flatten(value, next);
  });

/** `{ "--rgb-dawn-sky": "199 214 242", … }` para una paleta. */
const cssVarsFor = (palette) =>
  Object.fromEntries(
    flatten(palette).map(([name, hex]) => [`--rgb-${name}`, hexToTriplet(hex)]),
  );

/** El árbol de colores para Tailwind, apuntando a las variables. */
const toTailwind = (tree, path = []) =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => {
      const next = key === "DEFAULT" ? path : [...path, key];
      return typeof value === "string"
        ? [key, `rgb(var(--rgb-${next.join("-")}) / <alpha-value>)`]
        : [key, toTailwind(value, next)];
    }),
  );

const cssVars = {
  light: cssVarsFor(colors),
  dark: cssVarsFor(colorsDark),
};

const tailwindColors = toTailwind(colors);

module.exports = {
  colors,
  colorsDark,
  scrimBase,
  borderRadius,
  boxShadow,
  icon,
  cssVars,
  tailwindColors,
};
