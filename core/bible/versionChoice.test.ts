import { describe, expect, it } from "vitest";

import {
  BIBLE_VERSION_STORAGE_KEY,
  parseBibleVersion,
  resolveBibleVersion,
} from "./versionChoice";
import { BIBLE_VERSIONS } from "./versions";

describe("parseBibleVersion", () => {
  it("accepts every version the app knows", () => {
    for (const version of BIBLE_VERSIONS) {
      expect(parseBibleVersion(version)).toBe(version);
    }
  });

  // Lo que puede haber en el almacén o en una URL escrita a mano: nada de eso
  // puede convertirse en una versión, o el lector pediría una que la base no
  // tiene y se quedaría vacío.
  it("refuses anything else", () => {
    expect(parseBibleVersion(null)).toBeNull();
    expect(parseBibleVersion(undefined)).toBeNull();
    expect(parseBibleVersion("")).toBeNull();
    expect(parseBibleVersion("kjv")).toBeNull();
    expect(parseBibleVersion("WEB")).toBeNull();
    expect(parseBibleVersion(" web ")).toBeNull();
    expect(parseBibleVersion('"web"')).toBeNull();
    expect(parseBibleVersion(["web"])).toBeNull();
    expect(parseBibleVersion(1909)).toBeNull();
  });

  it("the storage key is versioned", () => {
    expect(BIBLE_VERSION_STORAGE_KEY).toMatch(/\.v\d+$/u);
  });
});

describe("resolveBibleVersion", () => {
  it("without a choice, follows the interface language", () => {
    expect(resolveBibleVersion(null, "es")).toBe("rvr1909");
    expect(resolveBibleVersion(null, "en")).toBe("web");
    expect(resolveBibleVersion(null, "en-GB")).toBe("web");
    expect(resolveBibleVersion(null, undefined)).toBe("rvr1909");
  });

  it("a choice wins over the language, in both directions", () => {
    expect(resolveBibleVersion("web", "es")).toBe("web");
    expect(resolveBibleVersion("rvr1909", "en")).toBe("rvr1909");
  });

  it("changing the language without a choice changes the version", () => {
    const before = resolveBibleVersion(null, "es");
    const after = resolveBibleVersion(null, "en");

    expect(before).not.toBe(after);
  });
});
