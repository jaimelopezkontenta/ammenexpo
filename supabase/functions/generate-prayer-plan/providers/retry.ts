/**
 * El presupuesto de reintentos del proveedor, y qué errores lo merecen.
 *
 * **Un solo presupuesto.** Antes se apilaban cuatro capas sin límite común:
 * cuatro intentos por modelo × dos modelos, encima del `maxRetries: 2` que trae
 * el SDK por defecto (que reintenta cada petición dos veces MÁS), encima de la
 * pasada de reparación de `index.ts`, y sin `timeout` (el del SDK son diez
 * minutos, más que el reloj de pared del edge). En el peor caso una sola
 * generación podía encadenar decenas de peticiones y agotar el lease.
 *
 * Ahora reintenta UN solo sitio (el bucle de `anthropic.ts`; el SDK va con
 * `maxRetries: 0`) y todo cuenta contra `totalMs`, que se fija UNA vez por
 * tramo en `index.ts` y se comparte con la pasada de reparación:
 *
 *   - `totalMs` (270 s) < `LEASE_SECONDS` (300 s): la generación termina, o se
 *     rinde, antes de que otro isolate pueda reclamar el lease — si no, el
 *     `complete_generation_chunk` de un isolate ya destronado se rechaza tras
 *     haber pagado al modelo. Quedan 30 s para escribir en la base.
 *   - `attemptTimeoutMs` (180 s) acota UN intento entero, de la petición al
 *     último token. Un tramo de siete días con razonamiento adaptativo son
 *     miles de tokens en streaming: menos que esto cortaría generaciones
 *     legítimas; más, dejaría un intento colgado comerse el presupuesto.
 *   - `minAttemptMs`: con menos margen que esto no se abre otro intento, que
 *     moriría por su timeout sin poder terminar.
 *   - `maxAttemptsPerModel` (2): un reintento por modelo. La sobrecarga es de
 *     capacidad POR MODELO, así que lo útil tras dos fallos es cambiar de
 *     modelo, no insistir.
 *
 * Los números están juntos, aquí, para que ajustarlos sea cambiar un objeto. Ojo:
 * en el plan gratuito de Supabase el reloj de pared del edge es menor que
 * `attemptTimeoutMs`; ahí manda el reloj de la plataforma, no este timeout.
 */
export type Budget = {
  attemptTimeoutMs: number;
  totalMs: number;
  minAttemptMs: number;
  maxAttemptsPerModel: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  /** Lo máximo que se obedece de un `retry-after` del servidor. */
  maxRetryAfterMs: number;
  /** Con menos margen que esto no se intenta la pasada de reparación. */
  repairMinRemainingMs: number;
};

export const DEFAULT_BUDGET: Budget = {
  attemptTimeoutMs: 180_000,
  totalMs: 270_000,
  minAttemptMs: 45_000,
  maxAttemptsPerModel: 2,
  baseBackoffMs: 1_000,
  maxBackoffMs: 8_000,
  maxRetryAfterMs: 20_000,
  repairMinRemainingMs: 60_000,
};

/** Un intento que no terminó en su tiempo. Se reintenta mientras quede presupuesto. */
export class AttemptTimeout extends Error {
  constructor(
    public model: string,
    public timeoutMs: number,
  ) {
    super(`Attempt on ${model} timed out after ${timeoutMs}ms`);
    this.name = "AttemptTimeout";
  }
}

/** No quedó presupuesto para otro intento y no hubo un error que devolver. */
export class BudgetExhausted extends Error {
  constructor() {
    super("The generation budget was exhausted");
    this.name = "BudgetExhausted";
  }
}

/** Milisegundos que quedan hasta `deadline` (nunca negativo). */
export const remainingMs = (deadline: number, now: number): number =>
  Math.max(0, deadline - now);

/** ¿Merece la pena abrir otro intento con este margen? */
export const canStartAttempt = (remaining: number, budget: Budget): boolean =>
  remaining >= budget.minAttemptMs;

/** El timeout de un intento: el suyo, o lo que quede si es menos. */
export const attemptTimeoutFor = (remaining: number, budget: Budget): number =>
  Math.min(budget.attemptTimeoutMs, remaining);

/**
 * Los estados HTTP que valen un reintento: los mismos que el SDK considera
 * transitorios — 408 (timeout), 409 (conflicto de bloqueo), 429 (límite de
 * tasa) y todo 5xx, incluido el 529 de Anthropic (`overloaded_error`).
 */
export const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 409 || status === 429 || status >= 500;

