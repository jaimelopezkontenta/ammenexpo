import { describe, expect, it } from "vitest";

import type { BibleBook } from "./navigation";
import { parseCanonicalRef } from "./reference";

const books: BibleBook[] = [
  { id: 19, modern_name: "Salmos", new_testament: false, chapter_count: 150 },
  { id: 40, modern_name: "Mateo", new_testament: true, chapter_count: 28 },
  { id: 43, modern_name: "Juan", new_testament: true, chapter_count: 21 },
  {
    id: 46,
    modern_name: "1 Corintios",
    new_testament: true,
    chapter_count: 16,
  },
  { id: 62, modern_name: "1 Juan", new_testament: true, chapter_count: 5 },
];

describe("parseCanonicalRef", () => {
  it("parses what resolve_scripture writes", () => {
    expect(parseCanonicalRef("Juan 3:16", books)).toEqual({
      bookId: 43,
      chapter: 3,
      verse: 16,
    });
  });

  it("takes the first verse of a range", () => {
    expect(parseCanonicalRef("1 Corintios 13:4-7", books)).toEqual({
      bookId: 46,
      chapter: 13,
      verse: 4,
    });
  });

  // The bug this ordering exists to prevent: "1 Juan" starts with a digit but
  // ends with a book name, so a shortest-first match would send the reader to
  // the gospel instead of the epistle.
  it("does not mistake 1 Juan for Juan", () => {
    expect(parseCanonicalRef("1 Juan 1:9", books)).toEqual({
      bookId: 62,
      chapter: 1,
      verse: 9,
    });
  });

  it("handles a book with an accent", () => {
    expect(parseCanonicalRef("Salmos 23:1", books)).toEqual({
      bookId: 19,
      chapter: 23,
      verse: 1,
    });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseCanonicalRef("  Mateo 5:3  ", books)).toEqual({
      bookId: 40,
      chapter: 5,
      verse: 3,
    });
  });

  // Everything below must return null rather than a guess: the caller leaves
  // the verse inert instead of navigating somewhere wrong.
  it("refuses a book it does not know", () => {
    expect(parseCanonicalRef("Libro Inventado 1:1", books)).toBeNull();
  });

  it("refuses a reference with no verse", () => {
    expect(parseCanonicalRef("Juan 3", books)).toBeNull();
    expect(parseCanonicalRef("Juan", books)).toBeNull();
  });

  it("refuses a chapter beyond the end of the book", () => {
    expect(parseCanonicalRef("Juan 99:1", books)).toBeNull();
  });

  it("refuses empty and missing input", () => {
    expect(parseCanonicalRef("", books)).toBeNull();
    expect(parseCanonicalRef(null, books)).toBeNull();
    expect(parseCanonicalRef(undefined, books)).toBeNull();
  });

  it("refuses everything when the book list has not loaded yet", () => {
    expect(parseCanonicalRef("Juan 3:16", [])).toBeNull();
  });
});
