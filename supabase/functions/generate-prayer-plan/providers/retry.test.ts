import { describe, expect, it } from "vitest";

import {
  AttemptTimeout,
  attemptTimeoutFor,
  backoffFor,
  BudgetExhausted,
  canStartAttempt,
  DEFAULT_BUDGET,
  isRetryableStatus,
  makeIsRetryable,
  remainingMs,
  retryAfterMs,
} from "./retry.ts";

// Las mismas relaciones de herencia que el SDK: todo cuelga de AnthropicError,
// y los errores de conexión son APIError sin status.
class AnthropicError extends Error {}

class APIError extends AnthropicError {
  constructor(
    public status: number | undefined,
    public error: unknown,
    message: string,
    public headers?: unknown,
  ) {
    super(message);
  }
}

class APIConnectionError extends APIError {
  constructor(message = "Connection error.") {
    super(undefined, undefined, message);
  }
}

class APIConnectionTimeoutError extends APIConnectionError {}
class APIUserAbortError extends APIError {
  constructor() {
    super(undefined, undefined, "Request was aborted.");
  }
}

const isRetryable = makeIsRetryable({ APIConnectionError, AnthropicError });

const streamError = (type: string) =>
  new APIError(
    undefined,
    { type: "error", error: { type, message: "..." } },
    JSON.stringify({ type: "error", error: { type } }),
  );

describe("isRetryableStatus", () => {
  it.each([408, 409, 429, 500, 502, 503, 504, 529, 599])("%i sí", (status) => {
    expect(isRetryableStatus(status)).toBe(true);
  });

  it.each([200, 400, 401, 402, 403, 404, 413, 422, 499])("%i no", (status) => {
    expect(isRetryableStatus(status)).toBe(false);
  });
});

describe("isRetryable: por el tipo del error del SDK, no por su texto", () => {
  it("un status transitorio se reintenta", () => {
    for (const status of [408, 409, 429, 500, 503, 529]) {
      expect(
        isRetryable(new APIError(status, { type: "error" }, "x")),
        String(status),
      ).toBe(true);
    }
  });

  it("un status que depende de la petición, no", () => {
    for (const status of [400, 401, 403, 404, 413, 422]) {
      expect(
        isRetryable(new APIError(status, { type: "error" }, "x")),
        String(status),
      ).toBe(false);
    }
  });

  it("un error de conexión se reintenta, y también su variante de timeout", () => {
    expect(isRetryable(new APIConnectionError())).toBe(true);
    expect(
      isRetryable(new APIConnectionTimeoutError("Request timed out.")),
    ).toBe(true);
  });

  it("nuestro propio timeout de intento se reintenta", () => {
    expect(isRetryable(new AttemptTimeout("claude-sonnet-5", 1000))).toBe(true);
  });

  it("un error de servicio a mitad del stream (sin status) se reintenta", () => {
    for (const type of [
      "overloaded_error",
      "api_error",
      "rate_limit_error",
      "timeout_error",
    ]) {
      expect(isRetryable(streamError(type)), type).toBe(true);
    }
  });

  it("un error de petición a mitad del stream no", () => {
    expect(isRetryable(streamError("invalid_request_error"))).toBe(false);
    expect(isRetryable(streamError("authentication_error"))).toBe(false);
  });

  it("un corte de red a mitad del stream (AnthropicError con TypeError de causa) se reintenta", () => {
    const wrapped = new AnthropicError("terminated");
    wrapped.cause = new TypeError("terminated");

    expect(isRetryable(wrapped)).toBe(true);
  });

  it("un AnthropicError sin esa causa no", () => {
    expect(isRetryable(new AnthropicError("Could not parse message"))).toBe(
      false,
    );

    const other = new AnthropicError("x");
    other.cause = new SyntaxError("Unexpected token");
    expect(isRetryable(other)).toBe(false);
  });

  it("un aborto del llamador no se reintenta", () => {
    expect(isRetryable(new APIUserAbortError())).toBe(false);
  });

  it("no se guía por el mensaje: la palabra «overloaded» en el texto no basta", () => {
    expect(isRetryable(new Error("overloaded_error"))).toBe(false);
    expect(
      isRetryable(new Error('{"error":{"type":"overloaded_error"}}')),
    ).toBe(false);
    expect(
      isRetryable(new APIError(400, undefined, "rate_limit_error overloaded")),
    ).toBe(false);
  });

  it("lo que no reconoce no se reintenta", () => {
    for (const weird of [null, undefined, "boom", 42, {}, new Error("x")]) {
      expect(isRetryable(weird)).toBe(false);
    }
  });

  it("un status manda sobre un payload de tipo reintentable", () => {
    expect(
      isRetryable(
        new APIError(
          400,
          { type: "error", error: { type: "overloaded_error" } },
          "x",
        ),
      ),
    ).toBe(false);
  });

  it("si el SDK no expone las clases, clasifica por status sin lanzar", () => {
    const blind = makeIsRetryable({
      APIConnectionError: undefined as never,
      AnthropicError: undefined as never,
    });

    expect(blind(new APIError(529, undefined, "x"))).toBe(true);
    expect(blind(new APIConnectionError())).toBe(false);
    expect(() => blind(new Error("x"))).not.toThrow();
  });
});

