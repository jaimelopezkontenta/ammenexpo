import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LEGACY_KEYS,
  STORAGE_KEYS,
  TODAY_DAY_PREFIX,
  isUserScopedKey,
  legacyKeysOf,
  todayDayKey,
  type StorageKeyName,
} from "./keys";

const ROOT = join(__dirname, "..", "..");

describe("STORAGE_KEYS", () => {
  const values = Object.values(STORAGE_KEYS);

  it("every key is namespaced and versioned", () => {
    for (const key of values) {
      expect(key).toMatch(/^ammen\.[A-Za-z]+\.v\d+$/u);
    }
  });

  it("no two settings share a key", () => {
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps the values already stored on devices that never had to move", () => {
    // Cambiar cualquiera de estas dos sin migración borraría en silencio el
    // tema o la Biblia elegidos de todo el mundo.
    expect(STORAGE_KEYS.theme).toBe("ammen.theme.v1");
    expect(STORAGE_KEYS.bibleVersion).toBe("ammen.bibleVersion.v1");
  });
});

describe("LEGACY_KEYS", () => {
  it("maps each renamed key to its previous names, and nothing else", () => {
    expect(legacyKeysOf(STORAGE_KEYS.language)).toEqual(["ammen.language"]);
    expect(legacyKeysOf(STORAGE_KEYS.readerFont)).toEqual([
      "ammen:reader-font",
    ]);
    expect(legacyKeysOf(STORAGE_KEYS.theme)).toEqual([]);
    expect(legacyKeysOf("ammen.unknown.v1")).toEqual([]);
  });

  it("an old name is never a current one", () => {
    const current = new Set<string>(Object.values(STORAGE_KEYS));
    for (const name of Object.keys(LEGACY_KEYS) as StorageKeyName[]) {
      for (const legacy of LEGACY_KEYS[name] ?? []) {
        expect(current.has(legacy)).toBe(false);
      }
    }
  });
});

describe("user-scoped keys", () => {
  it("the cached day of every plan belongs to a person", () => {
    expect(todayDayKey("plan-1")).toBe(`${TODAY_DAY_PREFIX}plan-1`);
    expect(isUserScopedKey(todayDayKey("plan-1"))).toBe(true);
  });

  it("no device preference or pre-sign-up key is user-scoped", () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(isUserScopedKey(key)).toBe(false);
    }
  });
});

describe("app/+html.tsx", () => {
  it("reads the theme under the same key before the JS arrives", () => {
    // El script de arranque va en una cadena literal (corre antes que el
    // bundle): si la clave cambiara aquí y no allí, la web pintaría el tema
    // equivocado en el primer byte.
    const html = readFileSync(join(ROOT, "app", "+html.tsx"), "utf8");

    expect(html).toContain(`localStorage.getItem("${STORAGE_KEYS.theme}")`);
  });
});

/**
 * El «un solo sitio», ejecutable: una clave `ammen.`/`ammen:` escrita entre
 * comillas fuera de keys.ts es una clave que se ha escapado del inventario.
 * Los tests y el script de `+html.tsx` (comprobado arriba) quedan fuera.
 */
describe("no key is written by hand elsewhere", () => {
  const SCAN_DIRS = ["app", "components", "core", "theme", "utils"];
  const ALLOWED = new Set(["core/storage/keys.ts", "app/+html.tsx"]);
  const KEY_LITERAL = /["'`]ammen[.:][A-Za-z]/u;

  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sources(full);
      return /\.tsx?$/u.test(entry.name) && !/\.test\.tsx?$/u.test(entry.name)
        ? [full]
        : [];
    });

  it("finds none", () => {
    const offenders = SCAN_DIRS.flatMap((dir) => sources(join(ROOT, dir)))
      .map((file) => relative(ROOT, file).replaceAll("\\", "/"))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) =>
        readFileSync(join(ROOT, file), "utf8")
          .split("\n")
          // Los comentarios pueden nombrar una clave (`ammen.theme.v1`).
          .filter((line) => !/^\s*(\/\/|\*|\/\*)/u.test(line))
          .some((line) => KEY_LITERAL.test(line)),
      );

    expect(
      offenders,
      "estas claves van en core/storage/keys.ts (STORAGE_KEYS)",
    ).toEqual([]);
  });
});
