import { describe, expect, it } from "vitest";

import { matchRanges, splitHighlights } from "./highlight";

const sliced = (text: string, query: string) =>
  matchRanges(text, query).map(([start, end]) => text.slice(start, end));

describe("matchRanges", () => {
  it("finds a plain match", () => {
    expect(sliced("Jehová es mi pastor", "pastor")).toEqual(["pastor"]);
  });

  // The reason this module exists. "corazón" decomposes to eight characters,
  // so indices taken from the folded string are off by one after the accent.
  it("finds an accented word when the query has no accents", () => {
    expect(sliced("Mi corazón está firme", "corazon")).toEqual(["corazón"]);
  });

  it("keeps the indices right when several accents precede the match", () => {
    expect(sliced("Él oró con ánimo y misericordia", "misericordia")).toEqual([
      "misericordia",
    ]);
  });

  it("works the other way round too", () => {
    expect(sliced("Mi corazon sin tilde", "corazón")).toEqual(["corazon"]);
  });

  it("ignores case", () => {
    expect(sliced("JEHOVÁ es mi pastor", "jehova")).toEqual(["JEHOVÁ"]);
  });

  it("finds every occurrence", () => {
    expect(sliced("amor, amor y más amor", "amor")).toEqual([
      "amor",
      "amor",
      "amor",
    ]);
  });

  it("finds a phrase across a space", () => {
    expect(sliced("En el día de la oración", "de la")).toEqual(["de la"]);
  });

  it("returns nothing when there is no match", () => {
    expect(matchRanges("Jehová es mi pastor", "elefante")).toEqual([]);
  });

  it("returns nothing for an empty or blank query", () => {
    expect(matchRanges("Jehová es mi pastor", "")).toEqual([]);
    expect(matchRanges("Jehová es mi pastor", "   ")).toEqual([]);
    expect(matchRanges("", "pastor")).toEqual([]);
  });
});

describe("splitHighlights", () => {
  it("returns the whole text as one unmatched run when nothing matches", () => {
    expect(splitHighlights("Jehová es mi pastor", "elefante")).toEqual([
      { text: "Jehová es mi pastor", match: false },
    ]);
  });

  it("splits around the match without losing or duplicating a character", () => {
    const text = "Mi corazón está firme";
    const parts = splitHighlights(text, "corazon");

    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(
      ["corazón"],
    );
  });

  it("handles a match at the very start and at the very end", () => {
    expect(splitHighlights("Amor y amor", "amor")).toEqual([
      { text: "Amor", match: true },
      { text: " y ", match: false },
      { text: "amor", match: true },
    ]);
  });
});
