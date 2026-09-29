import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLogger,
  describeError,
  log,
  redact,
  REDACTED,
  requestIdFrom,
} from "./log.ts";

let sink: { log: string[]; warn: string[]; error: string[] };

beforeEach(() => {
  sink = { log: [], warn: [], error: [] };
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    sink.log.push(line);
  });
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    sink.warn.push(line);
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    sink.error.push(line);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const lastLine = () => {
  const all = [...sink.log, ...sink.warn, ...sink.error];
  return all[all.length - 1] ?? "";
};

describe("log", () => {
  it("emite UNA línea de JSON con nivel, evento y hora", () => {
    log("info", "plan.created", { plan_id: "abc", days: 7 });

    const line = lastLine();
    expect(line).not.toContain("\n");

    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: "info",
      event: "plan.created",
      plan_id: "abc",
      days: 7,
    });
    expect(new Date(parsed.ts).toString()).not.toBe("Invalid Date");
  });

  it("reparte por nivel: error a console.error, warn a console.warn", () => {
    log("error", "boom");
    log("warn", "hmm");
    log("info", "fyi");
    log("debug", "meh");

    expect(sink.error).toHaveLength(1);
    expect(sink.warn).toHaveLength(1);
    expect(sink.log).toHaveLength(2);
  });

  it("un valor con salto de línea sigue siendo una sola línea", () => {
    log("info", "x", { reason: "a\nb\r\nc" });

    expect(lastLine()).not.toMatch(/[\r\n]/);
    expect(JSON.parse(lastLine()).reason).toBe("a\nb\r\nc");
  });

  it("los campos no pisan las claves reservadas", () => {
    log("info", "real", {
      level: "error",
      event: "fake",
      ts: "ayer",
      request_id: "r-1234567",
    });

    const parsed = JSON.parse(lastLine());
    expect(parsed.level).toBe("info");
    expect(parsed.event).toBe("real");
    expect(parsed.ts).not.toBe("ayer");
    expect(parsed.request_id).toBe("r-1234567");
  });

  it("omite los campos undefined y conserva los null", () => {
    log("info", "x", { a: undefined, b: null });

    const parsed = JSON.parse(lastLine());
    expect("a" in parsed).toBe(false);
    expect(parsed.b).toBeNull();
  });
});

