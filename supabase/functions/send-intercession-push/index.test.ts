import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * El handler de `send-intercession-push` sin Deno ni Expo. Comprueba lo que solo
 * vive en `index.ts`: cómo cada ticket (o un fallo de transporte) se convierte en
 * una marca del outbox, y que ni el token del dispositivo ni el nombre de quien
 * oró llegan a un log.
 */
const h = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  env: new Map<string, string>(),
  rpc: vi.fn(),
}));

vi.mock("npm:@supabase/supabase-js@^2.58.0", () => ({
  createClient: vi.fn(() => ({ rpc: h.rpc })),
}));

const SECRET = "s3cret-push";
const TOKEN = "ExponentPushToken[token-secreto-del-dispositivo]";

const row = (n: number) => ({
  outbox_id: `outbox-${n}`,
  intercession_id: `int-${n}`,
  expo_push_token: `ExponentPushToken[dispositivo-${n}]`,
  owner_id: "owner",
  owner_name: "Marta Privada",
  intercessor_name: "Beto Privado",
  attempts: 1,
});

let rpcs: Record<string, (args: Record<string, unknown>) => unknown>;
let marks: { id: string; status: string; error: string | null }[];
let lines: string[];

beforeAll(async () => {
  vi.stubGlobal("Deno", {
    env: { get: (name: string) => h.env.get(name) },
    serve: (handler: (req: Request) => Promise<Response>) => {
      h.handler = handler;
    },
  });

  await import("./index.ts");
});

beforeEach(() => {
  h.env.clear();
  h.env.set("SUPABASE_URL", "http://kong:8000");
  h.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
  h.env.set("AMMEN_PUSH_INVOKE_SECRET", SECRET);

  marks = [];
  rpcs = {
    claim_push_outbox_batch: () => ({ data: [row(1), row(2)], error: null }),
    mark_push_delivery: (args) => {
      marks.push({
        id: String(args.p_outbox_id),
        status: String(args.p_status),
        error: (args.p_error as string | null) ?? null,
      });
      return { data: null, error: null };
    },
  };

  h.rpc.mockReset();
  h.rpc.mockImplementation(
    async (name: string, args: Record<string, unknown>) =>
      rpcs[name] ? rpcs[name](args) : { data: null, error: null },
  );

  lines = [];
  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: string) => {
      lines.push(line);
    });
  }

  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    expo([
      { status: "ok", id: "receipt-1" },
      { status: "ok", id: "receipt-2" },
    ]),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const expo = (tickets: unknown[], status = 200) =>
  new Response(JSON.stringify({ data: tickets }), { status });

const invoke = async (headers: Record<string, string> = {}) => {
  const response = await h.handler!(
    new Request("http://localhost/functions/v1/send-intercession-push", {
      method: "POST",
      headers: { "x-ammen-invoker": SECRET, ...headers },
    }),
  );

  return { response, body: await response.json() };
};

const parsed = () => lines.map((line) => JSON.parse(line));
const events = () => parsed().map((entry) => entry.event as string);

