import { describe, expect, it } from "vitest";

import {
  chapterLabel,
  nextChapter,
  previousChapter,
  type BibleBook,
} from "./navigation";

// Enough of the real canon to exercise both testament and book boundaries.
const books: BibleBook[] = [
  { id: 1, modern_name: "Génesis", new_testament: false, chapter_count: 50 },
  { id: 2, modern_name: "Éxodo", new_testament: false, chapter_count: 40 },
  { id: 39, modern_name: "Malaquías", new_testament: false, chapter_count: 4 },
  { id: 40, modern_name: "Mateo", new_testament: true, chapter_count: 28 },
  {
    id: 66,
    modern_name: "Apocalipsis",
    new_testament: true,
    chapter_count: 22,
  },
];

describe("nextChapter", () => {
  it("moves within a book", () => {
    expect(nextChapter(books, { bookId: 1, chapter: 1 })).toEqual({
      bookId: 1,
      chapter: 2,
    });
  });

  it("rolls over into the next book", () => {
    expect(nextChapter(books, { bookId: 1, chapter: 50 })).toEqual({
      bookId: 2,
      chapter: 1,
    });
  });

  // Reading straight through must not stop at the testament boundary.
  it("crosses from the Old Testament into the New", () => {
    expect(nextChapter(books, { bookId: 39, chapter: 4 })).toEqual({
      bookId: 40,
      chapter: 1,
    });
  });

  it("stops at the end of Apocalipsis", () => {
    expect(nextChapter(books, { bookId: 66, chapter: 22 })).toBeNull();
  });

  it("returns null for a book it does not know", () => {
    expect(nextChapter(books, { bookId: 999, chapter: 1 })).toBeNull();
  });
});

describe("previousChapter", () => {
  it("moves within a book", () => {
    expect(previousChapter(books, { bookId: 2, chapter: 5 })).toEqual({
      bookId: 2,
      chapter: 4,
    });
  });

  // Landing on the last chapter of the previous book, not its first.
  it("rolls back into the end of the previous book", () => {
    expect(previousChapter(books, { bookId: 2, chapter: 1 })).toEqual({
      bookId: 1,
      chapter: 50,
    });
  });

  it("crosses back from the New Testament into the Old", () => {
    expect(previousChapter(books, { bookId: 40, chapter: 1 })).toEqual({
      bookId: 39,
      chapter: 4,
    });
  });

  it("stops at Génesis 1", () => {
    expect(previousChapter(books, { bookId: 1, chapter: 1 })).toBeNull();
  });
});

describe("chapterLabel", () => {
  it("reads the way a reference is written", () => {
    expect(chapterLabel(books, { bookId: 40, chapter: 5 })).toBe("Mateo 5");
  });

  it("is empty rather than wrong for an unknown book", () => {
    expect(chapterLabel(books, { bookId: 999, chapter: 5 })).toBe("");
  });
});
