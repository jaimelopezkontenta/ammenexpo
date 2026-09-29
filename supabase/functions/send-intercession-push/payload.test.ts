import { describe, expect, it } from "vitest";

import {
  authorizeInvoker,
  BATCH_SIZE,
  buildPushMessage,
  chunk,
  classifyTicket,
  errorReasonFor,
  isDeviceNotRegistered,
  pairTicketsWithDestinations,
  resolveSenderConfig,
  timingSafeEqualString,
  unmatchedTicketCount,
  type ExpoPushTicket,
  type PushDestination,
} from "./payload";

const destinationFor = (n: number): PushDestination => ({
  outboxId: `outbox-${n}`,
  expoPushToken: `ExponentPushToken[${n}]`,
  intercessorName: `Persona ${n}`,
});

describe("buildPushMessage", () => {
  it("never includes the intercession's own text", () => {
    const message = buildPushMessage({
      outboxId: "11111111-1111-1111-1111-111111111111",
      expoPushToken: "ExponentPushToken[abc]",
      intercessorName: "Beto",
    });

    expect(message.body).toBe("Beto oró por tu día de hoy.");
    expect(JSON.stringify(message)).not.toMatch(/message|prayer_body/i);
  });

  it("carries only the outbox id in data, never the plan or prayer content", () => {
    const message = buildPushMessage({
      outboxId: "aaaa0000-0000-0000-0000-000000000001",
      expoPushToken: "ExponentPushToken[abc]",
      intercessorName: "Carla",
    });

    expect(message.data).toEqual({
      type: "intercession",
      outboxId: "aaaa0000-0000-0000-0000-000000000001",
    });
  });

  it("targets the device's own token", () => {
    const message = buildPushMessage({
      outboxId: "1",
      expoPushToken: "ExponentPushToken[xyz]",
      intercessorName: "Ana",
    });

    expect(message.to).toBe("ExponentPushToken[xyz]");
  });
});

describe("chunk", () => {
  it("splits into groups no larger than the batch size", () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const chunks = chunk(items, BATCH_SIZE);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });

  it("returns a single chunk when under the limit", () => {
    expect(chunk([1, 2, 3], BATCH_SIZE)).toEqual([[1, 2, 3]]);
  });

  it("returns nothing for an empty list", () => {
    expect(chunk([], BATCH_SIZE)).toEqual([]);
  });
});

describe("isDeviceNotRegistered", () => {
  it("is true only for that exact provider error", () => {
    const ticket: ExpoPushTicket = {
      status: "error",
      message: "not registered",
      details: { error: "DeviceNotRegistered" },
    };

    expect(isDeviceNotRegistered(ticket)).toBe(true);
  });

  it("is false for a different, retryable error", () => {
    const ticket: ExpoPushTicket = {
      status: "error",
      message: "rate limited",
      details: { error: "MessageRateExceeded" },
    };

    expect(isDeviceNotRegistered(ticket)).toBe(false);
  });

  it("is false for a successful ticket", () => {
    const ticket: ExpoPushTicket = { status: "ok", id: "receipt-1" };

    expect(isDeviceNotRegistered(ticket)).toBe(false);
  });
});

describe("classifyTicket", () => {
  it("classifies an accepted ticket as sent", () => {
    const ticket: ExpoPushTicket = { status: "ok", id: "receipt-1" };

    expect(classifyTicket(ticket)).toBe("sent");
  });

  it("classifies DeviceNotRegistered as permanent, never retryable", () => {
    const ticket: ExpoPushTicket = {
      status: "error",
      message: "not registered",
      details: { error: "DeviceNotRegistered" },
    };

    expect(classifyTicket(ticket)).toBe("permanent_failure");
  });

  // El defecto real que este ciclo corrige: antes, esto se escribía como
  // `failed` terminal y revocaba el dispositivo, exactamente igual que un
  // token muerto de verdad.
  it("classifies a rate limit as retryable, not permanent", () => {
    const ticket: ExpoPushTicket = {
      status: "error",
      message: "rate limited",
      details: { error: "MessageRateExceeded" },
    };

    expect(classifyTicket(ticket)).toBe("retryable_failure");
  });

  it("classifies an error with no details at all as retryable", () => {
    const ticket: ExpoPushTicket = {
      status: "error",
      message: "unknown provider hiccup",
    };

    expect(classifyTicket(ticket)).toBe("retryable_failure");
  });

  it("classifies an unrecognised error code as retryable, not permanent", () => {
    // Nunca al revés: un código que Expo no documenta todavía no puede
    // interpretarse como "el token no existe" solo porque no es "ok".
    const ticket: ExpoPushTicket = {
      status: "error",
      message: "something new",
      details: { error: "SomeFutureExpoErrorCode" },
    };

    expect(classifyTicket(ticket)).toBe("retryable_failure");
  });

  // El defecto de este segundo ciclo: un ticket ausente (respuesta
  // incompleta de Expo) nunca puede ser `permanent_failure` — no hay ningún
  // `DeviceNotRegistered` que lo respalde, así que no hay motivo para
  // revocar un dispositivo por esto.
  it("classifies a missing ticket (null) as retryable, never permanent", () => {
    expect(classifyTicket(null)).toBe("retryable_failure");
  });
});

