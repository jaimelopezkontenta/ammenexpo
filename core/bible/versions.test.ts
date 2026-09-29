import { describe, expect, it } from "vitest";

import {
  BIBLE_VERSION_LANGUAGE,
  BIBLE_VERSIONS,
  bibleVersionForLanguage,
  DEFAULT_BIBLE_VERSION,
} from "./versions";

describe("bibleVersionForLanguage", () => {
  it("English interfaces read the World English Bible, everything else Spanish", () => {
    expect(bibleVersionForLanguage("en")).toBe("web");
    expect(bibleVersionForLanguage("en-GB")).toBe("web");
    expect(bibleVersionForLanguage("EN-us")).toBe("web");
    expect(bibleVersionForLanguage("es")).toBe("rvr1909");
    expect(bibleVersionForLanguage("es-MX")).toBe("rvr1909");
    expect(bibleVersionForLanguage("fr")).toBe("rvr1909");
    expect(bibleVersionForLanguage(undefined)).toBe("rvr1909");
  });

  it("the default is one of the known versions", () => {
    expect(BIBLE_VERSIONS).toContain(DEFAULT_BIBLE_VERSION);
  });
});

describe("BIBLE_VERSION_LANGUAGE", () => {
  it("every version has a language, and it agrees with the default per language", () => {
    for (const version of BIBLE_VERSIONS) {
      expect(bibleVersionForLanguage(BIBLE_VERSION_LANGUAGE[version])).toBe(
        version,
      );
    }
  });
});
