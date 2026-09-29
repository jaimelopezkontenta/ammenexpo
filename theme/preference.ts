export type ThemePref = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

/** Misma clave en web (`localStorage`) y nativo (`AsyncStorage`). */
export const THEME_STORAGE_KEY = "ammen.theme.v1";

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
