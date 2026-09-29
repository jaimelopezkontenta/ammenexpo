import { describe, expect, it } from "vitest";

import { compareTypes } from "./dbTypes.mjs";

describe("compareTypes", () => {
  it("treats CRLF and LF as the same file", () => {
    expect(compareTypes("a\nb\n", "a\r\nb\r\n")).toEqual({ ok: true });
  });

  it("points at the first differing line", () => {
    expect(compareTypes("a\nb\nc\n", "a\nX\nc\n")).toEqual({
      ok: false,
      line: 2,
      expected: "b",
      actual: "X",
    });
  });

  it("notices a file that is a prefix of the generated one", () => {
    expect(compareTypes("a\nb", "a")).toMatchObject({
      ok: false,
      line: 2,
      actual: "(fin del fichero)",
    });
  });
});
