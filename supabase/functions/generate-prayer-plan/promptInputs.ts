/**
 * Lo que entra en el prompt del usuario, tratado como DATO.
 *
 * `buildUserPrompt` (prompt.ts) interpola el nombre, las respuestas del
 * onboarding y el tema libre en el texto que lee el modelo. Todo eso lo escribió
 * una persona —y lo del onboarding se guardó sin que nadie mirase su forma—, así
 * que se pasa por aquí antes: se reduce a lo que un nombre o un tema pueden ser,
 * y se le quitan los caracteres con los que un texto se hace pasar por
 * estructura del prompt (cierres de etiqueta, saltos de línea, llaves).
 *
 * No cambia el prompt del sistema ni la plantilla del usuario: solo los valores
 * que se le entregan. Lo que sigue sin poder hacerse desde aquí es impedir que
 * un nombre de cincuenta letras contenga una frase: el tope y el alfabeto la
 * acotan, no la borran.
 */

import { cleanText, truncateChars } from "../_shared/validate.ts";
import { GENDER_KEYS, LIMITS, SEASON_KEYS, TOPIC_KEYS } from "./input.ts";
import { DEFAULT_PLAN_LOCALE, type PlanLocale } from "./locale.ts";

/**
 * Cómo se nombra en el prompt a quien no tiene nombre, en el idioma del plan
 * (el prompt dice «para esta persona» / «for this person»). El español es el
 * mismo respaldo que ya usaba el servidor.
 */
export const FALLBACK_NAMES: Record<PlanLocale, string> = {
  es: "esta persona",
  en: "this person",
};

export const FALLBACK_NAME = FALLBACK_NAMES[DEFAULT_PLAN_LOCALE];

export const MAX_NAME_CHARS = 50;

/** Tope de «minutos al día»: un día tiene mil cuatrocientos cuarenta. */
export const MAX_MINUTES = 240;

/**
 * Letras (con sus marcas, para los acentos), números, espacio y la puntuación
 * de un nombre: apóstrofo, punto y guion. Fuera van comillas, ángulos, llaves,
 * corchetes, barras, emojis y cualquier símbolo.
 */
const NOT_NAME_CHARS = /[^\p{L}\p{M}\p{N} '’.-]/gu;

const collapse = (value: string): string => value.replace(/\s+/g, " ").trim();

/** El nombre con el que se le habla en el prompt. */
export const sanitizeDisplayName = (
  raw: unknown,
  locale: PlanLocale = DEFAULT_PLAN_LOCALE,
): string => {
  const fallback = FALLBACK_NAMES[locale];

  if (typeof raw !== "string") return fallback;

  const name = collapse(
    truncateChars(
      collapse(cleanText(raw.normalize("NFC")).replace(NOT_NAME_CHARS, " ")),
      MAX_NAME_CHARS,
    ),
  )
    // Un nombre no empieza ni acaba en puntuación suelta.
    .replace(/^[ '’.-]+|[ '’.-]+$/g, "");

  return name.length > 0 ? name : fallback;
};

/**
 * El tema libre, para el bloque cercado del prompt. Sin `<` ni `>` no puede
 * cerrar `</peticion_del_usuario>` ni abrir otra etiqueta; en una sola línea no
 * puede simular un encabezado nuevo. El texto guardado (el que la persona ve
 * de vuelta en el formulario) no se toca: esto es solo lo que lee el modelo.
 */
export const sanitizeCustomTopic = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;

  const text = collapse(cleanText(raw).replace(/[<>]/g, " "));

  return text.length > 0 ? truncateChars(text, LIMITS.customTopic) : null;
};

/** Minutos al día: un entero razonable, o `null` (el prompt usa su respaldo). */
export const sanitizeMinutes = (raw: unknown): number | null =>
  typeof raw === "number" &&
  Number.isInteger(raw) &&
  raw >= 1 &&
  raw <= MAX_MINUTES
    ? raw
    : null;

const keysIn = (raw: unknown, allowed: readonly string[]): string[] =>
  Array.isArray(raw)
    ? raw.filter(
        (item): item is string =>
          typeof item === "string" && allowed.includes(item),
      )
    : [];

export type PromptAnswers = {
  seasons: string[];
  topics: string[];
  gender: string | null;
  customTopic: string | null;
  minutes: number | null;
};

/**
 * Las respuestas guardadas en el plan (`source_prompt.answers`), reducidas a lo
 * que `buildUserPrompt` sabe usar. Es un jsonb: puede traer cualquier cosa
 * (una cadena donde va una lista, `"constructor"` donde va una clave), y antes
 * se indexaba directamente en tablas de etiquetas.
 */
export const promptAnswersFrom = (answers: unknown): PromptAnswers => {
  const source =
    typeof answers === "object" && answers !== null
      ? (answers as Record<string, unknown>)
      : {};

  // Los planes de antes del multi-select traen una sola `season`.
  const seasons = keysIn(
    source.seasons ?? (source.season ? [source.season] : []),
    SEASON_KEYS,
  );

  const gender =
    typeof source.gender === "string" &&
    (GENDER_KEYS as readonly string[]).includes(source.gender)
      ? source.gender
      : null;

  return {
    seasons,
    topics: keysIn(source.topics, TOPIC_KEYS),
    gender,
    customTopic: sanitizeCustomTopic(source.custom_topic),
    minutes: sanitizeMinutes(source.minutes),
  };
};
