/**
 * Un identificador de request para la idempotencia de la generación.
 *
 * El servidor usa `request_id` como clave de idempotencia: reintentar el mismo
 * request no reserva cuota dos veces ni genera un tramo dos veces. La clave
 * tiene que ser única por acción lógica; no hace falta que sea criptográfica —
 * un UUID v4 bien formado basta, y un choque lo absorbe la restricción única.
 *
 * React Native/Hermes no garantiza `crypto.randomUUID`, así que se intenta por
 * orden y se cae a `Math.random` como último recurso.
 */

type CryptoCandidate = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
};

const HEX: string[] = [];

for (let i = 0; i < 256; i++) {
  HEX.push((i + 0x100).toString(16).slice(1));
}

export const formatUuid = (bytes: Uint8Array): string => {
  // versión 4 y variante RFC 4122, igual que haría crypto.randomUUID.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => HEX[b]).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const newRequestId = (): string => {
  const cryptoApi = (globalThis as { crypto?: CryptoCandidate }).crypto;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return formatUuid(bytes);
};

/**
 * La clave de idempotencia de UNA acción de alta, estable ante reintentos.
 *
 * `newRequestId()` da una clave nueva en cada llamada; el alta la necesitaba
 * DENTRO de `mutationFn`, así que un timeout y un reintento inmediato del mismo
 * formulario generaban una clave nueva y consumían otro slot de cuota (la
 * reserva no veía la primera petición como suya). Esta clase guarda la clave
 * de una acción lógica de alta:
 *
 *   - `acquire()` acuña una clave la primera vez y devuelve SIEMPRE la misma
 *     hasta que la acción se cierra: reintentar el alta reusa la clave, y
 *     `reserve_generation` responde idempotente en vez de reservar dos veces.
 *   - `clear()` se llama tras el éxito definitivo: la siguiente alta es una
 *     acción nueva y debe acuñar una clave nueva (nunca reutilizar una clave ya
 *     consumida, o la reserva idempotente devolvería el plan viejo).
 *   - `clearOnError(error)` se llama tras errores definitivos (400, 402, 403,
 *     409 request_id_conflict, 422): la clave nunca servirá y se descarta para
 *     que el próximo intento sea limpio. `generation_in_flight` (409) no es
 *     definitivo: otro worker tiene el lease, y reintentar debe reusar la clave.
 *     Errores ambiguos (timeout de red, 500, 503) también conservan la clave.
 *
 * El generador de claves es inyectable para que los tests puedan afirmar que se
 * reusa y se descarta sin depender de la aleatoriedad.
 */
export class CreateAttemptKey {
  private key: string | null = null;

  constructor(private readonly makeId: () => string = newRequestId) {}

  /** La clave a mandar en esta acción de alta, acuñándola si aún no existe. */
  acquire(): string {
    if (this.key === null) {
      this.key = this.makeId();
    }

    return this.key;
  }

  /** Cierra la acción tras el éxito definitivo: la clave no debe reutilizarse. */
  clear(): void {
    this.key = null;
  }

  /**
   * Cierra la acción tras un error definitivo — uno que nunca resolverá con
   * esta clave. Errores ambiguos (timeout de red, 500, 503) y un 409
   * `generation_in_flight` conservan la clave.
   */
  clearOnError(error: unknown): void {
    if (error == null || typeof error !== "object") {
      return;
    }

    const named = error as {
      name?: string;
      message?: string;
      context?: { status?: number };
    };

    // in_flight is transient: keep the key so a retry is the same request.
    if (
      named.name === "GenerationInFlight" ||
      named.message === "generation_in_flight"
    ) {
      return;
    }

    const status = named.context?.status;

    // Solo limpia en errores HTTP definitivos.
    if (
      status === 400 ||
      status === 402 ||
      status === 403 ||
      status === 409 ||
      status === 422
    ) {
      this.key = null;
    }
  }

  /** La clave acuñada, o `null` si la acción aún no ha empezado (o ya cerró). */
  get current(): string | null {
    return this.key;
  }
}

/** HTTP status on a Supabase Functions error, if the shape is there. */
export const functionErrorStatus = (error: unknown): number | undefined => {
  if (error == null || typeof error !== "object") {
    return undefined;
  }

  const status = (error as { context?: { status?: number } }).context?.status;

  return typeof status === "number" ? status : undefined;
};

/**
 * The `{ error: "…" }` code from a Functions HTTP body, when `context.json`
 * is still readable. A consumed or missing body is `undefined`, not a throw.
 */
export const readFunctionErrorCode = async (
  error: unknown,
): Promise<string | undefined> => {
  if (error == null || typeof error !== "object") {
    return undefined;
  }

  const context = (error as { context?: { json?: () => Promise<unknown> } })
    .context;

  if (!context || typeof context.json !== "function") {
    return undefined;
  }

  try {
    const body = await context.json();

    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
    ) {
      return (body as { error: string }).error;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export type ContinueRejectKind = "in_flight" | "request_id_conflict" | "other";

/** Maps a continue 409 to the honest client state. Unknown 409 stays `other`. */
export const classifyContinueReject = (
  status: number | undefined,
  code: string | undefined,
): ContinueRejectKind => {
  if (status === 409 && code === "generation_in_flight") {
    return "in_flight";
  }

  if (status === 409 && code === "request_id_conflict") {
    return "request_id_conflict";
  }

  return "other";
};
