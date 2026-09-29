import { STORAGE_KEYS } from "@/core/storage/keys";

export type ThemePref = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

/**
 * Misma clave en web (`localStorage`) y nativo (`AsyncStorage`). Vive con
 * las demás en core/storage/keys.ts; el script de `app/+html.tsx` la repite
 * literal (corre antes que el JS) y `keys.test.ts` vigila que coincidan.
 */
export const THEME_STORAGE_KEY = STORAGE_KEYS.theme;

export function parseThemePref(value: string | null | undefined): ThemePref {
  if (value === "dark" || value === "light" || value === "system") return value;
  return "system";
}

export function resolveTheme(
  pref: ThemePref,
  systemDark: boolean,
): ResolvedTheme {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}
