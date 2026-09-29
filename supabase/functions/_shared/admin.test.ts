import { beforeEach, describe, expect, it, vi } from "vitest";

// El especificador `npm:` solo lo resuelve Deno; aquí lo sustituye un doble.
const createClient = vi.hoisted(() => vi.fn());

vi.mock("npm:@supabase/supabase-js@^2.58.0", () => ({ createClient }));

import { createAdminClient } from "./admin.ts";

describe("createAdminClient", () => {
  beforeEach(() => {
    createClient.mockReset();
  });

  it("apaga la sesión persistida y el refresco automático", () => {
    createClient.mockReturnValue({ marker: "client" });

    createAdminClient("http://kong:8000", "service-key");

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      "http://kong:8000",
      "service-key",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  });

  it("devuelve el cliente tal cual lo crea supabase-js", () => {
    const client = { marker: "client" };
    createClient.mockReturnValue(client);

    expect(createAdminClient("https://x.supabase.co", "k")).toBe(client);
  });
});
