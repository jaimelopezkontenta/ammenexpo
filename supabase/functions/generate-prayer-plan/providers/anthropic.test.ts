import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../../_shared/log.ts";

/**
 * El especificador `npm:` solo lo resuelve Deno: aquí lo sustituye un doble del
 * SDK con la misma forma que usa el proveedor (clase por defecto con las clases
 * de error como estáticas y `messages.stream()`), y la misma herencia de
 * errores que el real.
 */
const sdk = vi.hoisted(() => {
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

  class APIUserAbortError extends APIError {
    constructor() {
      super(undefined, undefined, "Request was aborted.");
    }
  }

  const stream = vi.fn();
  const constructed: unknown[] = [];

  class Anthropic {
    static AnthropicError = AnthropicError;
    static APIError = APIError;
    static APIConnectionError = APIConnectionError;
    static APIUserAbortError = APIUserAbortError;

    messages = { stream };

    constructor(options: unknown) {
      constructed.push(options);
    }
  }

  return {
    Anthropic,
    AnthropicError,
    APIError,
    APIConnectionError,
    APIUserAbortError,
    stream,
    constructed,
  };
});

vi.mock("npm:@anthropic-ai/sdk@^0.70.0", () => ({ default: sdk.Anthropic }));

import { createAnthropicProvider } from "./anthropic.ts";
import { AttemptTimeout, BudgetExhausted, DEFAULT_BUDGET } from "./retry.ts";
import { ProviderRefusal } from "./types.ts";

const PLAN = '{"title":"t","theme":"th","days":[]}';

const message = (overrides: Record<string, unknown> = {}) => ({
  stop_reason: "end_turn",
  model: "claude-sonnet-5",
  content: [{ type: "text", text: PLAN }],
  usage: {
    input_tokens: 10,
    output_tokens: 20,
    cache_read_input_tokens: null,
    cache_creation_input_tokens: 5,
  },
  ...overrides,
});

/** Un stream cuyo `finalMessage()` hace lo que diga cada intento, en orden. */
const script = (...steps: (() => unknown)[]) => {
  let call = 0;

  sdk.stream.mockImplementation(() => {
    const step = steps[Math.min(call, steps.length - 1)];
    call += 1;

    return {
      finalMessage: async () => {
        const out = step();
        if (out instanceof Error) throw out;
        return out;
      },
    };
  });
};

const ok = () => message();
const overloaded = () => new sdk.APIError(529, undefined, "Overloaded");
const bad = () => new sdk.APIError(400, undefined, "bad request");

const args = {
  system: "SYSTEM",
  messages: [{ role: "user" as const, content: "hola" }],
  schema: { type: "object" },
};

const modelsCalled = () =>
  sdk.stream.mock.calls.map((call) => (call[0] as { model: string }).model);

/** Un reloj falso: el sueño y los intentos lo hacen avanzar. */
const fakeClock = () => {
  const clock = { t: 0 };
  return {
    clock,
    now: () => clock.t,
    sleep: vi.fn(async (ms: number) => {
      clock.t += ms;
    }),
  };
};

let lines: string[];

