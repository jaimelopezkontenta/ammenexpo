import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { qk } from "@/core/query/keys";

import { fetchMessagePage, refreshNewestMessages } from "./chat";
import type { ChatMessage, MessagePage } from "./chatPages";

/**
 * Sin base: un cliente de Supabase de mentira que apunta lo que se le pide.
 * Lo que sí se comprueba es la forma de la consulta (filtro, orden, cursor) y
 * qué hace la caché con la respuesta. Que PostgREST la acepte tal cual pide
 * una base de verdad.
 */
const fake = vi.hoisted(() => {
  const calls: [string, unknown[]][] = [];
  const state: { result: { data: unknown; error: unknown } } = {
    result: { data: [], error: null },
  };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(state.result).then(resolve, reject);

  const supabase = {
    from: (...args: unknown[]) => {
      calls.push(["from", args]);
      return builder;
    },
  };

  return { calls, state, supabase };
});

vi.mock("@/utils/supabase", () => ({ supabase: fake.supabase }));

/** Una fila tal como la devuelve la consulta (con el perfil embebido). */
const raw = (n: number, sender = "u2") => ({
  id: `m${String(n).padStart(3, "0")}`,
  sender_id: sender,
  body: `mensaje ${n}`,
  created_at: `2026-09-29T08:00:${String(n).padStart(2, "0")}+00:00`,
  sender: { display_name: "Ana", avatar_url: null },
  conversations: { group_id: "c1" },
});

const message = (n: number, sender = "u2"): ChatMessage => ({
  id: `m${String(n).padStart(3, "0")}`,
  sender_id: sender,
  sender_name: "Ana",
  sender_avatar_url: null,
  body: `mensaje ${n}`,
  created_at: `2026-09-29T08:00:${String(n).padStart(2, "0")}+00:00`,
  is_mine: sender === "u1",
});

const called = (method: string) =>
  fake.calls.filter(([name]) => name === method).map(([, args]) => args);

beforeEach(() => {
  fake.calls.length = 0;
  fake.state.result = { data: [], error: null };
});

describe("fetchMessagePage", () => {
  it("la primera página: los más nuevos del círculo, sin cursor", async () => {
    fake.state.result = { data: [raw(2, "u1"), raw(1)], error: null };

    const page = await fetchMessagePage("c1", "u1", null);

    expect(called("from")).toEqual([["messages"]]);
    expect(called("eq")).toEqual([["conversations.group_id", "c1"]]);
    expect(called("or")).toEqual([]);
    expect(called("order")).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(called("limit")).toEqual([[50]]);
    expect(page).toEqual({ rows: [message(2, "u1"), message(1)], more: false });
  });

  it("las siguientes siguen desde el cursor compuesto", async () => {
    await fetchMessagePage("c1", "u1", {
      created_at: "2026-09-29T08:00:05+00:00",
      id: "m005",
    });

    expect(called("or")).toEqual([
      [
        "created_at.lt.2026-09-29T08:00:05+00:00,and(created_at.eq.2026-09-29T08:00:05+00:00,id.lt.m005)",
      ],
    ]);
  });

  it("una página llena dice que hay más", async () => {
    fake.state.result = {
      data: Array.from({ length: 50 }, (_, i) => raw(50 - i)),
      error: null,
    };

    expect((await fetchMessagePage("c1", "u1", null)).more).toBe(true);
  });

  it("el error de la base sube tal cual", async () => {
    const error = { message: "boom" };
    fake.state.result = { data: null, error };

    await expect(fetchMessagePage("c1", "u1", null)).rejects.toBe(error);
  });
});

describe("refreshNewestMessages", () => {
  const key = qk.circleMessages("c1");

  it("mezcla la página nueva en la caché sin volver a pedir las viejas", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    client.setQueryData(key, {
      pages: [{ rows: [message(2), message(1)], more: false }],
      pageParams: [null],
    });
    fake.state.result = { data: [raw(3, "u1"), raw(2), raw(1)], error: null };

    await refreshNewestMessages(client, "c1", "u1");

    const data = client.getQueryData<{ pages: MessagePage[] }>(key);
    expect(data?.pages.flatMap((page) => page.rows)).toEqual([
      message(3, "u1"),
      message(2),
      message(1),
    ]);
    expect(called("from")).toHaveLength(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("sin nada en caché, deja que la query cargue sola", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    await refreshNewestMessages(client, "c1", "u1");

    expect(called("from")).toHaveLength(0);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });

  it("si la petición falla, vuelve a lo de siempre: invalidar", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    client.setQueryData(key, {
      pages: [{ rows: [message(1)], more: false }],
      pageParams: [null],
    });
    fake.state.result = { data: null, error: { message: "offline" } };

    await refreshNewestMessages(client, "c1", "u1");

    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
    expect(
      client.getQueryData<{ pages: MessagePage[] }>(key)?.pages[0]?.rows,
    ).toEqual([message(1)]);
  });
});
