import { describe, expect, it } from "vitest";

import { parseThemePref, resolveTheme } from "./preference";

describe("parseThemePref", () => {
  it("acepta system, dark y light", () => {
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
  });

  it("cae a system si falta o no vale", () => {
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref("nope")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("sigue al sistema solo cuando la preferencia es system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
