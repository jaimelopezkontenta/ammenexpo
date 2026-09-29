import { describe, expect, it } from "vitest";

import {
  bubbleOpenings,
  type ChatMessage,
  compareNewestFirst,
  flattenMessages,
  instantOf,
  mergeMessages,
  type MessagePage,
  nextMessageCursor,
  olderThanFilter,
  paginateMessages,
  withNewestPage,
} from "./chatPages";

/** Un mensaje en el minuto `n` de la mañana; `id` desempata el mismo instante. */
const msg = (
  n: number,
  id = `m${String(n).padStart(3, "0")}`,
): ChatMessage => ({
  id,
  sender_id: "u1",
  sender_name: "Ana",
  sender_avatar_url: null,
  body: `mensaje ${n}`,
  created_at: `2026-09-29T08:${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}.000123+00:00`,
  is_mine: false,
});

/** Del más nuevo al más viejo, como llega de la base y se pinta. */
const range = (from: number, to: number): ChatMessage[] => {
  const rows: ChatMessage[] = [];
  for (let n = from; n >= to; n--) rows.push(msg(n));
  return rows;
};

const ids = (rows: ChatMessage[]) => rows.map((row) => row.id);

describe("instantOf / compareNewestFirst", () => {
  it("ordena por microsegundos aunque Postgres recorte los ceros del final", () => {
    const a = { id: "a", created_at: "2026-09-29T08:00:00.1234+00:00" };
    const b = { id: "b", created_at: "2026-09-29T08:00:00.12345+00:00" };

    // b es más nuevo (.123450 > .123400): va antes.
    expect(compareNewestFirst(b, a)).toBeLessThan(0);
    expect(compareNewestFirst(a, b)).toBeGreaterThan(0);
  });

  it("sin fracción es el segundo en punto", () => {
    expect(instantOf("2026-09-29T08:00:00+00:00")[1]).toBe(0);
    expect(
      compareNewestFirst(
        { id: "a", created_at: "2026-09-29T08:00:00.5+00:00" },
        { id: "b", created_at: "2026-09-29T08:00:00+00:00" },
      ),
    ).toBeLessThan(0);
  });

  it("entiende la zona horaria: el mismo instante escrito de dos formas", () => {
    expect(instantOf("2026-09-29T10:00:00+02:00")).toEqual(
      instantOf("2026-09-29T08:00:00Z"),
    );
  });

  it("en el mismo instante desempata por id, descendente como la consulta", () => {
    const same = "2026-09-29T08:00:00.000001+00:00";

    expect(
      compareNewestFirst(
        { id: "b", created_at: same },
        { id: "a", created_at: same },
      ),
    ).toBeLessThan(0);
    expect(
      compareNewestFirst(
        { id: "a", created_at: same },
        { id: "a", created_at: same },
      ),
    ).toBe(0);
  });
});

describe("olderThanFilter", () => {
  it("compara la pareja (created_at, id), no solo la fecha", () => {
    expect(
      olderThanFilter({
        created_at: "2026-09-29T08:00:00.123456+00:00",
        id: "abc",
      }),
    ).toBe(
      "created_at.lt.2026-09-29T08:00:00.123456+00:00,and(created_at.eq.2026-09-29T08:00:00.123456+00:00,id.lt.abc)",
    );
  });
});

describe("nextMessageCursor", () => {
  it("sigue desde el mensaje más viejo de la página", () => {
    expect(nextMessageCursor({ rows: range(9, 5), more: true })).toEqual({
      created_at: msg(5).created_at,
      id: msg(5).id,
    });
  });

  it("no sigue si la conversación ya empezó ahí", () => {
    expect(
      nextMessageCursor({ rows: range(9, 5), more: false }),
    ).toBeUndefined();
    expect(nextMessageCursor({ rows: [], more: true })).toBeUndefined();
  });
});