describe("acceso y configuración", () => {
  it("el preflight lleva el CORS de los drenajes", async () => {
    const response = await h.handler!(
      new Request("http://localhost/x", { method: "OPTIONS" }),
    );

    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "x-ammen-invoker",
    );
  });

  it("un header que no es el secreto: 401 y nada arrendado", async () => {
    const { response, body } = await invoke({ "x-ammen-invoker": "otro" });

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "unauthorized" });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(events()).toContain("auth.rejected");
  });

  it("el kill switch no arrienda nada", async () => {
    h.env.set("PUSH_SENDER_ENABLED", "false");

    const { body } = await invoke();

    expect(body).toEqual({ ok: true, skipped: "kill_switch", sent: 0 });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("sin clave de servicio: 503 y nada arrendado", async () => {
    h.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    const { response, body } = await invoke();

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false, error: "sender_not_configured" });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("si falla arrendar: 500 con su etiqueta", async () => {
    rpcs.claim_push_outbox_batch = () => ({
      data: null,
      error: { code: "57014", message: "no debe salir" },
    });

    const { response, body } = await invoke();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: "claim_push_outbox_batch_failed",
    });
    expect(lines.join("\n")).not.toContain("no debe salir");
  });

  it("una cola vacía: ceros y sin llamar a Expo", async () => {
    rpcs.claim_push_outbox_batch = () => ({ data: [], error: null });

    const { body } = await invoke();

    expect(body).toEqual({ ok: true, sent: 0, retried: 0, failed: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("el envío", () => {
  it("dos tickets ok se marcan sent con su recibo", async () => {
    const { body } = await invoke();

    expect(body).toEqual({ ok: true, sent: 2, retried: 0, failed: 0 });
    expect(marks.map((m) => m.status)).toEqual(["sent", "sent"]);
  });

  it("la llamada a Expo lleva un timeout", async () => {
    await invoke();

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("DeviceNotRegistered es permanente; un límite de tasa, reintentable", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      expo([
        {
          status: "error",
          message: `"${TOKEN}" is not a registered push notification recipient`,
          details: { error: "DeviceNotRegistered" },
        },
        {
          status: "error",
          message: "too many",
          details: { error: "MessageRateExceeded" },
        },
      ]),
    );

    const { body } = await invoke();

    expect(body).toEqual({ ok: true, sent: 0, retried: 1, failed: 1 });
    expect(marks.map((m) => m.status)).toEqual([
      "permanent_failure",
      "retryable_failure",
    ]);
  });

  it("un status no ok de Expo marca todo el lote como reintentable", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(expo([], 503));

    const { body } = await invoke();

    expect(body).toEqual({ ok: true, sent: 0, retried: 2, failed: 0 });
    expect(marks.map((m) => m.status)).toEqual([
      "retryable_failure",
      "retryable_failure",
    ]);
    expect(marks[0].error).toBe("Expo push API responded 503");
    expect(events()).toContain("batch.transport_failure");
  });

  it("un fallo de red (o el timeout) tampoco pierde el lote", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    const { body } = await invoke();

    expect(body).toMatchObject({ retried: 2, sent: 0 });
  });

  it("un ticket de menos deja al destino sin ticket como reintentable", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      expo([{ status: "ok", id: "receipt-1" }]),
    );

    const { body } = await invoke();

    expect(body).toEqual({ ok: true, sent: 1, retried: 1, failed: 0 });
    expect(marks[1]).toMatchObject({
      status: "retryable_failure",
      error: "missing_ticket_in_response",
    });
  });

  it("tickets de más se registran y no desalinean el resto", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      expo([
        { status: "ok", id: "r1" },
        { status: "ok", id: "r2" },
        { status: "ok", id: "r3" },
      ]),
    );

    const { body } = await invoke();

    expect(body).toMatchObject({ sent: 2 });
    expect(parsed().find((e) => e.event === "tickets.unmatched")).toMatchObject(
      { extra: 1, destinations: 2 },
    );
  });
});

describe("los logs", () => {
  it("nunca llevan el token del dispositivo ni los nombres, ni el message de Expo", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      expo([
        {
          status: "error",
          message: `"${TOKEN}" is not a registered push notification recipient`,
        },
        {
          status: "error",
          message: `"${TOKEN}" gone`,
          details: { error: "DeviceNotRegistered" },
        },
      ]),
    );

    await invoke();

    const all = lines.join("\n");

    expect(all).not.toContain("ExponentPushToken");
    expect(all).not.toContain("token-secreto");
    expect(all).not.toContain("dispositivo-1");
    expect(all).not.toContain("Marta");
    expect(all).not.toContain("Beto");
    expect(all).not.toContain(SECRET);

    const notSent = parsed().filter((e) => e.event === "delivery.not_sent");
    expect(notSent.map((e) => e.reason)).toEqual([
      "expo_error",
      "DeviceNotRegistered",
    ]);
  });

  it("…pero la base sí recibe el motivo completo, como antes", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      expo([
        { status: "error", message: "hiccup del proveedor" },
        { status: "ok", id: "r2" },
      ]),
    );

    await invoke();

    expect(marks[0]).toMatchObject({
      status: "retryable_failure",
      error: "hiccup del proveedor",
    });
  });

  it("todas llevan función y request_id, y respetan el x-request-id que traiga", async () => {
    await invoke({ "x-request-id": "cron-run-000456" });

    for (const entry of parsed()) {
      expect(entry).toMatchObject({
        fn: "send-intercession-push",
        request_id: "cron-run-000456",
      });
    }

    expect(events()).toEqual(["batch.claimed", "batch.done"]);
  });

  it("si falla marcar la entrega, se registra con el id y el código, sin el mensaje", async () => {
    rpcs.mark_push_delivery = () => ({
      data: null,
      error: { code: "40001", message: `serialización: ${TOKEN}` },
    });

    await invoke();

    const failed = parsed().find((e) => e.event === "mark.failed");

    expect(failed).toMatchObject({ error_code: "40001" });
    expect(lines.join("\n")).not.toContain("ExponentPushToken");
  });
});
