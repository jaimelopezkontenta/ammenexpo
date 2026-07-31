import type { BibleBook } from "./navigation";

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
 * what `resolve_scripture` produced: `modern_name` followed by chapter:verse,
 * optionally a range. So matching against the book list we already have cached
 * is enough, and costs no round trip when someone taps the verse.
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
  // the reader in the wrong gospel.
  const candidates = [...books].sort(
    (a, b) => b.modern_name.length - a.modern_name.length,
  );

  for (const book of candidates) {
    if (!trimmed.startsWith(book.modern_name)) {
      continue;
    }

    const rest = trimmed.slice(book.modern_name.length);
    const match = /^\s+(\d+)\s*:\s*(\d+)/.exec(rest);

    if (!match) {
      return null;
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
