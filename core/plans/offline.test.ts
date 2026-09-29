import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanDay } from "./queries";

import {
  cacheTodayDay,
  dropEntry,
  enqueuePrayed,
  flushPrayedQueue,
  isNetworkError,
  mergeQueue,
  readCachedTodayDay,
  readPrayedQueue,
  removePrayed,
  type PrayedEntry,
  type PrayedInsertFn,
} from "./offline";
import { STORAGE_KEYS, todayDayKey } from "@/core/storage/keys";

// Mock de AsyncStorage con un mapa en memoria: así los tests de la cola
// ejercitan el IO real (JSON round-trip incluido) sin tocar el storage nativo.
const storage = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getAllKeys: vi.fn(async () => [...store.keys()]),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((key) => store.delete(key));
    }),
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));

// El hook llama a supabase solo dentro de `insertPrayedLog`; mockearlo evita
// que la evaluación del módulo lea las env de Supabase (que no existen en
// vitest) o importe react-native por la puerta de `utils/supabase`.
vi.mock("../../utils/supabase", () => ({
  supabase: {},
}));

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

const entry = (dayId: string, userId: string): PrayedEntry => ({
  dayId,
  userId,
});

beforeEach(() => {
  storage.store.clear();
  storage.getItem.mockClear();
  storage.setItem.mockClear();
  storage.removeItem.mockClear();
});

describe("isNetworkError", () => {
  it("es red cuando no hay code de Postgres", () => {
    expect(isNetworkError(new Error("Network request failed"))).toBe(true);
    expect(isNetworkError({ message: "fetch failed" })).toBe(true);
    expect(isNetworkError(null)).toBe(true);
  });

  it("no es red con un code 23505 (duplicado)", () => {
    expect(isNetworkError({ code: "23505" })).toBe(false);
  });

  it("no es red con un code 42501 (RLS)", () => {
    expect(isNetworkError({ code: "42501" })).toBe(false);
  });
});

describe("mergeQueue / dropEntry", () => {
  it("mergeQueue añade y no duplica el mismo par dayId+userId", () => {
    expect(mergeQueue([], entry("d1", "u1"))).toEqual([entry("d1", "u1")]);
    expect(mergeQueue([entry("d1", "u1")], entry("d1", "u1"))).toEqual([
      entry("d1", "u1"),
    ]);
    expect(mergeQueue([entry("d1", "u1")], entry("d2", "u1"))).toEqual([
      entry("d1", "u1"),
      entry("d2", "u1"),
    ]);
  });

  it("dropEntry quita solo el par dayId+userId indicado", () => {
    const queue = [entry("d1", "u1"), entry("d1", "u2"), entry("d2", "u1")];

    expect(dropEntry(queue, "d1", "u1")).toEqual([
      entry("d1", "u2"),
      entry("d2", "u1"),
    ]);
  });
});

describe("cola offline (IO)", () => {
  it("enqueue → read → remove redondea el ciclo sin duplicar", async () => {
    await enqueuePrayed(entry("d1", "u1"));
    await enqueuePrayed(entry("d1", "u1")); // no duplica
    await enqueuePrayed(entry("d2", "u1"));

    expect(await readPrayedQueue()).toEqual([
      entry("d1", "u1"),
      entry("d2", "u1"),
    ]);

    await removePrayed("d1", "u1");

    expect(await readPrayedQueue()).toEqual([entry("d2", "u1")]);
  });

  it("readPrayedQueue devuelve [] sin clave y descarta entradas corruptas", async () => {
    expect(await readPrayedQueue()).toEqual([]);

    await storage.setItem(
      STORAGE_KEYS.prayedQueue,
      JSON.stringify([entry("d1", "u1"), { dayId: 42 }, "no-soy-un-objeto"]),
    );

    expect(await readPrayedQueue()).toEqual([entry("d1", "u1")]);
  });

  it("drena un «Ya oré» encolado con el nombre de antes de la versión", async () => {
    // La clave se llamaba `ammen.prayedQueue`: lo que quedó encolado sin red
    // antes de actualizar la app no puede perderse por el cambio de nombre.
    storage.store.set("ammen.prayedQueue", JSON.stringify([entry("d1", "u1")]));

    await flushPrayedQueue(async () => ({ error: null }));

    expect(await readPrayedQueue()).toEqual([]);
    expect(storage.store.has("ammen.prayedQueue")).toBe(false);
  });

  it("una entrada nueva no pisa la cola vieja: se suman", async () => {
    storage.store.set("ammen.prayedQueue", JSON.stringify([entry("d1", "u1")]));

    await enqueuePrayed(entry("d2", "u1"));

    expect(await readPrayedQueue()).toEqual([
      entry("d1", "u1"),
      entry("d2", "u1"),
    ]);
  });
});

describe("flushPrayedQueue", () => {
  const insertReturning =
    (result: { error: { code?: string } | null }): PrayedInsertFn =>
    async () =>
      result;

  it("23505 se quita de la cola (éxito sin encolar de nuevo)", async () => {
    await enqueuePrayed(entry("d1", "u1"));

    await flushPrayedQueue(insertReturning({ error: { code: "23505" } }));

    expect(await readPrayedQueue()).toEqual([]);
  });

  it("error de red deja el entry en la cola para el siguiente flush", async () => {
    await enqueuePrayed(entry("d1", "u1"));

    await flushPrayedQueue(insertReturning({ error: {} })); // sin code = red

    expect(await readPrayedQueue()).toEqual([entry("d1", "u1")]);
  });

  it("error definitivo (no red) se quita para no reintentar en bucle", async () => {
    await enqueuePrayed(entry("d1", "u1"));

    await flushPrayedQueue(insertReturning({ error: { code: "42501" } }));

    expect(await readPrayedQueue()).toEqual([]);
  });

  it("éxito sin error también quita el entry", async () => {
    await enqueuePrayed(entry("d1", "u1"));

    await flushPrayedQueue(insertReturning({ error: null }));

    expect(await readPrayedQueue()).toEqual([]);
  });

  it("un insert que LANZA un error de red lo deja en cola", async () => {
    await enqueuePrayed(entry("d1", "u1"));

    await flushPrayedQueue(async () => {
      throw new Error("Network request failed");
    });

    expect(await readPrayedQueue()).toEqual([entry("d1", "u1")]);
  });
});

describe("today's day cache", () => {
  const day = { id: "day-4", day_number: 4 } as unknown as PlanDay;
  const morning = new Date(2026, 8, 29, 8, 0);
  const nextMorning = new Date(2026, 8, 30, 8, 0);

  beforeEach(() => {
    storage.store.clear();
  });

  it("serves the cached day as a fallback on the same local day", async () => {
    await cacheTodayDay("plan-1", day, morning);

    expect(await readCachedTodayDay("plan-1", morning)).toEqual(day);
  });

  it("does not pass yesterday's day off as today's", async () => {
    await cacheTodayDay("plan-1", day, morning);

    expect(await readCachedTodayDay("plan-1", nextMorning)).toBeNull();
  });

  it("ignores the old undated format", async () => {
    storage.store.set(todayDayKey("plan-1"), JSON.stringify(day));

    expect(await readCachedTodayDay("plan-1", morning)).toBeNull();
  });

  // Borrarlos al cerrar sesión es de `clearUserScopedStorage`
  // (core/storage/storage.test.ts).
});