describe("redact: nada de texto de oración, correos ni tokens", () => {
  it("tapa cadenas cuya clave suena a dato sensible", () => {
    for (const key of [
      "prompt",
      "prayer_body",
      "body",
      "payload",
      "content",
      "message",
      "text",
      "email",
      "to_email",
      "expo_push_token",
      "secret",
      "password",
      "authorization",
      "apikey",
      "display_name",
      "custom_topic",
      "to",
    ]) {
      expect(redact(key, "Señor, sostén a mi madre"), key).toBe(REDACTED);
    }
  });

  it("tapa un valor con forma de correo o de credencial, sea cual sea la clave", () => {
    expect(redact("note", "jaime@ammen.app")).toBe(REDACTED);
    expect(redact("note", "Bearer abcdef")).toBe(REDACTED);
    expect(redact("note", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def")).toBe(
      REDACTED,
    );
  });

  it("deja pasar los números y booleanos aunque la clave suene a sensible", () => {
    expect(redact("input_tokens", 1200)).toBe(1200);
    expect(redact("body_bytes", 512)).toBe(512);
    expect(redact("email_sent", true)).toBe(true);
  });

  it("un número no finito no sale como NaN", () => {
    expect(redact("n", Number.NaN)).toBeNull();
    expect(redact("n", Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("recorta lo largo: eso ya es texto, no un código", () => {
    const out = redact("reason", "x".repeat(500)) as string;

    expect(out.length).toBeLessThan(200);
  });

  it("un objeto colado por un cast se registra como tapado", () => {
    expect(redact("meta", { prayer: "..." } as never)).toBe(REDACTED);
  });

  it("los códigos y ids normales pasan", () => {
    expect(redact("reason", "quota_exhausted")).toBe("quota_exhausted");
    expect(redact("plan_id", "3f2b8a9e-1c4d-4e5f-8a6b-7c8d9e0f1a2b")).toBe(
      "3f2b8a9e-1c4d-4e5f-8a6b-7c8d9e0f1a2b",
    );
    expect(redact("model", "claude-sonnet-5")).toBe("claude-sonnet-5");
  });

  it("de punta a punta: la línea final no lleva el texto ni el correo", () => {
    log("error", "send.failed", {
      to_email: "persona@example.com",
      prayer_body: "Dios mío, mi hijo está enfermo",
      status: "retryable_failure",
      attempts: 2,
    });

    const line = lastLine();
    expect(line).not.toContain("persona@example.com");
    expect(line).not.toContain("mi hijo");
    expect(JSON.parse(line)).toMatchObject({
      to_email: REDACTED,
      prayer_body: REDACTED,
      status: "retryable_failure",
      attempts: 2,
    });
  });
});

describe("createLogger", () => {
  it("cada línea lleva la función y el request_id", () => {
    const logger = createLogger("generate-prayer-plan", "req-12345678");

    logger.info("started");
    logger.warn("slow", { ms: 900 });
    logger.error("failed", { reason: "x" });

    expect(logger.requestId).toBe("req-12345678");

    for (const line of [...sink.log, ...sink.warn, ...sink.error]) {
      expect(JSON.parse(line)).toMatchObject({
        fn: "generate-prayer-plan",
        request_id: "req-12345678",
      });
    }
  });

  it("los campos base se repiten y los de la llamada los completan", () => {
    const logger = createLogger("f", "req-12345678", { plan_id: "p1" });

    logger.info("a", { from_day: 8 });

    expect(JSON.parse(lastLine())).toMatchObject({
      plan_id: "p1",
      from_day: 8,
    });
  });

  it("los campos no pueden cambiar el request_id de un logger", () => {
    const logger = createLogger("f", "req-12345678");

    logger.info("a", { request_id: "otro-cualquiera" });

    expect(JSON.parse(lastLine()).request_id).toBe("req-12345678");
  });
});

describe("requestIdFrom", () => {
  const headers = (value: string | null) => ({
    get: (name: string) => (name === "x-request-id" ? value : null),
  });

  it("adopta un x-request-id razonable, para encadenar invocaciones", () => {
    expect(requestIdFrom(headers("3f2b8a9e-1c4d-4e5f-8a6b-7c8d9e0f1a2b"))).toBe(
      "3f2b8a9e-1c4d-4e5f-8a6b-7c8d9e0f1a2b",
    );
    expect(requestIdFrom(headers("  trace_ABC-123.x "))).toBe(
      "trace_ABC-123.x",
    );
  });

  it("descarta lo que no parece un id y acuña uno", () => {
    for (const bad of [
      null,
      "",
      "corto",
      "con espacios dentro del id",
      "x".repeat(65),
      '{"a":"b"}',
      "a\nb-1234567",
      "<script>alert(1)</script>",
    ]) {
      const id = requestIdFrom(headers(bad));
      expect(id).not.toBe(bad);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("dos peticiones sin cabecera reciben ids distintos", () => {
    expect(requestIdFrom(headers(null))).not.toBe(requestIdFrom(headers(null)));
  });
});

describe("describeError", () => {
  class PostgrestLikeError extends Error {
    code = "23514";
    details = "Failing row contains (Señor, sostén a mi madre)";
    hint = "otra oración";
  }

  it("solo clase, código y status: nunca message, details ni hint", () => {
    const fields = describeError(
      new PostgrestLikeError(
        'new row violates check "Señor, sostén a mi madre"',
      ),
    );

    expect(fields).toEqual({
      error_class: "PostgrestLikeError",
      error_code: "23514",
      error_status: undefined,
      error_type: undefined,
    });

    const flat = JSON.stringify(fields);
    expect(flat).not.toContain("madre");
    expect(flat).not.toContain("oración");
  });

  it("un error del SDK de Anthropic: clase, status y tipo del payload", () => {
    class RateLimitError extends Error {
      status = 429;
      error = { type: "error", error: { type: "rate_limit_error" } };
    }

    expect(
      describeError(new RateLimitError("texto del usuario")),
    ).toMatchObject({
      error_class: "RateLimitError",
      error_status: 429,
      error_type: "rate_limit_error",
    });
  });

  it("un objeto plano de PostgREST (sin clase Error) también se reduce", () => {
    expect(
      describeError({ code: "PGRST116", message: "secreto", details: "x" }),
    ).toMatchObject({ error_class: "Object", error_code: "PGRST116" });
  });

  it("ignora un código o un status con pinta rara", () => {
    const fields = describeError({
      code: "algo con espacios y texto libre",
      status: "500",
    });

    expect(fields.error_code).toBeUndefined();
    expect(fields.error_status).toBeUndefined();
  });

  it("acepta lo que no es un objeto sin lanzar", () => {
    expect(describeError(null)).toEqual({ error_class: "object" });
    expect(describeError("boom")).toEqual({ error_class: "string" });
    expect(describeError(undefined)).toEqual({ error_class: "undefined" });
  });
});