beforeEach(() => {
  sdk.stream.mockReset();
  sdk.constructed.length = 0;
  lines = [];

  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: string) => {
      lines.push(line);
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

const provider = (
  options: Parameters<typeof createAnthropicProvider>[1] = {},
) => {
  const time = fakeClock();

  return {
    time,
    provider: createAnthropicProvider("sk-test", {
      logger: createLogger("generate-prayer-plan", "req-12345678"),
      sleep: time.sleep,
      now: time.now,
      random: () => 0,
      ...options,
    }),
  };
};

describe("el cliente del SDK", () => {
  it("se crea sin reintentos propios y con un timeout explícito", () => {
    provider();

    expect(sdk.constructed).toEqual([
      {
        apiKey: "sk-test",
        maxRetries: 0,
        timeout: DEFAULT_BUDGET.attemptTimeoutMs,
      },
    ]);
  });

  it("cada petición lleva su señal, su timeout y maxRetries 0", async () => {
    script(ok);
    const { provider: p } = provider();

    await p.generate(args);

    const [, options] = sdk.stream.mock.calls[0] as [
      unknown,
      { signal: AbortSignal; timeout: number; maxRetries: number },
    ];

    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.maxRetries).toBe(0);
    expect(options.timeout).toBe(DEFAULT_BUDGET.attemptTimeoutMs);
  });
});

describe("si el SDK no expone sus clases de error", () => {
  it("se avisa en el registro y se sigue clasificando por status", async () => {
    const statics = sdk.Anthropic as unknown as Record<string, unknown>;
    const original = statics.APIConnectionError;
    statics.APIConnectionError = undefined;

    try {
      script(overloaded, ok);
      const { provider: p } = provider();

      expect(lines.map((line) => JSON.parse(line).event)).toContain(
        "provider.sdk_error_classes_missing",
      );

      // Un 529 se reintenta igual: no depende de las clases.
      await p.generate(args);
      expect(sdk.stream).toHaveBeenCalledTimes(2);
    } finally {
      statics.APIConnectionError = original;
    }
  });

  it("con las clases presentes no dice nada", () => {
    provider();

    expect(lines).toEqual([]);
  });
});

describe("la petición no cambia", () => {
  it("Sonnet primero, con su razonamiento y el prompt cacheable", async () => {
    script(ok);
    const { provider: p } = provider();

    await p.generate(args);

    expect(sdk.stream.mock.calls[0][0]).toEqual({
      model: "claude-sonnet-5",
      max_tokens: 64000,
      system: [
        {
          type: "text",
          text: "SYSTEM",
          cache_control: { type: "ephemeral" },
        },
      ],
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: { type: "object" } },
      },
      messages: args.messages,
    });
  });

  it("Haiku, sin razonamiento ni esfuerzo (los rechaza con un 400)", async () => {
    script(overloaded, overloaded, ok);
    const { provider: p } = provider();

    await p.generate(args);

    const haiku = sdk.stream.mock.calls[2][0] as Record<string, unknown>;

    expect(haiku.model).toBe("claude-haiku-4-5");
    expect(haiku).not.toHaveProperty("thinking");
    expect(haiku.output_config).toEqual({
      format: { type: "json_schema", schema: { type: "object" } },
    });
  });
});

describe("generate", () => {
  it("devuelve el JSON, el modelo y el uso", async () => {
    script(ok);
    const { provider: p } = provider();

    expect(await p.generate(args)).toEqual({
      json: PLAN,
      model: "claude-sonnet-5",
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 5,
      },
    });
    expect(sdk.stream).toHaveBeenCalledTimes(1);
  });

  it("una negativa del modelo no se reintenta ni cambia de modelo", async () => {
    script(() =>
      message({ stop_reason: "refusal", stop_details: { category: "x" } }),
    );
    const { provider: p, time } = provider();

    await expect(p.generate(args)).rejects.toBeInstanceOf(ProviderRefusal);
    expect(sdk.stream).toHaveBeenCalledTimes(1);
    expect(time.sleep).not.toHaveBeenCalled();
  });

  it("un 4xx de la petición se lanza al primer fallo", async () => {
    script(bad);
    const { provider: p, time } = provider();

    await expect(p.generate(args)).rejects.toMatchObject({ status: 400 });
    expect(sdk.stream).toHaveBeenCalledTimes(1);
    expect(time.sleep).not.toHaveBeenCalled();
  });

  it("una respuesta sin bloque de texto no se reintenta", async () => {
    script(() => message({ content: [{ type: "thinking", thinking: "..." }] }));
    const { provider: p } = provider();

    await expect(p.generate(args)).rejects.toThrow("no text block");
    expect(sdk.stream).toHaveBeenCalledTimes(1);
  });
});

