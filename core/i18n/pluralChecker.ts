import { Resource } from "i18next";

/**
 * i18next has two incompatible plural conventions, and picking the wrong suffix
 * fails silently: the plural key is simply never read, every count falls back to
 * the base key, and the UI renders "9 día de racha" instead of "9 días". Nothing
 * warns, because from i18next's side the key just does not exist.
 *
 *   compatibilityJSON: "v3"  →  key, key_plural
 *   (v4, the default)        →  key_one, key_other
 *
 * We run in v3, so an `_other` suffix in the resources is always a mistake.
 *
 * This reports rather than throws: i18n is initialised before React mounts, so
 * throwing here renders a blank screen with the reason swallowed — which is
 * harder to diagnose than the wrong grammar it was meant to catch.
 */
const WRONG_SUFFIXES = ["_other", "_one"];

const collectKeys = (value: unknown, prefix = ""): string[] => {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    collectKeys(child, prefix ? `${prefix}.${key}` : key),
  );
};

export const pluralChecker = (resources: Resource) => {
  const wrong = Object.entries(resources).flatMap(([language, bundle]) =>
    collectKeys(bundle)
      .filter((key) => WRONG_SUFFIXES.some((suffix) => key.endsWith(suffix)))
      .map((key) => `${language}:${key}`),
  );

  if (wrong.length > 0) {
    console.error(
      `[i18n] These keys use the i18next v4 plural suffixes, but this app runs ` +
        `in compatibilityJSON v3, where plurals are "key" and "key_plural". ` +
        `They will never be read, and every count will render the singular: ` +
        wrong.join(", "),
    );
  }

  return wrong;
};