describe("errorReasonFor", () => {
  it("prefers the structured error code over the free-text message", () => {
    const ticket: ExpoPushTicket = {
      status: "error",
      message: "The recipient device is not registered with FCM/APNs.",
      details: { error: "DeviceNotRegistered" },
    };

    expect(errorReasonFor(ticket)).toBe("DeviceNotRegistered");
  });

  it("falls back to the message when there is no structured code", () => {
    const ticket: ExpoPushTicket = {
      status: "error",
      message: "unknown provider hiccup",
    };

    expect(errorReasonFor(ticket)).toBe("unknown provider hiccup");
  });

  it("is empty for a successful ticket", () => {
    const ticket: ExpoPushTicket = { status: "ok", id: "receipt-1" };

    expect(errorReasonFor(ticket)).toBe("");
  });

  it("names the specific reason for a missing ticket, not a generic one", () => {
    expect(errorReasonFor(null)).toBe("missing_ticket_in_response");
  });
});

/**
 * MAYOR (segundo ciclo) — el sender asumía `tickets[i]` correspondía a
 * `destinations[i]` sin comprobarlo. Una respuesta incompleta dejaba filas
 * sin resolver para siempre (arrendadas hasta que el lease expirase, sin
 * subir `attempts`); una respuesta con tickets de más lanzaba un
 * `TypeError` al leer `batch[index]` fuera de rango, que el `catch` de
 * fuera capturaba como "fallo de transporte del lote entero" — marcando
 * como reintentable hasta los envíos que sí habían llegado con `status:
 * "ok"`. Estas pruebas fijan el emparejamiento seguro que lo reemplaza.
 */
describe("pairTicketsWithDestinations", () => {
  it("pairs 1:1 when the response is exactly as long as the request", () => {
    const destinations = [destinationFor(1), destinationFor(2)];
    const tickets: ExpoPushTicket[] = [
      { status: "ok", id: "r1" },
      { status: "ok", id: "r2" },
    ];

    const paired = pairTicketsWithDestinations(destinations, tickets);

    expect(paired).toEqual([
      { destination: destinations[0], ticket: tickets[0] },
      { destination: destinations[1], ticket: tickets[1] },
    ]);
  });

  it("marks every destination beyond a short response with ticket: null, never undefined", () => {
    const destinations = [
      destinationFor(1),
      destinationFor(2),
      destinationFor(3),
    ];
    const tickets: ExpoPushTicket[] = [{ status: "ok", id: "r1" }];

    const paired = pairTicketsWithDestinations(destinations, tickets);

    expect(paired).toHaveLength(3);
    expect(paired[0]).toEqual({
      destination: destinations[0],
      ticket: tickets[0],
    });
    expect(paired[1]).toEqual({ destination: destinations[1], ticket: null });
    expect(paired[2]).toEqual({ destination: destinations[2], ticket: null });
    // Nunca `undefined`: es la forma concreta en que un acceso fuera de
    // rango se manifestaba antes de esta función.
    expect(paired.some((p) => p.ticket === undefined)).toBe(false);
  });

  it("ignores extra tickets beyond what was requested, without crashing or misassigning them", () => {
    const destinations = [destinationFor(1)];
    const tickets: ExpoPushTicket[] = [
      { status: "ok", id: "r1" },
      { status: "ok", id: "r2" },
      { status: "ok", id: "r3" },
    ];

    const paired = pairTicketsWithDestinations(destinations, tickets);

    expect(paired).toHaveLength(1);
    expect(paired[0]).toEqual({
      destination: destinations[0],
      ticket: tickets[0],
    });
  });

  it("handles a completely empty response the same way as any other shortfall", () => {
    const destinations = [destinationFor(1), destinationFor(2)];

    const paired = pairTicketsWithDestinations(destinations, []);

    expect(paired).toEqual([
      { destination: destinations[0], ticket: null },
      { destination: destinations[1], ticket: null },
    ]);
  });

  it("is the empty list when nothing was sent, regardless of what tickets claim to exist", () => {
    expect(
      pairTicketsWithDestinations([], [{ status: "ok", id: "r1" }]),
    ).toEqual([]);
  });

  // El caso completo que motivó la corrección: una fila sin ticket queda
  // como reintentable, no como perdida, y las que sí llegaron "ok" no se
  // contaminan por la desalineación de las demás.
  it("end to end: a short response leaves the missing rows retryable, and the matched ones sent — never crashes", () => {
    const destinations = [
      destinationFor(1),
      destinationFor(2),
      destinationFor(3),
    ];
    const tickets: ExpoPushTicket[] = [{ status: "ok", id: "r1" }];

    const outcomes = pairTicketsWithDestinations(destinations, tickets).map(
      ({ destination, ticket }) => ({
        outboxId: destination.outboxId,
        outcome: classifyTicket(ticket),
        reason: errorReasonFor(ticket),
      }),
    );

    expect(outcomes).toEqual([
      { outboxId: "outbox-1", outcome: "sent", reason: "" },
      {
        outboxId: "outbox-2",
        outcome: "retryable_failure",
        reason: "missing_ticket_in_response",
      },
      {
        outboxId: "outbox-3",
        outcome: "retryable_failure",
        reason: "missing_ticket_in_response",
      },
    ]);
  });
});

