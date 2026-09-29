/**
 * Registro estructurado de las edge functions: una línea de JSON por evento,
 * con un `request_id` que une todo lo que pasa en una petición.
 *
 * **Qué NO entra jamás.** Ni texto de oración, ni cuerpos de petición, ni
 * correos, ni tokens, ni el mensaje de un error: un `check` violado o un fallo
 * del modelo puede citar lo que la persona escribió, y eso es dato de creencias
 * (Art. 9 RGPD, ADR 0004). Solo ids opacos, contadores, estados y códigos.
 *
 * Tres defensas, de la más fuerte a la más tonta:
 *   1. El tipo: un campo es un primitivo, nunca un objeto (y menos un `Error`).
 *   2. `describeError()` extrae de un error solo clase, código y status.
 *   3. `redact()` tapa cualquier CADENA cuya clave suene a dato sensible o
 *      cuyo valor parezca un correo o una credencial, y recorta el resto.
 * Las dos últimas son red de seguridad, no permiso: quien llama sigue siendo
 * quien decide qué campos pasa.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Readonly<Record<string, LogValue>>;

export const REDACTED = "[redacted]";

/** Más largo que esto no es un código ni un id: es texto, y el texto no se loguea. */
const MAX_STRING = 120;

/** Claves reservadas: un campo de quien llama nunca las pisa. */
const RESERVED = new Set(["ts", "level", "event", "fn", "request_id"]);

/**
 * Claves cuyo VALOR, si es una cadena, no sale. Los números y booleanos con
 * estas claves sí pasan (`input_tokens`, `body_bytes`): no pueden llevar texto.
 */
const SENSITIVE_KEY =
  /(prompt|prayer|oracion|body|payload|content|message|text|email|mail|token|secret|password|passwd|authorization|apikey|api_key|display_name|custom_topic|^to$|^from$)/i;

/** Un correo, un JWT o una cabecera `Bearer` dentro de un valor cualquiera. */
const SENSITIVE_VALUE = /(@|\beyJ[\w-]{10,}|\bbearer\s)/i;

export const redact = (key: string, value: LogValue): LogValue => {
  if (value === undefined || value === null) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;

  if (typeof value !== "string") {
    // Un objeto colado por un `as any`: se registra que existió, no su contenido.
    return REDACTED;
  }

  if (SENSITIVE_KEY.test(key) || SENSITIVE_VALUE.test(value)) return REDACTED;

  return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
};

const write = (level: LogLevel, line: string) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

/** `fn` y `request_id` van en `fields` (los pone `createLogger`). */
export const log = (
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void => {
  const record: Record<string, LogValue> = {
    ts: new Date().toISOString(),
    level,
    event,
  };

  // `fn` y `request_id` primero, para que la línea se lea de izquierda a derecha.
  for (const key of ["fn", "request_id"]) {
    const value = fields[key];
    if (value !== undefined) record[key] = redact("id", value);
  }

  for (const [key, value] of Object.entries(fields)) {
    if (RESERVED.has(key) || value === undefined) continue;
    record[key] = redact(key, value);
  }

  write(level, JSON.stringify(record));
};

export type Logger = {
  readonly requestId: string;
  debug: (event: string, fields?: LogFields) => void;
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields) => void;
  error: (event: string, fields?: LogFields) => void;
};

/** Un logger atado a una función y a una petición: todo lo que emite lleva su `request_id`. */
export const createLogger = (
  fn: string,
  requestId: string,
  base: LogFields = {},
): Logger => {
  const emit =
    (level: LogLevel) =>
    (event: string, fields: LogFields = {}) =>
      log(level, event, { ...base, ...fields, fn, request_id: requestId });

  return {
    requestId,
    debug: emit("debug"),
    info: emit("info"),
    warn: emit("warn"),
    error: emit("error"),
  };
};

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * El id de correlación de una petición. Se acepta el `x-request-id` que traiga
 * (así una cadena de invocaciones —tramo tras tramo— comparte id) solo si es
 * un token corto y sin espacios; cualquier otra cosa se descarta y se acuña
 * uno, para que un cliente no pueda meter texto libre en nuestros logs.
 */
export const requestIdFrom = (headers: {
  get: (name: string) => string | null;
}): string => {
  const incoming = headers.get("x-request-id")?.trim() ?? "";
  return REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
};

const SAFE_IDENTIFIER = /^[A-Za-z0-9_.:-]{1,64}$/;

const safe = (value: unknown): string | undefined =>
  typeof value === "string" && SAFE_IDENTIFIER.test(value) ? value : undefined;

/**
 * De un error, lo que es seguro registrar: su clase, un código (`23514`,
 * `PGRST116`, `ECONNRESET`), su status HTTP y el tipo que devuelve Anthropic
 * (`overloaded_error`). NUNCA `message`, `details` ni `hint`: pueden citar
 * el valor que violó una restricción, y ese valor puede ser una oración.
 */
export const describeError = (error: unknown): LogFields => {
  if (error === null || typeof error !== "object") {
    return { error_class: typeof error };
  }

  const candidate = error as {
    code?: unknown;
    status?: unknown;
    error?: { type?: unknown; error?: { type?: unknown } };
  };

  const status =
    typeof candidate.status === "number" &&
    Number.isInteger(candidate.status) &&
    candidate.status >= 100 &&
    candidate.status <= 599
      ? candidate.status
      : undefined;

  return {
    error_class: safe(error.constructor?.name) ?? "Unknown",
    error_code: safe(candidate.code),
    error_status: status,
    error_type: safe(candidate.error?.error?.type ?? candidate.error?.type),
  };
};