describe("mergeMessages — páginas viejas + lo que llega por Realtime", () => {
  it("un mensaje nuevo entra abajo del todo, sin repetir los que ya estaban", () => {
    const current = range(3, 1);
    const head: MessagePage = { rows: range(4, 1), more: false };

    const merged = mergeMessages(current, false, head);

    expect(ids(merged.rows)).toEqual(["m004", "m003", "m002", "m001"]);
    expect(merged.more).toBe(false);
  });

  it("conserva las páginas viejas ya cargadas debajo de la nueva", () => {
    // Tenías 100 mensajes en dos páginas (m100…m001) y llega m101: la página
    // nueva trae m101…m052, y lo de debajo sigue ahí tal cual.
    const current = range(100, 1);
    const head: MessagePage = { rows: range(101, 52), more: true };

    const merged = mergeMessages(current, false, head);

    expect(ids(merged.rows)).toEqual(ids(range(101, 1)));
    expect(new Set(ids(merged.rows)).size).toBe(merged.rows.length);
    expect(merged.more).toBe(false);
  });

  it("si aún quedaba historia por cargar, lo sigue diciendo", () => {
    const merged = mergeMessages(range(100, 51), true, {
      rows: range(101, 52),
      more: true,
    });

    expect(ids(merged.rows)).toEqual(ids(range(101, 51)));
    expect(merged.more).toBe(true);
  });

  it("con un hueco en medio (entraron más de una página), no finge continuidad", () => {
    // Tenías m050…m001 y han entrado cien más: la página nueva es m150…m101 y
    // entre m101 y m050 falta todo. Se descarta lo viejo; se volverá a pedir
    // al subir.
    const merged = mergeMessages(range(50, 1), false, {
      rows: range(150, 101),
      more: true,
    });

    expect(ids(merged.rows)).toEqual(ids(range(150, 101)));
    expect(merged.more).toBe(true);
  });

  it("lo que ya no se puede ver en su tramo se va (ocultado, bloqueado)", () => {
    const current = range(5, 1);
    const head: MessagePage = {
      rows: [msg(5), msg(3), msg(2), msg(1)],
      more: false,
    };

    expect(ids(mergeMessages(current, false, head).rows)).toEqual([
      "m005",
      "m003",
      "m002",
      "m001",
    ]);
  });

  it("una respuesta vieja que llega tarde no borra lo que trajo la nueva", () => {
    // Dos refrescos seguidos; el primero (sin m006) contesta el último.
    const current = range(6, 1);
    const staleHead: MessagePage = { rows: range(5, 1), more: false };

    expect(ids(mergeMessages(current, false, staleHead).rows)).toEqual(
      ids(range(6, 1)),
    );
  });

  it("dos mensajes en el mismo instante no se pierden ni se repiten", () => {
    const same = "2026-09-29T08:00:00.000001+00:00";
    const a = { ...msg(1, "aaa"), created_at: same };
    const b = { ...msg(1, "bbb"), created_at: same };
    const current = [b, a];
    const head: MessagePage = { rows: [msg(2), b, a], more: false };

    expect(ids(mergeMessages(current, false, head).rows)).toEqual([
      "m002",
      "bbb",
      "aaa",
    ]);
  });

  it("sin nada visible, la lista queda vacía y sin más", () => {
    expect(
      mergeMessages(range(3, 1), false, { rows: [], more: false }),
    ).toEqual({ rows: [], more: false });
  });

  it("sin nada en caché, la página nueva es todo lo que hay", () => {
    expect(
      mergeMessages([], false, { rows: range(3, 1), more: false }).rows,
    ).toEqual(range(3, 1));
  });
});

describe("paginateMessages", () => {
  it("reparte en páginas del tamaño de siempre, con el cursor de cada una", () => {
    const { pages, pageParams } = paginateMessages(range(5, 1), true, 2);

    expect(pages.map((page) => ids(page.rows))).toEqual([
      ["m005", "m004"],
      ["m003", "m002"],
      ["m001"],
    ]);
    expect(pages.map((page) => page.more)).toEqual([true, true, true]);
    expect(pageParams).toEqual([
      null,
      { created_at: msg(4).created_at, id: "m004" },
      { created_at: msg(2).created_at, id: "m002" },
    ]);
  });

  it("la última página dice si queda algo, aunque venga corta", () => {
    const { pages } = paginateMessages(range(3, 1), false, 2);

    expect(pages[pages.length - 1]).toEqual({ rows: [msg(1)], more: false });
    // Corta y con historia detrás: «cargar más» tiene que seguir funcionando.
    const withMore = paginateMessages(range(3, 1), true, 2).pages;
    expect(nextMessageCursor(withMore[withMore.length - 1]!)).toEqual({
      created_at: msg(1).created_at,
      id: "m001",
    });
  });

  it("sin filas deja una página vacía", () => {
    expect(paginateMessages([], false, 2)).toEqual({
      pages: [{ rows: [], more: false }],
      pageParams: [null],
    });
  });
});

describe("withNewestPage + flattenMessages", () => {
  it("la caché queda en páginas y la pantalla ve una lista sin repetidos", () => {
    const cache = {
      pages: [
        { rows: range(10, 6), more: true },
        { rows: range(5, 1), more: false },
      ],
    };

    const next = withNewestPage(cache, { rows: range(12, 8), more: true }, 5);

    expect(next.pages.map((page) => ids(page.rows))).toEqual([
      ids(range(12, 8)),
      ids(range(7, 3)),
      ids(range(2, 1)),
    ]);
    expect(next.pages[next.pages.length - 1]!.more).toBe(false);
    expect(ids(flattenMessages(next))).toEqual(ids(range(12, 1)));
  });

  it("flattenMessages no repite un mensaje que quedó en dos páginas", () => {
    expect(
      ids(
        flattenMessages({
          pages: [
            { rows: range(3, 2), more: true },
            { rows: range(2, 1), more: false },
          ],
        }),
      ),
    ).toEqual(["m003", "m002", "m001"]);
  });
});

describe("bubbleOpenings", () => {
  const at = (iso: string, sender = "u1") => ({
    created_at: iso,
    sender_id: sender,
  });

  it("el mensaje más antiguo abre día y racha", () => {
    expect(bubbleOpenings(at("2026-09-29T08:00:00"), undefined)).toEqual({
      opensDay: true,
      opensRun: true,
    });
  });

  it("mismo día y misma persona: ni separador ni cara otra vez", () => {
    expect(
      bubbleOpenings(at("2026-09-29T09:00:00"), at("2026-09-29T08:00:00")),
    ).toEqual({ opensDay: false, opensRun: false });
  });

  it("otra persona el mismo día abre racha pero no día", () => {
    expect(
      bubbleOpenings(
        at("2026-09-29T09:00:00", "u2"),
        at("2026-09-29T08:00:00", "u1"),
      ),
    ).toEqual({ opensDay: false, opensRun: true });
  });

  it("otro día abre las dos cosas aunque escriba la misma persona", () => {
    expect(
      bubbleOpenings(at("2026-09-29T09:00:00"), at("2026-09-28T09:00:00")),
    ).toEqual({ opensDay: true, opensRun: true });
  });
});
