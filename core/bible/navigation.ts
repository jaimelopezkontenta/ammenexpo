import { BIBLE_VERSION_LANGUAGE, type BibleVersion } from "./versions";

export type BibleBook = {
  id: number;
  /** El nombre en español, el de la RVR. */
  modern_name: string;
  /** El nombre en inglés, el de la propia WEB («Song of Solomon»). */
  name_en: string;
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

/**
 * El nombre de un libro en la versión que se lee: «Juan» con la RVR, «John»
 * con la WEB. Es el mismo reparto que `bible_book_label` en la base, para que
 * el título del capítulo y la referencia de un resultado de búsqueda no
 * discrepen. Sin nombre inglés (una lista cacheada de antes de que existiera)
 * vale más el español que un hueco.
 */
export const bookLabel = (
  book: Pick<BibleBook, "modern_name" | "name_en">,
  version: BibleVersion,
) =>
  BIBLE_VERSION_LANGUAGE[version] === "en" && book.name_en
    ? book.name_en
    : book.modern_name;

/**
 * Sin versión por defecto a propósito: con una, cada pantalla que se olvidara
 * de pasarla enseñaría los nombres en español a quien lee en inglés, y ningún
 * typecheck lo diría.
 */
export const bookName = (
  books: BibleBook[],
  bookId: number,
  version: BibleVersion,
) => {
  const book = books.find((entry) => entry.id === bookId);

  return book ? bookLabel(book, version) : "";
};

/** "Juan 3" — how a chapter is labelled everywhere in the reader. */
export const chapterLabel = (
  books: BibleBook[],
  ref: ChapterRef,
  version: BibleVersion,
) => {
  const name = bookName(books, ref.bookId, version);

  return name ? `${name} ${ref.chapter}` : "";
};
