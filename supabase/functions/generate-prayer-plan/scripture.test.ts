import { describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "npm:@supabase/supabase-js@^2.58.0";

import type { GeneratedDay } from "./schema.ts";
import { resolveDays, ScriptureLookupError, unresolved } from "./scripture.ts";

const day = (ref: string, n = 1): GeneratedDay => ({
  day_number: n,
  title: `Día ${n}`,
  scripture_ref: ref,
  interpretation: "i",
  daily_action: "a",
  prayer_body: "p",
  intercessor_prayer: "ip",
});

/** Un cliente cuyo `rpc` contesta según la referencia pedida. */
const clientFor = (
  answers: Record<
    string,
    | { data: unknown; error: null }
    | { data: null; error: { code?: string; message: string } }
    | (() => { data: unknown; error: unknown })
  >,
) => {
  const rpc = vi.fn(async (_name: string, args: { p_ref: string }) => {
    const answer = answers[args.p_ref];
    return typeof answer === "function" ? answer() : answer;
  });

  return { client: { rpc } as unknown as SupabaseClient, rpc };
};

const found = (canonical: string, text: string) => ({
  data: [{ canonical_ref: canonical, text }],
  error: null,
});

describe("resolveDays", () => {
  it("devuelve el texto y la referencia canónica de la tabla", async () => {
    const { client } = clientFor({
      "Juan 14:27": found("Juan 14:27", "La paz os dejo..."),
    });

    const [resolved] = await resolveDays(client, [day("Juan 14:27")]);

    expect(resolved).toMatchObject({
      canonical_ref: "Juan 14:27",
      scripture_text: "La paz os dejo...",
    });
  });

  it("una referencia que no existe queda con nulos, sin texto del modelo", async () => {
    const { client } = clientFor({
      "Inventado 99:99": { data: [], error: null },
    });

    const days = await resolveDays(client, [day("Inventado 99:99")]);

    expect(days[0]).toMatchObject({
      canonical_ref: null,
      scripture_text: null,
    });
    expect(unresolved(days)).toHaveLength(1);
  });

  it("un fallo pasajero de la búsqueda se repite una vez y sigue", async () => {
    let calls = 0;
    const { client, rpc } = clientFor({
      "Salmos 23:1": () => {
        calls += 1;
        return calls === 1
          ? { data: null, error: { code: "57014", message: "timeout" } }
          : found("Salmos 23:1", "Jehová es mi pastor");
      },
    });

    const [resolved] = await resolveDays(client, [day("Salmos 23:1")]);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(resolved.scripture_text).toBe("Jehová es mi pastor");
  });

  it("si la búsqueda sigue fallando, lanza en vez de dar la referencia por inexistente", async () => {
    const { client, rpc } = clientFor({
      "Salmos 23:1": { data: null, error: { code: "57014", message: "boom" } },
      "Juan 14:27": found("Juan 14:27", "La paz os dejo..."),
    });

    const attempt = resolveDays(client, [
      day("Salmos 23:1"),
      day("Juan 14:27", 2),
    ]);

    await expect(attempt).rejects.toBeInstanceOf(ScriptureLookupError);
    await expect(attempt).rejects.toMatchObject({ failed: 1, code: "57014" });
    // Un intento y su repetición para la que falla; uno para la que no.
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("el error no arrastra la referencia ni el mensaje", async () => {
    const { client } = clientFor({
      "Texto de oración como referencia": {
        data: null,
        error: {
          code: "22P02",
          message: "invalid input: Señor, sostén a mi madre",
        },
      },
    });

    const error = (await resolveDays(client, [
      day("Texto de oración como referencia"),
    ]).then(
      () => {
        throw new Error("debía fallar");
      },
      (caught: unknown) => caught,
    )) as ScriptureLookupError;

    expect(error.message).not.toContain("madre");
    expect(error.message).not.toContain("oración");
    expect(JSON.stringify({ ...error })).not.toContain("madre");
  });
});
