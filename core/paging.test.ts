import { describe, expect, it } from "vitest";

import { flattenUnique, nextPageCursor, PAGE_SIZE } from "./paging";

describe("nextPageCursor", () => {
  const row = (ts: string, id = ts) => ({ created_at: ts, id });

  it("devuelve undefined cuando la página está incompleta (menos de PAGE_SIZE)", () => {
    const page = Array.from({ length: PAGE_SIZE - 1 }, (_, i) =>
      row(`2025-01-01T00:00:${String(i).padStart(2, "0")}`),
    );

    expect(nextPageCursor(page)).toBeUndefined();
  });

  it("devuelve undefined cuando la página está vacía", () => {
    expect(nextPageCursor([])).toBeUndefined();
  });

  it("devuelve la fecha y el id de la última fila cuando la página está llena", () => {
    const lastTs = "2025-06-15T23:59:59";
    const page = Array.from({ length: PAGE_SIZE }, (_, i) =>
      row(`2025-01-01T00:00:${String(i).padStart(2, "0")}`),
    );
    // Reemplazar la última para tener una fila conocida
    page[PAGE_SIZE - 1] = row(lastTs, "ultima");

    expect(nextPageCursor(page)).toEqual({ created_at: lastTs, id: "ultima" });
  });

  it("con dos filas en el mismo instante, el id es lo que las distingue", () => {
    const sameTs = "2025-06-15T08:00:00";
    const page = Array.from({ length: PAGE_SIZE }, (_, i) =>
      row(sameTs, `fila-${i}`),
    );

    expect(nextPageCursor(page)).toEqual({
      created_at: sameTs,
      id: `fila-${PAGE_SIZE - 1}`,
    });
  });

  it("usa cursorOf cuando la lista necesita desempatar por más campos", () => {
    const page = Array.from({ length: PAGE_SIZE }, (_, i) => ({
      created_at: "2025-06-15T08:00:00",
      id: `id-${i}`,
      kind: "plan",
    }));

    expect(
      nextPageCursor(page, (r) => ({
        created_at: r.created_at,
        id: r.id,
        kind: r.kind,
      })),
    ).toEqual({
      created_at: "2025-06-15T08:00:00",
      id: `id-${PAGE_SIZE - 1}`,
      kind: "plan",
    });
  });
});

describe("flattenUnique", () => {
  it("deduplica filas idénticas sin keyOf", () => {
    const rows = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 1, name: "a" },
    ];

    expect(flattenUnique([rows])).toEqual([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
  });

  it("deduplica por clave con keyOf aunque difieran otros campos", () => {
    const rows = [
      { id: 1, name: "a", extra: "old" },
      { id: 2, name: "b", extra: "x" },
      { id: 1, name: "a2", extra: "new" },
    ];

    expect(flattenUnique([rows], (r) => String(r.id))).toEqual([
      { id: 1, name: "a", extra: "old" },
      { id: 2, name: "b", extra: "x" },
    ]);
  });

  it("conserva el orden entre páginas", () => {
    const page1 = [{ id: 1 }, { id: 2 }];
    const page2 = [{ id: 3 }, { id: 4 }];
    const page3 = [{ id: 5 }];

    expect(flattenUnique([page1, page2, page3])).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ]);
  });

  it("mantiene la primera aparición al deduplicar entre páginas", () => {
    const page1 = [{ id: 1, version: 1 }];
    const page2 = [{ id: 1, version: 2 }];

    expect(flattenUnique([page1, page2], (r) => String(r.id))).toEqual([
      { id: 1, version: 1 },
    ]);
  });

  it("devuelve un array vacío con páginas vacías", () => {
    expect(flattenUnique([[], []])).toEqual([]);
  });

  it("mantiene el orden entre páginas con keyOf", () => {
    const page1 = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ];
    const page2 = [
      { id: 2, name: "b" },
      { id: 3, name: "c" },
    ];

    expect(flattenUnique([page1, page2], (r) => String(r.id))).toEqual([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 3, name: "c" },
    ]);
  });
});
