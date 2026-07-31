/**
 * Combining marks produced by NFD decomposition. Used instead of the
 * `\p{Diacritic}` property escape because that requires unicode property
 * support in the engine, and this range is exactly what Spanish accents
 * decompose to.
 */
const COMBINING_MARKS = /[̀-ͯ]/g;

type Folded = {
  /** Accent-free, lowercased. */
  value: string;
  /** For each character of `value`, the index it came from in the original. */
  origin: number[];
};

/**
 * Folds a string for comparison while remembering where every character came
 * from.
 *
 * The index map is the whole point. "corazón".normalize("NFD") is eight
 * characters, not seven, so any index computed against the folded string is
 * wrong by one for every accent that precedes it. Highlighting the match with
 * those raw indices would underline the wrong letters.
 */
const fold = (input: string): Folded => {
  let value = "";
  const origin: number[] = [];
  let at = 0;

  // Iterating the string yields code points; `char.length` is how many UTF-16
  // units it occupied, which is what slicing the original expects.
  for (const char of input) {
    const stripped = char
      .normalize("NFD")
      .replace(COMBINING_MARKS, "")
      .toLowerCase();

    for (const piece of stripped) {
      value += piece;
      origin.push(at);
    }

    at += char.length;
  }

  return { value, origin };
};

const unitsAt = (input: string, index: number) =>
  (input.codePointAt(index) ?? 0) > 0xffff ? 2 : 1;

/**
 * Where `needle` appears in `haystack`, ignoring accents and case, expressed as
 * ranges into the *original* string so the caller can slice it unchanged.
 *
 * Searching "corazon" finds "corazón" and reports the range covering the
 * accented word exactly.
 */
export const matchRanges = (
  haystack: string,
  needle: string,
): [number, number][] => {
  if (!haystack || !needle.trim()) {
    return [];
  }

  const hay = fold(haystack);
  const target = fold(needle).value;

  if (!target) {
    return [];
  }

  const ranges: [number, number][] = [];
  let from = 0;

  for (;;) {
    const found = hay.value.indexOf(target, from);

    if (found === -1) {
      break;
    }

    const start = hay.origin[found];
    const lastOrigin = hay.origin[found + target.length - 1];

    ranges.push([start, lastOrigin + unitsAt(haystack, lastOrigin)]);
    from = found + target.length;
  }

  return ranges;
};

export type HighlightPart = {
  text: string;
  match: boolean;
};

/** Splits a verse into alternating plain and matched runs, ready to render. */
export const splitHighlights = (
  text: string,
  query: string,
): HighlightPart[] => {
  const ranges = matchRanges(text, query);

  if (ranges.length === 0) {
    return [{ text, match: false }];
  }

  const parts: HighlightPart[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start), match: false });
    }

    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }

  return parts;
};