describe("retryAfterMs", () => {
  it("lee retry-after en segundos de un Headers", () => {
    expect(retryAfterMs(new Headers({ "retry-after": "7" }))).toBe(7000);
  });

  it("prefiere retry-after-ms", () => {
    expect(
      retryAfterMs(
        new Headers({ "retry-after-ms": "250", "retry-after": "9" }),
      ),
    ).toBe(250);
  });

  it("acepta un objeto plano", () => {
    expect(retryAfterMs({ "retry-after": "3" })).toBe(3000);
  });

  it("ignora lo que no es un número positivo", () => {
    for (const bad of [
      new Headers({ "retry-after": "mañana" }),
      new Headers({ "retry-after": "-4" }),
      new Headers({ "retry-after": "0" }),
      new Headers(),
      {},
      null,
      undefined,
      "x",
    ]) {
      expect(retryAfterMs(bad)).toBeNull();
    }
  });
});

describe("backoffFor", () => {
  const budget = DEFAULT_BUDGET;
  const plenty = 240_000;

  it("crece de forma exponencial desde la base", () => {
    const at = (attempt: number) =>
      backoffFor({
        error: new Error(),
        attempt,
        remaining: plenty,
        budget,
        random: () => 0,
      });

    expect(at(1)).toBe(1000);
    expect(at(2)).toBe(2000);
    expect(at(3)).toBe(4000);
  });

  it("no pasa del tope", () => {
    expect(
      backoffFor({
        error: new Error(),
        attempt: 10,
        remaining: plenty,
        budget,
        random: () => 1,
      }),
    ).toBe(budget.maxBackoffMs);
  });

  it("añade hasta un 25 % de jitter", () => {
    const low = backoffFor({
      error: new Error(),
      attempt: 1,
      remaining: plenty,
      budget,
      random: () => 0,
    });
    const high = backoffFor({
      error: new Error(),
      attempt: 1,
      remaining: plenty,
      budget,
      random: () => 1,
    });

    expect(low).toBe(1000);
    expect(high).toBe(1250);
  });

  it("obedece el retry-after del servidor, con tope", () => {
    const withHeader = (seconds: string) =>
      backoffFor({
        error: new APIError(429, undefined, "x", { "retry-after": seconds }),
        attempt: 1,
        remaining: plenty,
        budget,
      });

    expect(withHeader("5")).toBe(5000);
    expect(withHeader("600")).toBe(budget.maxRetryAfterMs);
  });

  it("nunca se come el margen mínimo para el siguiente intento", () => {
    expect(
      backoffFor({
        error: new Error(),
        attempt: 1,
        remaining: budget.minAttemptMs + 300,
        budget,
        random: () => 0,
      }),
    ).toBe(300);

    expect(
      backoffFor({
        error: new Error(),
        attempt: 1,
        remaining: budget.minAttemptMs - 1,
        budget,
        random: () => 0,
      }),
    ).toBe(0);
  });
});

describe("el presupuesto", () => {
  it("termina antes que el lease de 300 s, con margen para escribir", () => {
    expect(DEFAULT_BUDGET.totalMs).toBeLessThanOrEqual(270_000);
  });

  it("un intento cabe entero en el presupuesto, y no hay más de un reintento por modelo", () => {
    expect(DEFAULT_BUDGET.attemptTimeoutMs).toBeLessThan(
      DEFAULT_BUDGET.totalMs,
    );
    expect(DEFAULT_BUDGET.maxAttemptsPerModel).toBe(2);
  });

  it("remainingMs nunca es negativo", () => {
    expect(remainingMs(1000, 400)).toBe(600);
    expect(remainingMs(1000, 1000)).toBe(0);
    expect(remainingMs(1000, 5000)).toBe(0);
  });

  it("canStartAttempt exige el margen mínimo", () => {
    expect(canStartAttempt(DEFAULT_BUDGET.minAttemptMs, DEFAULT_BUDGET)).toBe(
      true,
    );
    expect(
      canStartAttempt(DEFAULT_BUDGET.minAttemptMs - 1, DEFAULT_BUDGET),
    ).toBe(false);
  });

  it("el timeout de un intento es el suyo, o lo que quede si es menos", () => {
    expect(attemptTimeoutFor(240_000, DEFAULT_BUDGET)).toBe(
      DEFAULT_BUDGET.attemptTimeoutMs,
    );
    expect(attemptTimeoutFor(50_000, DEFAULT_BUDGET)).toBe(50_000);
  });

  it("los errores propios llevan nombre y datos legibles", () => {
    expect(new AttemptTimeout("m", 5).name).toBe("AttemptTimeout");
    expect(new BudgetExhausted().name).toBe("BudgetExhausted");
  });
});
