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

const SECRET = "s3cret-enqueue";

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
  h.env.set("AMMEN_EMAIL_INVOKE_SECRET", SECRET);

  h.rpc.mockReset();
  h.rpc.mockResolvedValue({
    data: { habit: 3, drip: 1, digest: 0, winback: 2, sunset: 0 },
    error: null,
  });

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

const invoke = async (headers: Record<string, string> = {}) => {
  const response = await h.handler!(
    new Request("http://localhost/functions/v1/enqueue-emails", {
      method: "POST",
      headers: { "x-ammen-invoker": SECRET, ...headers },
    }),
  );

  return { response, body: await response.json() };
};

describe("enqueue-emails", () => {
  it("el preflight y las respuestas llevan el CORS de los drenajes", async () => {
    const preflight = await h.handler!(
      new Request("http://localhost/x", { method: "OPTIONS" }),
    );

    expect(await preflight.text()).toBe("ok");
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, x-client-info, apikey, content-type, x-ammen-invoker",
    );

    const { response } = await invoke();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("encola y devuelve los contadores tal cual", async () => {
    const { response, body } = await invoke();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      jobs: { habit: 3, drip: 1, digest: 0, winback: 2, sunset: 0 },
    });
    expect(h.rpc).toHaveBeenCalledWith("enqueue_all_email_jobs");
  });

  it("registra solo los contadores", async () => {
    await invoke({ "x-request-id": "cron-run-000789" });

    expect(JSON.parse(lines[0])).toMatchObject({
      fn: "enqueue-emails",
      request_id: "cron-run-000789",
      event: "enqueue.done",
      habit: 3,
      drip: 1,
      digest: 0,
      winback: 2,
      sunset: 0,
    });
  });

  it("un secreto equivocado: 401, sin tocar la base", async () => {
    const { response, body } = await invoke({ "x-ammen-invoker": "otro" });

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "unauthorized" });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("sin la clave de servicio: 503 not_configured", async () => {
    h.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    const { response, body } = await invoke();

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false, error: "not_configured" });
  });

  it("un fallo de la base: 500 enqueue_failed, sin su mensaje en el log", async () => {
    h.rpc.mockResolvedValue({
      data: null,
      error: { code: "57014", message: "detalle interno" },
    });

    const { response, body } = await invoke();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "enqueue_failed" });
    expect(lines.join("\n")).not.toContain("detalle interno");
    expect(JSON.parse(lines[0])).toMatchObject({ error_code: "57014" });
  });
});
