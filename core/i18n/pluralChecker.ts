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

/**
 * A singular slot that is already written as a plural. `"{{count}} días"` with
 * no `_plural` sibling reads correctly only for as long as nobody passes 1 —
 * `newPlan.days` sat like that unnoticed because the durations on offer were
 * 7, 14, 21 and 30.
 */
const looksPlural = (value: unknown) =>
  typeof value === "string" && /\{\{count\}\}[^.!?]*s\b/u.test(value);

const valueAt = (bundle: unknown, path: string) =>
  path
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );

export const pluralChecker = (resources: Resource) => {
  const problems: string[] = [];

  for (const [language, bundle] of Object.entries(resources)) {
    const keys = collectKeys(bundle);
    const present = new Set(keys);

    for (const key of keys) {
      if (WRONG_SUFFIXES.some((suffix) => key.endsWith(suffix))) {
        problems.push(
          `${language}:${key} uses a v4 suffix; this app runs compatibilityJSON v3, ` +
            `where plurals are "key" and "key_plural". It will never be read, ` +
            `so every count renders the singular.`,
        );
        continue;
      }

      // The inverse mistake, which the suffix check alone cannot see: a lone
      // key whose text is already plural.
      if (
        !key.endsWith("_plural") &&
        !present.has(`${key}_plural`) &&
        looksPlural(valueAt(bundle, key))
      ) {
        problems.push(
          `${language}:${key} has no "_plural" sibling but its text already reads ` +
            `as a plural, so a count of 1 will render it verbatim.`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(`[i18n] ${problems.join("\n[i18n] ")}`);
  }

  return problems;
};