/**
 * Un error que llega DENTRO del stream (ya abierto, tras un 200) no trae status:
 * el SDK lo levanta como `APIError` sin status y con el payload en `.error`.
 * Estos son los tipos de Anthropic que significan «vuelve a intentarlo».
 */
const RETRYABLE_STREAM_ERROR_TYPES = new Set([
  "overloaded_error",
  "api_error",
  "rate_limit_error",
  "timeout_error",
]);

/** Las clases del SDK que hacen falta para clasificar, inyectadas. */
export type SdkErrorClasses = {
  /** Fallos de red al abrir la petición; incluye `APIConnectionTimeoutError`. */
  APIConnectionError: new (...args: never[]) => Error;
  /** La raíz de todos los errores del SDK. */
  AnthropicError: new (...args: never[]) => Error;
};

/**
 * `instanceof` que no revienta si el SDK no expone la clase (una versión que
 * la mueva de sitio no debe convertir la clasificación en un TypeError dentro
 * del `catch` que estaba decidiendo si reintentar).
 */
const isInstance = (error: unknown, ctor: unknown): boolean =>
  typeof ctor === "function" && error instanceof ctor;

/**
 * ¿Merece un reintento este error? Decide por el TIPO del error del SDK y por
 * su status, no por el texto de su mensaje (antes se intentaba `JSON.parse` del
 * `message` y se buscaba una cadena: cualquier cambio de redacción lo rompía).
 *
 * Sí: nuestro propio timeout de intento, un error de conexión, 408/409/429/5xx,
 * un error de servicio dentro del stream, y un corte de red a mitad del stream
 * (el SDK lo envuelve en un `AnthropicError` con el `TypeError` de `fetch` como
 * causa). No: 4xx que dependen de la petición (400/401/403/404/413/422),
 * abortos, y cualquier cosa que no reconozca — ante la duda no se gasta más.
 *
 * Una negativa del modelo (`ProviderRefusal`) NO se decide aquí: quien llama la
 * excluye antes, porque repetirla daría la misma respuesta con cualquier modelo.
 */
export const makeIsRetryable =
  (sdk: SdkErrorClasses) =>
  (error: unknown): boolean => {
    if (error instanceof AttemptTimeout) return true;
    if (isInstance(error, sdk.APIConnectionError)) return true;
    if (typeof error !== "object" || error === null) return false;

    const candidate = error as {
      status?: unknown;
      error?: { error?: { type?: unknown } };
    };

    if (typeof candidate.status === "number") {
      return isRetryableStatus(candidate.status);
    }

    const streamType = candidate.error?.error?.type;

    if (typeof streamType === "string") {
      return RETRYABLE_STREAM_ERROR_TYPES.has(streamType);
    }

    if (isInstance(error, sdk.AnthropicError)) {
      return (error as Error).cause instanceof TypeError;
    }

    return false;
  };

/**
 * La espera que pide el servidor (`retry-after-ms`, o `retry-after` en
 * segundos), o `null`. Acepta un `Headers` o un objeto plano.
 */
export const retryAfterMs = (headers: unknown): number | null => {
  const read = (name: string): string | null => {
    if (typeof headers !== "object" || headers === null) return null;

    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }

    const value = (headers as Record<string, unknown>)[name];
    return typeof value === "string" ? value : null;
  };

  const millis = Number(read("retry-after-ms"));
  if (Number.isFinite(millis) && millis > 0) return millis;

  const seconds = Number(read("retry-after"));
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;

  return null;
};

/**
 * Cuánto esperar antes del intento siguiente en el mismo modelo: lo que pida
 * el servidor (con tope), o un retroceso exponencial con algo de jitter. Nunca
 * más de lo que el presupuesto deje menos un intento mínimo.
 */
export const backoffFor = (input: {
  error: unknown;
  /** El intento que acaba de fallar, empezando en 1. */
  attempt: number;
  remaining: number;
  budget: Budget;
  random?: () => number;
}): number => {
  const { error, attempt, remaining, budget } = input;
  const random = input.random ?? Math.random;

  const requested = retryAfterMs((error as { headers?: unknown })?.headers);

  const wanted =
    requested !== null
      ? Math.min(requested, budget.maxRetryAfterMs)
      : Math.min(
          budget.baseBackoffMs * 2 ** (attempt - 1) * (1 + 0.25 * random()),
          budget.maxBackoffMs,
        );

  return Math.max(
    0,
    Math.min(Math.round(wanted), remaining - budget.minAttemptMs),
  );
};
