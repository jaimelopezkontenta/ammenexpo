import { describe, expect, it } from "vitest";

import type { BibleBook } from "./navigation";
import { formatReference, parseCanonicalRef } from "./reference";

const books: BibleBook[] = [
  {
    id: 8,
    modern_name: "Rut",
    name_en: "Ruth",
    new_testament: false,
    chapter_count: 4,
  },
  {
    id: 18,
    modern_name: "Job",
    name_en: "Job",
    new_testament: false,
    chapter_count: 42,
  },
  {
    id: 19,
    modern_name: "Salmos",
    name_en: "Psalms",
    new_testament: false,
    chapter_count: 150,
  },
  {
    id: 22,
    modern_name: "Cantares",
    name_en: "Song of Solomon",
    new_testament: false,
    chapter_count: 8,
  },
  {
    id: 40,
    modern_name: "Mateo",
    name_en: "Matthew",
    new_testament: true,
    chapter_count: 28,
  },
  {
    id: 43,
    modern_name: "Juan",
    name_en: "John",
    new_testament: true,
    chapter_count: 21,
  },
  {
    id: 46,
    modern_name: "1 Corintios",
    name_en: "1 Corinthians",
    new_testament: true,
    chapter_count: 16,
  },
  {
    id: 62,
    modern_name: "1 Juan",
    name_en: "1 John",
    new_testament: true,
    chapter_count: 5,
  },
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

// Lo que escribe `resolve_scripture` cuando se le pide la World English Bible.
describe("parseCanonicalRef in English", () => {
  it("parses an English reference", () => {
    expect(parseCanonicalRef("Psalms 23:1", books)).toEqual({
      bookId: 19,
      chapter: 23,
      verse: 1,
    });
  });

  it("takes the first verse of an English range", () => {
    expect(parseCanonicalRef("John 3:16-17", books)).toEqual({
      bookId: 43,
      chapter: 3,
      verse: 16,
    });
    expect(parseCanonicalRef("1 Corinthians 13:4-7", books)).toEqual({
      bookId: 46,
      chapter: 13,
      verse: 4,
    });
  });

  it("does not mistake 1 John for John", () => {
    expect(parseCanonicalRef("1 John 1:9", books)).toEqual({
      bookId: 62,
      chapter: 1,
      verse: 9,
    });
  });

  it("handles a name of several words", () => {
    expect(parseCanonicalRef("Song of Solomon 2:4", books)).toEqual({
      bookId: 22,
      chapter: 2,
      verse: 4,
    });
  });

  it("handles a name spelled the same in both languages", () => {
    expect(parseCanonicalRef("Job 19:25", books)).toEqual({
      bookId: 18,
      chapter: 19,
      verse: 25,
    });
  });

  // «Rut» es el comienzo de «Ruth»: si el más corto se probara primero, o si
  // un parecido que no encaja cortara la búsqueda, «Ruth 1:16» no abriría nada.
  it("does not stop at a Spanish name that begins the English one", () => {
    expect(parseCanonicalRef("Ruth 1:16", books)).toEqual({
      bookId: 8,
      chapter: 1,
      verse: 16,
    });
    expect(parseCanonicalRef("Rut 1:16", books)).toEqual({
      bookId: 8,
      chapter: 1,
      verse: 16,
    });
  });

  // Igual que en español: sin versículo no es algo que `resolve_scripture`
  // escriba, y adivinar el versículo 1 sería inventar.
  it("refuses a chapter with no verse, as in Spanish", () => {
    expect(parseCanonicalRef("1 Corinthians 13", books)).toBeNull();
  });

  it("refuses an English chapter beyond the end of the book", () => {
    expect(parseCanonicalRef("John 22:1", books)).toBeNull();
  });
});

describe("formatReference", () => {
  it("labels the reference in the language of the version", () => {
    const ref = { bookId: 43, chapter: 3, verse: 16 };

    expect(formatReference(books, ref, "rvr1909")).toBe("Juan 3:16");
    expect(formatReference(books, ref, "web")).toBe("John 3:16");
  });

  it("without a verse, is the chapter", () => {
    expect(formatReference(books, { bookId: 46, chapter: 13 }, "web")).toBe(
      "1 Corinthians 13",
    );
    expect(
      formatReference(
        books,
        { bookId: 46, chapter: 13, verse: null },
        "rvr1909",
      ),
    ).toBe("1 Corintios 13");
  });

  it("is empty for a book it does not know, not a bare number", () => {
    expect(
      formatReference(books, { bookId: 999, chapter: 3, verse: 16 }, "web"),
    ).toBe("");
  });

  it("reads back to the same place in both versions", () => {
    const ref = { bookId: 62, chapter: 1, verse: 9 };

    for (const version of ["rvr1909", "web"] as const) {
      expect(
        parseCanonicalRef(formatReference(books, ref, version), books),
      ).toEqual(ref);
    }
  });
});
