import { describe, expect, it } from "vitest";

import {
  bookLabel,
  bookName,
  chapterLabel,
  nextChapter,
  previousChapter,
  type BibleBook,
} from "./navigation";

// Enough of the real canon to exercise both testament and book boundaries.
const books: BibleBook[] = [
  {
    id: 1,
    modern_name: "Génesis",
    name_en: "Genesis",
    new_testament: false,
    chapter_count: 50,
  },
  {
    id: 2,
    modern_name: "Éxodo",
    name_en: "Exodus",
    new_testament: false,
    chapter_count: 40,
  },
  {
    id: 39,
    modern_name: "Malaquías",
    name_en: "Malachi",
    new_testament: false,
    chapter_count: 4,
  },
  {
    id: 40,
    modern_name: "Mateo",
    name_en: "Matthew",
    new_testament: true,
    chapter_count: 28,
  },
  {
    id: 66,
    modern_name: "Apocalipsis",
    name_en: "Revelation",
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

describe("bookLabel", () => {
  const matthew = { modern_name: "Mateo", name_en: "Matthew" };

  it("names the book in the language of the version being read", () => {
    expect(bookLabel(matthew, "rvr1909")).toBe("Mateo");
    expect(bookLabel(matthew, "web")).toBe("Matthew");
  });

  // Los libros que se escriben igual en los dos idiomas no necesitan nada
  // especial, pero conviene que no se rompan.
  it("keeps names that are the same in both languages", () => {
    const job = { modern_name: "Job", name_en: "Job" };

    expect(bookLabel(job, "rvr1909")).toBe("Job");
    expect(bookLabel(job, "web")).toBe("Job");
  });

  it("falls back to the Spanish name rather than a blank", () => {
    expect(bookLabel({ modern_name: "Mateo", name_en: "" }, "web")).toBe(
      "Mateo",
    );
  });
});

describe("bookName", () => {
  it("finds the book and labels it for the version", () => {
    expect(bookName(books, 66, "rvr1909")).toBe("Apocalipsis");
    expect(bookName(books, 66, "web")).toBe("Revelation");
  });

  it("is empty for a book it does not know", () => {
    expect(bookName(books, 999, "web")).toBe("");
  });
});

describe("chapterLabel", () => {
  it("reads the way a reference is written", () => {
    expect(chapterLabel(books, { bookId: 40, chapter: 5 }, "rvr1909")).toBe(
      "Mateo 5",
    );
  });

  it("in English when reading the World English Bible", () => {
    expect(chapterLabel(books, { bookId: 40, chapter: 5 }, "web")).toBe(
      "Matthew 5",
    );
  });

  it("is empty rather than wrong for an unknown book", () => {
    expect(chapterLabel(books, { bookId: 999, chapter: 5 }, "web")).toBe("");
  });
});
