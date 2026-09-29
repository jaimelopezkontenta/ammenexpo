/**
 * Structured outputs guarantee the response *parses* as JSON matching the
 * schema. They do not guarantee that the model did not type JSON punctuation
 * *inside* a string value — and it does: a real generation ended an
 * interpretation with "...resolverlo todo hoy.},{", which would have been shown
 * to the user verbatim in the middle of their prayer.
 *
 * None of these sequences occur in Spanish prose, so cutting at them is safe.
 */
const GARBAGE_MARKERS = ["},{", '"},', '",{', '"}]', "}]", "},"];

// Quotes are included on both ends: losing one from a passage that genuinely
// opened with a quotation mark is a far smaller problem than showing `{"` to
// someone who came here to pray.
const TRAILING_STRUCTURE = /[\s{}[\]",]+$/;
const LEADING_STRUCTURE = /^[\s{}[\]",]+/;

// Un texto entra y un texto sale (nunca `null`): los tipos lo dicen para que
// `DayPayload.title` no tenga que fingir que puede faltar.
export function sanitizeGeneratedText(value: string): string;
export function sanitizeGeneratedText(
  value: string | null | undefined,
): string | null;
export function sanitizeGeneratedText(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return value ?? null;
  }

  let text = value;

  // Everything after a structural marker is leftover serialisation, not prose.
  for (const marker of GARBAGE_MARKERS) {
    const at = text.indexOf(marker);

    if (at !== -1) {
      text = text.slice(0, at);
    }
  }

  text = text.replace(LEADING_STRUCTURE, "").replace(TRAILING_STRUCTURE, "");

  // A closing quote or period is fine to lose; an empty field is not, so fall
  // back to the original rather than storing nothing.
  return text.trim().length > 0 ? text.trim() : value.trim();
}
