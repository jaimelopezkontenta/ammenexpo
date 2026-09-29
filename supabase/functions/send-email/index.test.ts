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
 * El handler de `send-email` sin Deno ni Resend: `Deno.serve`/`Deno.env`, el
 * cliente de Supabase y `fetch` están simulados. Lo que se comprueba es lo que
 * solo vive en `index.ts`: cómo se traduce cada respuesta de Resend en una
 * marca del outbox, que un correo sin enlace de baja no sale, y que ni el
 * destinatario ni el cuerpo llegan a un log.
 */
const h = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  env: new Map<string, string>(),
  rpc: vi.fn(),
}));

vi.mock("npm:@supabase/supabase-js@^2.58.0", () => ({
  createClient: vi.fn(() => ({ rpc: h.rpc })),
}));

const SECRET = "s3cret-del-invocador";
const EMAIL = "persona.privada@example.com";
const OUTBOX = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const row = (overrides: Record<string, unknown> = {}) => ({
  outbox_id: OUTBOX,
  template: "habit",
  locale: "es",
  to_email: EMAIL,
  user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  channel: "H",
  payload: { first_name: "Marta" },
  idempotency_key: "idem-1",
  attempts: 1,
  ...overrides,
});

let rpcs: Record<string, (args: Record<string, unknown>) => unknown>;
let marks: { status: string; error: string | null; resend_id: string | null }[];
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
  h.env.set("RESEND_API_KEY", "re_test");
  h.env.set("AMMEN_EMAIL_INVOKE_SECRET", SECRET);

  marks = [];
  rpcs = {
    claim_email_outbox_batch: () => ({ data: [row()], error: null }),
    issue_email_prefs_token: () => ({ data: "tok-de-baja", error: null }),
    mark_email_delivery: (args) => {
      marks.push({
        status: String(args.p_status),
        error: (args.p_error as string | null) ?? null,
        resend_id: (args.p_resend_id as string | null) ?? null,
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
    new Response(JSON.stringify({ id: "re_123" }), { status: 200 }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const invoke = async (headers: Record<string, string> = {}) => {
  const response = await h.handler!(
    new Request("http://localhost/functions/v1/send-email", {
      method: "POST",
      headers: { "x-ammen-invoker": SECRET, ...headers },
    }),
  );

  return { response, body: await response.json() };
};

const events = () => lines.map((line) => JSON.parse(line).event as string);
const resendCall = () =>
  vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];

describe("acceso y configuración", () => {
  it("el preflight lleva el header del invocador entre los permitidos", async () => {
    const response = await h.handler!(
      new Request("http://localhost/x", { method: "OPTIONS" }),
    );

    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, x-client-info, apikey, content-type, x-ammen-invoker",
    );
  });

  it("un header que no es el secreto: 401, sin tocar la cola", async () => {
    const { response, body } = await invoke({ "x-ammen-invoker": "otro" });

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "unauthorized" });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(events()).toContain("auth.rejected");
    expect(lines.join("\n")).not.toContain(SECRET);
    expect(lines.join("\n")).not.toContain("otro");
  });

  it("sin secreto configurado y fuera de local: 401 (fail-closed)", async () => {
    h.env.delete("AMMEN_EMAIL_INVOKE_SECRET");
    h.env.set("SUPABASE_URL", "https://x.supabase.co");

    const { response } = await invoke({});

    expect(response.status).toBe(401);
  });

  it("el kill switch no arrienda nada", async () => {
    h.env.set("EMAIL_SENDER_ENABLED", "false");

    const { body } = await invoke();

    expect(body).toEqual({ ok: true, skipped: "kill_switch", sent: 0 });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("sin clave de Resend: 503 sender_not_configured", async () => {
    h.env.delete("RESEND_API_KEY");

    const { response, body } = await invoke();

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false, error: "sender_not_configured" });
  });

  it("si falla arrendar el lote: 500 con su etiqueta", async () => {
    rpcs.claim_email_outbox_batch = () => ({
      data: null,
      error: { code: "57014", message: "no debe salir" },
    });

    const { response, body } = await invoke();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: "claim_email_outbox_batch_failed",
    });
    expect(lines.join("\n")).not.toContain("no debe salir");
  });

  it("una cola vacía contesta ceros y no llama a Resend", async () => {
    rpcs.claim_email_outbox_batch = () => ({ data: [], error: null });

    const { body } = await invoke();

    expect(body).toEqual({
      ok: true,
      sent: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("el envío", () => {
  it("un correo de hábito sale con su enlace de baja y se marca sent", async () => {
    const { body } = await invoke();

    expect(body).toEqual({
      ok: true,
      sent: 1,
      retried: 0,
      failed: 0,
      skipped: 0,
    });
    expect(marks).toEqual([
      { status: "sent", error: null, resend_id: "re_123" },
    ]);

    const [url, init] = resendCall();
    expect(url).toBe("https://api.resend.com/emails");

    const sent = JSON.parse(init.body as string);
    expect(sent.headers["List-Unsubscribe"]).toContain(
      "/functions/v1/email-unsubscribe?t=tok-de-baja",
    );
    expect(sent.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "idem-1",
    );
  });

  it("la llamada a Resend lleva un timeout", async () => {
    await invoke();

    expect(resendCall()[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("un correo transaccional no pide token de baja", async () => {
    rpcs.claim_email_outbox_batch = () => ({
      data: [row({ template: "welcome", channel: "T" })],
      error: null,
    });

    await invoke();

    expect(h.rpc).not.toHaveBeenCalledWith(
      "issue_email_prefs_token",
      expect.anything(),
    );
    expect(marks[0].status).toBe("sent");
  });

  it("fuera de la lista de staging se marca skipped sin llamar a Resend", async () => {
    h.env.set("EMAIL_ALLOWLIST", "jaime@ammen.app");

    const { body } = await invoke();

    expect(body).toMatchObject({ sent: 0, skipped: 1 });
    expect(marks).toEqual([
      { status: "skipped", error: "not_allowlisted", resend_id: null },
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [429, "retryable_failure", "resend_429"],
    [500, "retryable_failure", "resend_500"],
    [503, "retryable_failure", "resend_503"],
    [422, "permanent_failure", "resend_422"],
    [403, "permanent_failure", "resend_403"],
  ])("Resend %i → %s", async (status, mark, error) => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("{}", { status }),
    );

    await invoke();

    expect(marks).toEqual([{ status: mark, error, resend_id: null }]);
  });

  it("un 4xx raro es reintentable y guarda el trozo de respuesta en la BASE", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(`{"message":"bad to: ${EMAIL}"}`, { status: 400 }),
    );

    await invoke();

    expect(marks[0].status).toBe("retryable_failure");
    expect(marks[0].error).toMatch(/^resend_400:/);
  });

  it("…pero al LOG solo va el código, nunca el destinatario", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(`{"message":"bad to: ${EMAIL}"}`, { status: 400 }),
    );

    await invoke();

    const failure = lines
      .map((line) => JSON.parse(line))
      .find((entry) => entry.event === "delivery.retryable_failure");

    expect(failure).toMatchObject({
      outbox_id: OUTBOX,
      template: "habit",
      code: "resend_400",
    });
    expect(lines.join("\n")).not.toContain(EMAIL);
    expect(lines.join("\n")).not.toContain("persona.privada");
  });

  it("un fallo de red es reintentable", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(
      new TypeError("fetch failed"),
    );

    await invoke();

    expect(marks).toEqual([
      { status: "retryable_failure", error: "fetch failed", resend_id: null },
    ]);
    const failure = lines
      .map((line) => JSON.parse(line))
      .find((entry) => entry.event === "delivery.retryable_failure");
    expect(failure.code).toBe("transport_error");
  });

  it("una respuesta 200 sin id, o que no es JSON, es reintentable y no lanza", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("<html>gateway</html>", { status: 200 }),
    );

    const { response } = await invoke();

    expect(response.status).toBe(200);
    expect(marks).toEqual([
      {
        status: "retryable_failure",
        error: "resend_missing_id",
        resend_id: null,
      },
    ]);
  });
});

describe("un correo que no es transaccional no sale sin enlace de baja", () => {
  it("si falla emitir el token: se reintenta con backoff y NO se llama a Resend", async () => {
    rpcs.issue_email_prefs_token = () => ({
      data: null,
      error: { code: "57014", message: "boom" },
    });

    const { body } = await invoke();

    expect(body).toEqual({
      ok: true,
      sent: 0,
      retried: 1,
      failed: 0,
      skipped: 0,
    });
    expect(marks).toEqual([
      {
        status: "retryable_failure",
        error: "prefs_token_failed",
        resend_id: null,
      },
    ]);
    expect(fetch).not.toHaveBeenCalled();
    expect(events()).toContain("prefs_token.failed");
  });

  it("un fallo con un correo NO detiene el resto del lote", async () => {
    let tokens = 0;
    rpcs.claim_email_outbox_batch = () => ({
      data: [row(), row({ outbox_id: "cccc", idempotency_key: "idem-2" })],
      error: null,
    });
    rpcs.issue_email_prefs_token = () => {
      tokens += 1;
      return tokens === 1
        ? { data: null, error: { code: "57014", message: "boom" } }
        : { data: "tok", error: null };
    };

    const { body } = await invoke();

    expect(body).toMatchObject({ sent: 1, retried: 1 });
    expect(marks.map((m) => m.status)).toEqual(["retryable_failure", "sent"]);
  });

  it("si la base no tiene secreto HMAC (token null) se sigue enviando, con aviso", async () => {
    rpcs.issue_email_prefs_token = () => ({ data: null, error: null });

    const { body } = await invoke();

    expect(body).toMatchObject({ sent: 1 });
    expect(events()).toContain("prefs_token.missing");
    const sent = JSON.parse(resendCall()[1].body as string);
    expect(sent.headers).toBeUndefined();
  });
});

describe("los logs", () => {
  it("no llevan el destinatario, el nombre, el cuerpo ni el token de baja", async () => {
    await invoke();

    const all = lines.join("\n");

    expect(all).not.toContain(EMAIL);
    expect(all).not.toContain("Marta");
    expect(all).not.toContain("tok-de-baja");
    expect(all).not.toContain("re_test");
    expect(all).not.toContain(SECRET);
  });

  it("todas llevan función y request_id, y se reutiliza el x-request-id que traiga", async () => {
    await invoke({ "x-request-id": "cron-run-000123" });

    for (const line of lines) {
      expect(JSON.parse(line)).toMatchObject({
        fn: "send-email",
        request_id: "cron-run-000123",
      });
    }

    expect(events()).toEqual(["batch.claimed", "batch.done"]);
  });

  it("si falla marcar la entrega, se registra sin el mensaje de la base", async () => {
    rpcs.mark_email_delivery = () => ({
      data: null,
      error: { code: "23514", message: `check violado: ${EMAIL}` },
    });

    await invoke();

    const failed = lines
      .map((line) => JSON.parse(line))
      .find((entry) => entry.event === "mark.failed");

    expect(failed).toMatchObject({ outbox_id: OUTBOX, error_code: "23514" });
    expect(lines.join("\n")).not.toContain(EMAIL);
  });
});
