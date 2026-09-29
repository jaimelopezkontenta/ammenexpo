import { bookName, type BibleBook } from "./navigation";
import type { BibleVersion } from "./versions";

export type VerseRef = {
  bookId: number;
  chapter: number;
  verse: number;
};

/**
 * Parses the reference stored on a plan day back into somewhere to navigate.
 *
 * This is not general-purpose reference parsing — the database already does
 * that, and does it better. `prayer_plan_days.scripture_ref` only ever holds
 * what `resolve_scripture` produced: the book's name followed by chapter:verse,
 * optionally a range. So matching against the book list we already have cached
 * is enough, and costs no round trip when someone taps the verse.
 *
 * El nombre puede estar en cualquiera de los dos idiomas: `resolve_scripture`
 * escribe «Juan 3:16» con la RVR y «John 3:16» con la WEB, y un plan guarda la
 * referencia de la versión con la que se escribió, que no tiene por qué ser la
 * que se lee ahora. Por eso se aceptan los dos nombres de cada libro sea cual
 * sea la versión activa.
 *
 * Returns null on anything unexpected. The caller must then leave the scripture
 * block inert rather than navigate somewhere wrong — guessing would drop
 * someone into a chapter that is not the one they tapped.
 */
export const parseCanonicalRef = (
  ref: string | null | undefined,
  books: BibleBook[],
): VerseRef | null => {
  if (!ref) {
    return null;
  }

  const trimmed = ref.trim();

  // Longest name first, or "1 Juan 1:9" would match the book "Juan" and land
  // the reader in the wrong gospel ("1 John" and "John", the same in English).
  const candidates = books
    .flatMap((book) =>
      [book.modern_name, book.name_en]
        .filter((name): name is string => Boolean(name))
        .map((name) => ({ book, name })),
    )
    .sort((a, b) => b.name.length - a.name.length);

  for (const { book, name } of candidates) {
    if (!trimmed.startsWith(name)) {
      continue;
    }

    const rest = trimmed.slice(name.length);
    const match = /^\s+(\d+)\s*:\s*(\d+)/.exec(rest);

    // Un nombre que solo es el comienzo de otro («Rut» y «Ruth») no es este
    // libro: se sigue buscando en vez de rendirse al primer parecido.
    if (!match) {
      continue;
    }

    const chapter = Number(match[1]);
    const verse = Number(match[2]);

    if (chapter < 1 || chapter > book.chapter_count || verse < 1) {
      return null;
    }

    return { bookId: book.id, chapter, verse };
  }

  return null;
};

/**
 * La referencia escrita en la versión que se lee: «Juan 3:16» con la RVR,
 * «John 3:16» con la WEB, y «Juan 3» sin versículo. Vacía si el libro no está
 * en la lista (todavía no ha llegado, o el id no existe): mejor nada que un
 * «3:16» sin libro.
 */
export const formatReference = (
  books: BibleBook[],
  ref: { bookId: number; chapter: number; verse?: number | null },
  version: BibleVersion,
) => {
  const name = bookName(books, ref.bookId, version);

  if (!name) {
    return "";
  }

  return ref.verse
    ? `${name} ${ref.chapter}:${ref.verse}`
    : `${name} ${ref.chapter}`;
};