describe("reintentos y respaldo", () => {
  it("un 529 se reintenta en el mismo modelo tras un retroceso", async () => {
    script(overloaded, ok);
    const { provider: p, time } = provider();

    await p.generate(args);

    expect(modelsCalled()).toEqual(["claude-sonnet-5", "claude-sonnet-5"]);
    expect(time.sleep).toHaveBeenCalledTimes(1);
    expect(time.sleep).toHaveBeenCalledWith(1000);
  });

  it("tras agotar los intentos de Sonnet cambia a Haiku, sin esperar para cambiar", async () => {
    script(overloaded, overloaded, ok);
    const { provider: p, time } = provider();

    const result = await p.generate(args);

    expect(result.json).toBe(PLAN);
    expect(modelsCalled()).toEqual([
      "claude-sonnet-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ]);
    // Solo se espera ENTRE los dos intentos de un mismo modelo.
    expect(time.sleep).toHaveBeenCalledTimes(1);
  });

  it("como mucho cuatro intentos en total: dos por modelo", async () => {
    script(overloaded);
    const { provider: p, time } = provider();

    await expect(p.generate(args)).rejects.toMatchObject({ status: 529 });

    expect(modelsCalled()).toEqual([
      "claude-sonnet-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
      "claude-haiku-4-5",
    ]);
    expect(time.sleep).toHaveBeenCalledTimes(2);
  });

  it("reintenta un 429 y obedece su retry-after", async () => {
    script(
      () =>
        new sdk.APIError(429, undefined, "slow down", { "retry-after": "4" }),
      ok,
    );
    const { provider: p, time } = provider();

    await p.generate(args);

    expect(time.sleep).toHaveBeenCalledWith(4000);
  });

  it("reintenta un error de conexión", async () => {
    script(() => new sdk.APIConnectionError(), ok);
    const { provider: p } = provider();

    await p.generate(args);

    expect(sdk.stream).toHaveBeenCalledTimes(2);
  });

  it("reintenta un error de servicio a mitad del stream", async () => {
    script(
      () =>
        new sdk.APIError(
          undefined,
          { type: "error", error: { type: "overloaded_error" } },
          "{}",
        ),
      ok,
    );
    const { provider: p } = provider();

    await p.generate(args);

    expect(sdk.stream).toHaveBeenCalledTimes(2);
  });

  it("un fallo no reintentable tras uno reintentable se lanza sin más vueltas", async () => {
    script(overloaded, bad);
    const { provider: p } = provider();

    await expect(p.generate(args)).rejects.toMatchObject({ status: 400 });
    expect(sdk.stream).toHaveBeenCalledTimes(2);
  });
});

describe("el presupuesto", () => {
  it("una llamada con el plazo ya vencido no toca el SDK", async () => {
    script(ok);
    const { provider: p } = provider();

    await expect(p.generate({ ...args, deadline: -1 })).rejects.toBeInstanceOf(
      BudgetExhausted,
    );
    expect(sdk.stream).not.toHaveBeenCalled();
  });

  it("deja de intentar cuando no queda margen para otro intento", async () => {
    const { provider: p, time } = provider({
      budget: {
        totalMs: 100,
        minAttemptMs: 40,
        attemptTimeoutMs: 100,
        maxAttemptsPerModel: 2,
      },
    });

    // Cada intento tarda 50 ms de reloj antes de fallar.
    script(() => {
      time.clock.t += 50;
      return overloaded();
    });

    await expect(p.generate(args)).rejects.toMatchObject({ status: 529 });

    // 100 ms de presupuesto: el primer intento gasta 50, el retroceso se recorta
    // a 10 para no comerse el margen del segundo (40 ms, justo el mínimo), que
    // muere; el tercero (Haiku) ya no cabe. Cuatro intentos habría sido pasarse.
    expect(sdk.stream).toHaveBeenCalledTimes(2);
    expect(modelsCalled()).toEqual(["claude-sonnet-5", "claude-sonnet-5"]);
    expect(time.sleep).toHaveBeenCalledWith(10);
  });

  it("el timeout de cada intento es lo que quede si es menos que el suyo", async () => {
    script(ok);
    const { provider: p, time } = provider();

    await p.generate({ ...args, deadline: time.now() + 60_000 });

    const [, options] = sdk.stream.mock.calls[0] as [
      unknown,
      { timeout: number },
    ];
    expect(options.timeout).toBe(60_000);
  });

  it("sin plazo propio parte del presupuesto total", async () => {
    script(ok);
    const { provider: p } = provider();

    await p.generate(args);

    const [, options] = sdk.stream.mock.calls[0] as [
      unknown,
      { timeout: number },
    ];
    expect(options.timeout).toBe(
      Math.min(DEFAULT_BUDGET.attemptTimeoutMs, DEFAULT_BUDGET.totalMs),
    );
  });

  it("registra por qué se rindió", async () => {
    const { provider: p, time } = provider({
      budget: { totalMs: 100, minAttemptMs: 40, attemptTimeoutMs: 100 },
    });
    script(() => {
      time.clock.t += 80;
      return overloaded();
    });

    await expect(p.generate(args)).rejects.toBeDefined();

    const events = lines.map((line) => JSON.parse(line).event);
    expect(events).toContain("provider.budget_exhausted");
  });
});

describe("el timeout de un intento", () => {
  /** Un stream que no acaba nunca salvo que se aborte su señal. */
  const hangsUntilAborted = () => {
    sdk.stream.mockImplementationOnce(
      (_params: unknown, options: { signal: AbortSignal }) => ({
        finalMessage: () =>
          new Promise((_, reject) => {
            options.signal.addEventListener("abort", () =>
              reject(new sdk.APIUserAbortError()),
            );
          }),
      }),
    );
  };

  it("un intento colgado se corta y se reintenta", async () => {
    hangsUntilAborted();
    sdk.stream.mockImplementationOnce(() => ({
      finalMessage: async () => ok(),
    }));

    const { provider: p } = provider({
      budget: { attemptTimeoutMs: 20, minAttemptMs: 1, totalMs: 60_000 },
    });

    const result = await p.generate(args);

    expect(result.json).toBe(PLAN);
    expect(sdk.stream).toHaveBeenCalledTimes(2);

    const first = sdk.stream.mock.calls[0][1] as { signal: AbortSignal };
    expect(first.signal.aborted).toBe(true);
  });

  it("si todos se cuelgan, el error final es AttemptTimeout, no un aborto", async () => {
    for (let i = 0; i < 4; i += 1) hangsUntilAborted();

    const { provider: p } = provider({
      budget: { attemptTimeoutMs: 10, minAttemptMs: 1, totalMs: 60_000 },
    });

    await expect(p.generate(args)).rejects.toBeInstanceOf(AttemptTimeout);
    expect(sdk.stream).toHaveBeenCalledTimes(4);
  });
});

describe("el registro", () => {
  it("cuenta los reintentos y el respaldo, con request_id", async () => {
    script(overloaded, overloaded, ok);
    const { provider: p } = provider();

    await p.generate(args);

    const parsed = lines.map((line) => JSON.parse(line));
    const events = parsed.map((entry) => entry.event);

    expect(events).toEqual([
      "provider.attempt_failed",
      "provider.retrying",
      "provider.attempt_failed",
      "provider.fallback",
      "provider.recovered",
    ]);

    for (const entry of parsed) {
      expect(entry.request_id).toBe("req-12345678");
    }

    expect(parsed[0]).toMatchObject({
      model: "claude-sonnet-5",
      attempt: 1,
      error_status: 529,
    });
  });

  it("no anuncia un respaldo después del último modelo", async () => {
    script(overloaded);
    const { provider: p } = provider();

    await expect(p.generate(args)).rejects.toBeDefined();

    const fallbacks = lines
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.event === "provider.fallback");

    expect(fallbacks).toHaveLength(1);
  });

  it("nunca vuelca el mensaje del error, que puede citar lo que se envió", async () => {
    script(
      () =>
        new sdk.APIError(
          529,
          undefined,
          "Overloaded while processing: Señor, sostén a mi madre enferma",
        ),
      ok,
    );
    const { provider: p } = provider();

    await p.generate(args);

    expect(lines.join("\n")).not.toContain("madre");
  });
});
