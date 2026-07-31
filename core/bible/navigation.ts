export type BibleBook = {
  id: number;
  modern_name: string;
  new_testament: boolean;
  chapter_count: number;
};

export type ChapterRef = {
  bookId: number;
  chapter: number;
};

/**
 * The next chapter, rolling over into the following book.
 *
 * Reading straight through is the whole point of a reader, so Génesis 50 has to
 * lead to Éxodo 1 rather than to a dead end. Returns null only at the very end
 * of Apocalipsis.
 */
export const nextChapter = (
  books: BibleBook[],
  current: ChapterRef,
): ChapterRef | null => {
  const book = books.find((entry) => entry.id === current.bookId);

  if (!book) {
    return null;
  }

  if (current.chapter < book.chapter_count) {
    return { bookId: book.id, chapter: current.chapter + 1 };
  }

  // Book ids are canonical order, so the next book is simply the next id
  // present in the list rather than id + 1.
  const following = books
    .filter((entry) => entry.id > book.id)
    .sort((a, b) => a.id - b.id)[0];

  return following ? { bookId: following.id, chapter: 1 } : null;
};

/** The mirror of nextChapter: Mateo 1 leads back to Malaquías 4. */
export const previousChapter = (
  books: BibleBook[],
  current: ChapterRef,
): ChapterRef | null => {
  const book = books.find((entry) => entry.id === current.bookId);

  if (!book) {
    return null;
  }

  if (current.chapter > 1) {
    return { bookId: book.id, chapter: current.chapter - 1 };
  }

  const preceding = books
    .filter((entry) => entry.id < book.id)
    .sort((a, b) => b.id - a.id)[0];

  return preceding
    ? { bookId: preceding.id, chapter: preceding.chapter_count }
    : null;
};

export const bookName = (books: BibleBook[], bookId: number) =>
  books.find((entry) => entry.id === bookId)?.modern_name ?? "";

/** "Juan 3" — how a chapter is labelled everywhere in the reader. */
export const chapterLabel = (books: BibleBook[], ref: ChapterRef) => {
  const name = bookName(books, ref.bookId);

  return name ? `${name} ${ref.chapter}` : "";
};
