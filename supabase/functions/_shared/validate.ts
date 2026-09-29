/**
 * Un validador pequeño para lo que llega de fuera (cuerpos JSON).
 *
 * Sin dependencias: cada `parse*` recibe un `unknown` y devuelve un
 * `Check<T>` — o el valor ya limpio, o un motivo estable (`reason`) que la
 * función traduce a su 400. Los motivos son parte del contrato con el cliente:
 * no se renombran sin avisar.
 *
 * Criterio común: `undefined` y `null` son «ausente» (lo que ya pasaba con
 * `JSON.stringify` de campos opcionales), y todo lo demás tiene que ser
 * exactamente del tipo pedido. Nunca se coacciona (`"7"` no es 7) y nunca se
 * descarta en silencio un elemento malo de una lista: se rechaza la lista.
 */

export type Reason =
  | "not_object"
  | "not_string"
  | "not_array"
  | "not_uuid"
  | "not_allowed"
  | "too_many"
  | "too_long";

export type Check<T> = { ok: true; value: T } | { ok: false; reason: Reason };

export const ok = <T>(value: T): Check<T> => ({ ok: true, value });
export const fail = (reason: Reason): Check<never> => ({ ok: false, reason });

export const isAbsent = (value: unknown): value is null | undefined =>
  value === undefined || value === null;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Cualquier versión y variante de UUID, en minúscula o mayúscula; sin llaves. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

/** Un UUID, o ausente (`null`). */
export const parseOptionalUuid = (value: unknown): Check<string | null> => {
  if (isAbsent(value)) return ok(null);
  return isUuid(value) ? ok(value) : fail("not_uuid");
};

/**
 * Una lista de UUID: tope de elementos (sobre la lista TAL COMO LLEGA, antes de
 * quitar repetidos, para que una lista enorme se rechace sin recorrerla) y sin
 * repetidos en la salida, conservando el orden. Ausente es `[]`.
 */
export const parseUuidList = (
  value: unknown,
  opts: { max: number },
): Check<string[]> => {
  if (isAbsent(value)) return ok([]);
  if (!Array.isArray(value)) return fail("not_array");
  if (value.length > opts.max) return fail("too_many");

  const seen = new Set<string>();

  for (const item of value) {
    if (!isUuid(item)) return fail("not_uuid");
    seen.add(item.toLowerCase());
  }

  return ok([...seen]);
};

/**
 * Una lista de claves de una lista cerrada. Un elemento que no sea cadena, o
 * que no esté en `allowed`, rechaza la lista entera: aceptar «lo que se pueda»
 * escondería un cliente roto. Sin repetidos en la salida. Ausente es `[]`.
 */
export const parseAllowlist = (
  value: unknown,
  allowed: readonly string[],
  opts: { max: number },
): Check<string[]> => {
  if (isAbsent(value)) return ok([]);
  if (!Array.isArray(value)) return fail("not_array");
  if (value.length > opts.max) return fail("too_many");

  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") return fail("not_string");
    if (!allowed.includes(item)) return fail("not_allowed");
    seen.add(item);
  }

  return ok([...seen]);
};

/**
 * Lo que Postgres no acepta dentro de un texto o un jsonb, y que reventaría la
 * escritura con un 500 en vez de un rechazo: el NUL, y una mitad de par
 * sustituto suelta (que `JSON.stringify` serializa como un escape `\udXXX`
 * solitario y jsonb rechaza). Se limpian en vez de rechazar: nadie los escribe
 * a propósito. Se conservan el tabulador y los saltos de línea.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export const cleanText = (value: string): string =>
  value.replace(CONTROL_CHARS, "").replace(LONE_SURROGATE, "�");

/** Recorta a `max` caracteres SIN partir un par sustituto (un emoji). */
export const truncateChars = (value: string, max: number): string =>
  value.length <= max ? value : Array.from(value).slice(0, max).join("");

/**
 * Texto libre acotado. Dos topes con dos papeles distintos:
 *   - `hardMax` (caracteres, sobre lo que llega): pasarlo es un cliente roto o
 *     hostil, se rechaza.
 *   - `max` (tras `trim`): pasarlo es solo alguien que escribió de más, se
 *     recorta como ya hacía el servidor antes.
 * Ausente o vacío tras `trim` es `null`.
 */
export const parseBoundedText = (
  value: unknown,
  opts: { max: number; hardMax: number },
): Check<string | null> => {
  if (isAbsent(value)) return ok(null);
  if (typeof value !== "string") return fail("not_string");
  if (value.length > opts.hardMax) return fail("too_long");

  const trimmed = cleanText(value).trim();
  return ok(trimmed.length === 0 ? null : truncateChars(trimmed, opts.max));
};

/** Un valor de una lista cerrada, o ausente (`null`). */
export const parseOptionalEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): Check<T | null> => {
  if (isAbsent(value)) return ok(null);
  if (typeof value !== "string") return fail("not_string");
  return (allowed as readonly string[]).includes(value)
    ? ok(value as T)
    : fail("not_allowed");
};
