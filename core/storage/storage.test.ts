import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS, todayDayKey } from "./keys";
import {
  clearUserScopedStorage,
  getItemMigrating,
  removeItemEverywhere,
} from "./storage";

// Un AsyncStorage falso sobre un Map: se ejercita el IO de verdad (lecturas,
// escrituras y borrados en el orden en que ocurren) sin almacén nativo.
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

beforeEach(() => {
  storage.store.clear();
  vi.clearAllMocks();
});

describe("getItemMigrating", () => {
  it("reads the current name", async () => {
    storage.store.set(STORAGE_KEYS.language, "en");

    expect(await getItemMigrating(STORAGE_KEYS.language)).toBe("en");
  });

  it("moves a value saved under the old name, once", async () => {
    storage.store.set("ammen.language", "en");

    expect(await getItemMigrating(STORAGE_KEYS.language)).toBe("en");
    expect(storage.store.get(STORAGE_KEYS.language)).toBe("en");
    expect(storage.store.has("ammen.language")).toBe(false);

    // La segunda lectura ya no mira el nombre viejo.
    storage.getItem.mockClear();
    expect(await getItemMigrating(STORAGE_KEYS.language)).toBe("en");
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it("prefers the current name over a stale old one", async () => {
    storage.store.set(STORAGE_KEYS.readerFont, "lg");
    storage.store.set("ammen:reader-font", "sm");

    expect(await getItemMigrating(STORAGE_KEYS.readerFont)).toBe("lg");
  });

  it("is null when neither name holds anything", async () => {
    expect(await getItemMigrating(STORAGE_KEYS.prayedQueue)).toBeNull();
  });

  it("still returns the old value when moving it fails", async () => {
    storage.store.set("ammen.signupSource", "invitacion");
    storage.setItem.mockRejectedValueOnce(new Error("quota"));

    expect(await getItemMigrating(STORAGE_KEYS.signupSource)).toBe(
      "invitacion",
    );
    // Sigue en el nombre viejo: la próxima lectura lo reintenta.
    expect(storage.store.get("ammen.signupSource")).toBe("invitacion");
  });

  it("propagates a blocked storage like a plain getItem would", async () => {
    storage.getItem.mockRejectedValueOnce(new Error("SecurityError"));

    await expect(getItemMigrating(STORAGE_KEYS.theme)).rejects.toThrow(
      "SecurityError",
    );
  });
});

describe("removeItemEverywhere", () => {
  it("removes the key and every old name it had", async () => {
    storage.store.set(STORAGE_KEYS.pendingShareToken, "tok-new");
    storage.store.set("ammen.pendingShareToken", "tok-old");
    storage.store.set(STORAGE_KEYS.theme, "dark");

    await removeItemEverywhere(STORAGE_KEYS.pendingShareToken);

    expect([...storage.store.keys()]).toEqual([STORAGE_KEYS.theme]);
  });
});

describe("clearUserScopedStorage", () => {
  const seedDevice = () => {
    // Del dispositivo y de quien aún no tiene cuenta: nada de esto se borra.
    storage.store.set(STORAGE_KEYS.theme, "dark");
    storage.store.set(STORAGE_KEYS.bibleVersion, "kjv");
    storage.store.set(STORAGE_KEYS.language, "en");
    storage.store.set(STORAGE_KEYS.readerFont, "lg");
    storage.store.set(STORAGE_KEYS.pendingShareToken, "tok-1");
    storage.store.set(STORAGE_KEYS.pendingInviteCode, "code-1");
    storage.store.set(STORAGE_KEYS.signupSource, "invitacion");
    storage.store.set(STORAGE_KEYS.prayedQueue, "[]");
    // Lo que no es de la app (la sesión de Supabase en web) tampoco.
    storage.store.set("sb-127-auth-token", "{}");
  };

  it("clears the cached days — they carry the day's prayer text", async () => {
    seedDevice();
    storage.store.set(todayDayKey("plan-1"), "{}");
    storage.store.set(todayDayKey("plan-2"), "{}");

    await clearUserScopedStorage();

    expect(storage.store.has(todayDayKey("plan-1"))).toBe(false);
    expect(storage.store.has(todayDayKey("plan-2"))).toBe(false);
  });

  it("keeps the device preferences and what waits for the next sign-up", async () => {
    seedDevice();
    const before = [...storage.store.entries()];
    storage.store.set(todayDayKey("plan-1"), "{}");

    await clearUserScopedStorage();

    expect([...storage.store.entries()]).toEqual(before);
  });

  it("does nothing when there is nothing of anyone's", async () => {
    seedDevice();

    await clearUserScopedStorage();

    expect(storage.multiRemove).not.toHaveBeenCalled();
  });

  it("never throws: signing out cannot fail on a blocked storage", async () => {
    storage.getAllKeys.mockRejectedValueOnce(new Error("SecurityError"));

    await expect(clearUserScopedStorage()).resolves.toBeUndefined();
  });
});
