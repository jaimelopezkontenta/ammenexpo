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
  ember: { DEFAULT: string; pale: string; accent: string; ink: string };
  plum: { DEFAULT: string; chip: string };
  mist: { DEFAULT: string; ink: string };
  surface: string;
  danger: string;
}

export declare const colors: Palette;
export declare const colorsDark: Palette;

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