describe("unmatchedTicketCount", () => {
  it("is zero for an exact match", () => {
    expect(
      unmatchedTicketCount([destinationFor(1)], [{ status: "ok", id: "r1" }]),
    ).toBe(0);
  });

  it("is zero when the response is short, not negative", () => {
    const destinations = [destinationFor(1), destinationFor(2)];

    expect(unmatchedTicketCount(destinations, [])).toBe(0);
  });

  it("counts exactly how many tickets have nowhere to go", () => {
    const destinations = [destinationFor(1)];
    const tickets: ExpoPushTicket[] = [
      { status: "ok", id: "r1" },
      { status: "ok", id: "r2" },
      { status: "ok", id: "r3" },
    ];

    expect(unmatchedTicketCount(destinations, tickets)).toBe(2);
  });
});

/**
 * Fail-closed del sender: con ninguna configuración interna válida queda
 * deshabilitado y devuelve una etiqueta fija, sin exponer la URL ni la clave
 * de servicio. El kill switch conserva su semántica exacta.
 */
describe("resolveSenderConfig", () => {
  it("honours the kill switch exactly on the literal 'false'", () => {
    const config = resolveSenderConfig({
      PUSH_SENDER_ENABLED: "false",
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
    });

    expect(config).toEqual({ enabled: false, reason: "kill_switch" });
  });

  it("is enabled when both url and key are present", () => {
    const config = resolveSenderConfig({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
    });

    expect(config).toEqual({
      enabled: true,
      supabaseUrl: "http://localhost:54321",
      serviceRoleKey: "secret",
    });
  });

  it("fails closed when the url is missing", () => {
    expect(
      resolveSenderConfig({ SUPABASE_SERVICE_ROLE_KEY: "secret" }),
    ).toEqual({ enabled: false, reason: "not_configured" });
  });

  it("fails closed when the service role key is missing", () => {
    expect(
      resolveSenderConfig({ SUPABASE_URL: "http://localhost:54321" }),
    ).toEqual({ enabled: false, reason: "not_configured" });
  });

  it("fails closed on blank strings, not only on absent keys", () => {
    expect(
      resolveSenderConfig({
        SUPABASE_URL: "   ",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toEqual({ enabled: false, reason: "not_configured" });
  });

  it("never echoes a secret into the disabled result", () => {
    const config = resolveSenderConfig({
      SUPABASE_SERVICE_ROLE_KEY: "sk-super-secret-value",
    });

    expect(config).toEqual({ enabled: false, reason: "not_configured" });
    expect(JSON.stringify(config)).not.toContain("sk-super-secret-value");
  });
});

describe("timingSafeEqualString", () => {
  it("is true for identical strings", () => {
    expect(timingSafeEqualString("same-secret", "same-secret")).toBe(true);
  });

  it("is false for different strings of the same length", () => {
    expect(timingSafeEqualString("abcdefgh", "abcdxyzw")).toBe(false);
  });

  it("is false for different lengths, without treating the shorter as a prefix match", () => {
    expect(timingSafeEqualString("secret", "secret-extra")).toBe(false);
    expect(timingSafeEqualString("secret-extra", "secret")).toBe(false);
  });
});

describe("authorizeInvoker", () => {
  const LOCAL = "http://127.0.0.1:54421";
  const REMOTE = "https://syprzdjznuppckenuaua.supabase.co";

  it("does not require a header locally when the secret is absent", () => {
    expect(authorizeInvoker(null, undefined, LOCAL)).toBe("not_required");
    expect(authorizeInvoker("anything", undefined, LOCAL)).toBe("not_required");
  });

  it("does not require a header locally when the secret is blank", () => {
    expect(authorizeInvoker(null, "   ", LOCAL)).toBe("not_required");
    expect(authorizeInvoker(undefined, "", LOCAL)).toBe("not_required");
  });

  it("fails closed outside local when the secret is absent or blank", () => {
    expect(authorizeInvoker(null, undefined, REMOTE)).toBe("unauthorized");
    expect(authorizeInvoker("anything", "  ", REMOTE)).toBe("unauthorized");
  });

  it("accepts an exact header match when the secret is set", () => {
    expect(
      authorizeInvoker("local-invoke-secret", "local-invoke-secret", REMOTE),
    ).toBe("ok");
  });

  it("rejects a missing or wrong header when the secret is set", () => {
    expect(authorizeInvoker(null, "local-invoke-secret", REMOTE)).toBe(
      "unauthorized",
    );
    expect(authorizeInvoker("", "local-invoke-secret", REMOTE)).toBe(
      "unauthorized",
    );
    expect(authorizeInvoker("nope", "local-invoke-secret", REMOTE)).toBe(
      "unauthorized",
    );
  });

  it("never echoes the secret in the result", () => {
    const result = authorizeInvoker("wrong", "super-secret-value", REMOTE);

    expect(result).toBe("unauthorized");
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });
});
