/** Tipos de `tokens.js` — el módulo es CJS porque lo evalúa tailwind.config. */

export interface Palette {
  dawn: {
    sky: string;
    "sky-mid": string;
    cream: string;
    "cream-bg": string;
    peach: string;
    "peach-mid": string;
  };
  glass: string;
  glassedge: string;
  "cta-ink": string;
  "badge-ink": string;
  ember: { DEFAULT: string; pale: string; accent: string; ink: string };
  plum: { DEFAULT: string; chip: string };
  mist: { DEFAULT: string; ink: string };
  surface: string;
  danger: string;
}

export declare const colors: Palette;
export declare const colorsDark: Palette;

/**
 * La base del velo de hojas/menús: plum tinta, el MISMO en los dos temas —
 * en oscuro `plum` es casi blanco y un velo derivado de la paleta activa
 * iluminaría en vez de atenuar.
 */
export declare const scrimBase: string;

export declare const borderRadius: {
  card: number;
  input: number;
  cta: number;
  chip: number;
};

export declare const boxShadow: { soft: string; card: string };

export declare const icon: {
  sm: number;
  md: number;
  lg: number;
  strokeWidth: number;
};

/** Variables `--rgb-…` por paleta, para el plugin de tailwind.config. */
export declare const cssVars: {
  light: Record<string, string>;
  dark: Record<string, string>;
};

/** El árbol de colores para Tailwind, apuntando a las variables. */
export declare const tailwindColors: Record<string, unknown>;
