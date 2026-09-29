import { createHmac } from "node:crypto";

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const h = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  env: new Map<string, string>(),
  rpc: vi.fn(),
}));

vi.mock("npm:@supabase/supabase-js@^2.58.0", () => ({
  createClient: vi.fn(() => ({ rpc: h.rpc })),
}));

const KEY = Buffer.from("0123456789abcdef0123456789abcdef");
const SECRET = `whsec_${KEY.toString("base64")}`;
const EMAIL = "persona.privada@example.com";
const BODY = JSON.stringify({
  type: "email.bounced",
  data: { email_id: "re_abc123", to: [EMAIL] },
});

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
  h.env.set("RESEND_WEBHOOK_SECRET", SECRET);

  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: true, error: null });

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

const signed = (body = BODY, id = "msg_test_1") => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const mac = createHmac("sha256", KEY)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${mac}`,
  };
};

const post = (body = BODY, headers: Record<string, string> = signed(body)) =>
  h.handler!(
    new Request("http://localhost/functions/v1/resend-webhook", {
      method: "POST",
      headers,
      body,
    }),
  );

describe("resend-webhook", () => {
  it("no lleva cabeceras CORS (lo llama un servidor, no un navegador)", async () => {
    const preflight = await h.handler!(
      new Request("http://localhost/x", { method: "OPTIONS" }),
    );
    expect(await preflight.text()).toBe("ok");
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const response = await post();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("solo acepta POST", async () => {
    const response = await h.handler!(
      new Request("http://localhost/x", { method: "GET" }),
    );

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      ok: false,
      error: "method_not_allowed",
    });
  });

  it("sin secreto o sin clave de servicio: 503", async () => {
    h.env.delete("RESEND_WEBHOOK_SECRET");

    const response = await post();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "webhook_not_configured",
    });
  });

  it("una firma que no vale: 401, sin tocar la base", async () => {
    const headers = { ...signed(), "svix-signature": "v1,AAAA" };

    const response = await post(BODY, headers);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      error: "invalid_signature",
    });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("un cuerpo alterado tras firmarse: 401", async () => {
    const response = await post(`${BODY} `, signed(BODY));

    expect(response.status).toBe(401);
  });

  it("firmado pero que no es JSON: 400 invalid_json", async () => {
    const body = "esto no es json";

    const response = await post(body, signed(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "invalid_json" });
  });

  it("un evento válido se persiste con su svix-id y contesta recorded", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, recorded: true });
    expect(h.rpc).toHaveBeenCalledWith("record_email_event", {
      p_svix_id: "msg_test_1",
      p_event_type: "email.bounced",
      p_resend_id: "re_abc123",
      p_payload: JSON.parse(BODY),
    });
  });

  it("un duplicado contesta recorded:false", async () => {
    h.rpc.mockResolvedValue({ data: false, error: null });

    expect(await (await post()).json()).toEqual({ ok: true, recorded: false });
  });

  it("un fallo de la base: 500 persist_failed", async () => {
    h.rpc.mockResolvedValue({
      data: null,
      error: { code: "57014", message: `evento de ${EMAIL}` },
    });

    const response = await post();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: "persist_failed",
    });
    expect(lines.join("\n")).not.toContain(EMAIL);
  });

  it("los logs no llevan el destinatario ni el payload", async () => {
    await post();

    expect(lines.join("\n")).not.toContain(EMAIL);
    expect(lines.join("\n")).not.toContain("re_abc123");
    expect(JSON.parse(lines[0])).toMatchObject({
      fn: "resend-webhook",
      event: "event.recorded",
      event_type: "email.bounced",
      svix_id: "msg_test_1",
    });
  });
});
