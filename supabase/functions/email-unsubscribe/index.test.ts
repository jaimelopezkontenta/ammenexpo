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

const TOKEN = "cccccccccccccccccccccccccccccccc.deadbeefdeadbeef";

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
  h.env.set("EMAIL_APP_ORIGIN", "https://app.example.test/");

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

const call = (method: string, query = `?t=${TOKEN}`) =>
  h.handler!(
    new Request(`http://localhost/functions/v1/email-unsubscribe${query}`, {
      method,
    }),
  );

describe("email-unsubscribe", () => {
  it("el preflight admite GET además de POST", async () => {
    const response = await call("OPTIONS", "");

    expect(await response.text()).toBe("ok");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, POST, OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, x-client-info, apikey, content-type",
    );
  });

  it("sin token: 400 missing_token", async () => {
    const response = await call("POST", "");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "missing_token",
    });
  });

  it("GET redirige a la pantalla de correo con el token", async () => {
    const response = await call("GET");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `https://app.example.test/correo?t=${encodeURIComponent(TOKEN)}`,
    );
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("otro método: 405", async () => {
    const response = await call("PUT");

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      ok: false,
      error: "method_not_allowed",
    });
  });

  it("POST da de baja con el token y contesta ok", async () => {
    const response = await call("POST");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.rpc).toHaveBeenCalledWith("unsubscribe_email_one_click", {
      p_token: TOKEN,
    });
  });

  it("un token que no da de baja a nadie contesta ok:false", async () => {
    h.rpc.mockResolvedValue({ data: false, error: null });

    expect(await (await call("POST")).json()).toEqual({ ok: false });
  });

  it("sin la clave de servicio: 503", async () => {
    h.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    const response = await call("POST");

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "not_configured",
    });
  });

  it("un fallo de la base: 500, y el token no llega al log", async () => {
    h.rpc.mockResolvedValue({
      data: null,
      error: { code: "57014", message: `token ${TOKEN}` },
    });

    const response = await call("POST");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: "unsubscribe_failed",
    });
    expect(lines.join("\n")).not.toContain(TOKEN);
    expect(lines.join("\n")).not.toContain("deadbeef");
  });

  it("una baja correcta se registra sin el token", async () => {
    await call("POST");

    expect(lines.join("\n")).not.toContain(TOKEN);
    expect(JSON.parse(lines[0])).toMatchObject({
      fn: "email-unsubscribe",
      event: "unsubscribe.done",
      applied: true,
    });
  });
});
