import { describe, expect, it } from "vitest";

import {
  CHUNK_BYTES,
  createSecureSessionStorage,
  type KeyValueStorage,
  type SecureStoreLike,
  secureKeyFor,
  splitIntoChunks,
} from "./secureSessionStorage";

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

type Op = "get" | "set" | "delete";

/**
 * Un SecureStore en memoria que se comporta como el de verdad en lo que
 * importa aquí: rechaza claves fuera de `[A-Za-z0-9._-]` y valores de más de
 * 2048 bytes (el de verdad solo avisa; aquí falla, para que un trozo de más
 * no pase desapercibido). `failWhen` inyecta fallos por operación y clave.
 */
const createFakeSecureStore = () => {
  const data = new Map<string, string>();
  const calls: { op: Op; key: string }[] = [];
  let failWhen: (op: Op, key: string) => boolean = () => false;

  const check = (op: Op, key: string) => {
    calls.push({ op, key });
    if (!/^[\w.-]+$/.test(key)) throw new Error(`invalid key ${key}`);
    if (failWhen(op, key)) throw new Error(`keystore ${op} failed`);
  };

  const store: SecureStoreLike = {
    getItemAsync: async (key) => {
      check("get", key);
      return data.get(key) ?? null;
    },
    setItemAsync: async (key, value) => {
      check("set", key);
      if (utf8Bytes(value) > 2048) throw new Error("value too large");
      data.set(key, value);
    },
    deleteItemAsync: async (key) => {
      check("delete", key);
      data.delete(key);
    },
  };

  return {
    store,
    data,
    calls,
    failWhen: (predicate: (op: Op, key: string) => boolean) => {
      failWhen = predicate;
    },
  };
};

const createFakeAsyncStorage = () => {
  const data = new Map<string, string>();
  let failing = false;

  const storage: KeyValueStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      if (failing) throw new Error("disk full");
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };

  return {
    storage,
    data,
    setFailing: (value: boolean) => {
      failing = value;
    },
  };
};

const KEY = "sb-127-auth-token";

/** Una sesión con la forma y el peso de una real, tildes y emoji incluidos. */
const fakeSession = (seed = "a") =>
  JSON.stringify({
    access_token: `eyJ${seed.repeat(900)}`,
    refresh_token: `r-${seed}`,
    user: {
      id: "11111111-1111-1111-1111-111111111111",
      user_metadata: { display_name: "María José Núñez 🙏" },
      identities: Array.from({ length: 3 }, (_, i) => ({
        id: `${seed}-${i}`,
        identity_data: { email: `maria${i}@ejemplo.es`, bio: "ñ".repeat(400) },
      })),
    },
  });

const setup = () => {
  const secure = createFakeSecureStore();
  const legacy = createFakeAsyncStorage();
  const errors: string[] = [];
  const make = () =>
    createSecureSessionStorage({
      secure: secure.store,
      legacy: legacy.storage,
      onError: (_error, operation) => errors.push(operation),
    });

  return { secure, legacy, errors, storage: make(), restart: make };
};

describe("splitIntoChunks", () => {
  it("cuts by UTF-8 bytes and never inside a character", () => {
    const value = `${"é".repeat(1000)}${"🙏".repeat(500)}${"a".repeat(3000)}`;
    const chunks = splitIntoChunks(value);

    expect(chunks.join("")).toBe(value);
    for (const chunk of chunks) {
      expect(utf8Bytes(chunk)).toBeLessThanOrEqual(CHUNK_BYTES);
      // Un surrogate suelto al principio o al final sería un emoji partido.
      expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
    }
  });

  it("is zero chunks for an empty value", () => {
    expect(splitIntoChunks("")).toEqual([]);
  });
});

describe("secureKeyFor", () => {
  it("leaves a key SecureStore accepts untouched", () => {
    expect(secureKeyFor(KEY)).toBe(KEY);
  });

  it("sanitizes other keys without two of them colliding", () => {
    const a = secureKeyFor("sb:mi clave/1");
    const b = secureKeyFor("sb;mi clave/1");

    expect(a).toMatch(/^[\w.-]+$/);
    expect(b).toMatch(/^[\w.-]+$/);
    expect(a).not.toBe(b);
  });
});

describe("createSecureSessionStorage", () => {
  it("keeps a real-sized session in the keychain, in chunks, and nowhere else", async () => {
    const { secure, legacy, storage, restart } = setup();
    const session = fakeSession();

    expect(utf8Bytes(session)).toBeGreaterThan(2048);

    await storage.setItem(KEY, session);

    expect(legacy.data.size).toBe(0);
    expect(secure.data.has(`${KEY}.manifest`)).toBe(true);
    expect(secure.data.size).toBeGreaterThan(2);
    // Tras reiniciar (sin la caché en memoria) se lee entera del llavero.
    expect(await restart().getItem(KEY)).toBe(session);
  });

  it("leaves no orphan chunks behind when a shorter value replaces a longer one", async () => {
    const { secure, storage, restart } = setup();

    await storage.setItem(KEY, fakeSession("a"));
    await storage.setItem(KEY, '{"short":true}');

    expect([...secure.data.keys()].sort()).toEqual(
      [`${KEY}.manifest`, `${KEY}.b.0`].sort(),
    );
    expect(await restart().getItem(KEY)).toBe('{"short":true}');
  });

  it("migrates an old AsyncStorage session on first read", async () => {
    const { secure, legacy, storage, restart } = setup();
    const session = fakeSession();

    legacy.data.set(KEY, session);

    expect(await storage.getItem(KEY)).toBe(session);
    expect(legacy.data.has(KEY)).toBe(false);
    expect(secure.data.has(`${KEY}.manifest`)).toBe(true);
    expect(await restart().getItem(KEY)).toBe(session);
  });

  it("keeps the old session in AsyncStorage when the migration cannot write", async () => {
    const { secure, legacy, storage, errors } = setup();
    const session = fakeSession();

    legacy.data.set(KEY, session);
    secure.failWhen((op) => op === "set");

    expect(await storage.getItem(KEY)).toBe(session);
    expect(legacy.data.get(KEY)).toBe(session);
    expect(errors).toContain("migrate");
  });

  it("falls back to AsyncStorage when the keychain cannot be read, and retries next time", async () => {
    const { secure, legacy, storage } = setup();

    legacy.data.set(KEY, "legacy-value");
    secure.failWhen((op) => op === "get");

    expect(await storage.getItem(KEY)).toBe("legacy-value");

    // Lo que salió de un llavero caído no se cachea: vuelve a intentarlo.
    secure.failWhen(() => false);
    expect(await storage.getItem(KEY)).toBe("legacy-value");
    expect(secure.data.has(`${KEY}.manifest`)).toBe(true);
    expect(legacy.data.has(KEY)).toBe(false);
  });

  it("does not lose the new session when a write fails halfway", async () => {
    const { secure, legacy, storage, restart, errors } = setup();

    await storage.setItem(KEY, fakeSession("a"));

    // El Keystore falla en el segundo trozo de la escritura siguiente.
    secure.failWhen((op, key) => op === "set" && key.endsWith(".1"));
    await storage.setItem(KEY, fakeSession("b"));
    secure.failWhen(() => false);

    expect(errors).toContain("write");
    expect(legacy.data.get(KEY)).toBe(fakeSession("b"));
    // La copia vieja del llavero se retiró: no puede leerse antes que la nueva.
    expect(secure.data.has(`${KEY}.manifest`)).toBe(false);
    expect(await restart().getItem(KEY)).toBe(fakeSession("b"));
  });

  it("keeps the previous value intact if the process dies before the manifest is written", async () => {
    const { secure, legacy, storage, restart } = setup();

    await storage.setItem(KEY, fakeSession("a"));

    // Muere justo antes del manifiesto, sin reserva a la que caer.
    secure.failWhen((op, key) => op === "set" && key.endsWith(".manifest"));
    legacy.setFailing(true);
    await expect(storage.setItem(KEY, fakeSession("b"))).rejects.toThrow();
    secure.failWhen(() => false);
    legacy.setFailing(false);

    expect(await restart().getItem(KEY)).toBe(fakeSession("a"));

    // Y la escritura siguiente limpia los trozos que dejó el corte.
    const next = restart();
    await next.setItem(KEY, "{}");
    expect(
      [...secure.data.keys()].filter((k) => k !== `${KEY}.manifest`),
    ).toHaveLength(1);
  });

  it("removes every trace on sign-out, from both stores", async () => {
    const { secure, legacy, storage, restart } = setup();

    await storage.setItem(KEY, fakeSession());
    legacy.data.set(KEY, "stale");
    await storage.removeItem(KEY);

    expect(secure.data.size).toBe(0);
    expect(legacy.data.size).toBe(0);
    expect(await storage.getItem(KEY)).toBeNull();
    expect(await restart().getItem(KEY)).toBeNull();
  });

  it("never throws on sign-out because of the keychain", async () => {
    const { secure, legacy, storage, errors } = setup();

    legacy.data.set(KEY, "legacy-value");
    secure.failWhen((op) => op === "delete");

    await expect(storage.removeItem(KEY)).resolves.toBeUndefined();
    expect(legacy.data.has(KEY)).toBe(false);
    expect(errors).toContain("remove");
  });

  it("stores an impossible (>1 MB) value in AsyncStorage instead of the keychain", async () => {
    const { secure, legacy, storage, restart } = setup();
    const huge = "x".repeat(1_100_000);

    await storage.setItem(KEY, fakeSession());
    await storage.setItem(KEY, huge);

    expect(legacy.data.get(KEY)).toBe(huge);
    // Lo anterior del llavero no puede quedarse haciéndole sombra.
    expect(secure.data.size).toBe(0);
    expect(await restart().getItem(KEY)).toBe(huge);
  });

  it("works with keys SecureStore would reject", async () => {
    const { secure, storage, restart } = setup();
    const key = "sb:clave con espacios/y barra";

    await storage.setItem(key, fakeSession());

    for (const stored of secure.data.keys()) {
      expect(stored).toMatch(/^[\w.-]+$/);
    }
    expect(await restart().getItem(key)).toBe(fakeSession());
  });

  it("treats tampered chunks as no session and cleans them up", async () => {
    const { secure, storage, restart, errors } = setup();

    await storage.setItem(KEY, fakeSession());
    secure.data.set(`${KEY}.a.1`, "manipulado");

    expect(await restart().getItem(KEY)).toBeNull();
    expect(errors).toContain("read");
    expect(secure.data.size).toBe(0);
  });

  it("serializes concurrent writes of the same key", async () => {
    const { storage, restart } = setup();

    await Promise.all([
      storage.setItem(KEY, fakeSession("a")),
      storage.setItem(KEY, fakeSession("b")),
      storage.setItem(KEY, fakeSession("c")),
    ]);

    expect(await storage.getItem(KEY)).toBe(fakeSession("c"));
    expect(await restart().getItem(KEY)).toBe(fakeSession("c"));
  });

  it("reads the keychain once and then serves the session from memory", async () => {
    const { secure, storage, restart } = setup();

    await storage.setItem(KEY, fakeSession());
    const fresh = restart();

    await fresh.getItem(KEY);
    const readsAfterFirst = secure.calls.filter((c) => c.op === "get").length;
    await fresh.getItem(KEY);
    await fresh.getItem(KEY);

    expect(secure.calls.filter((c) => c.op === "get")).toHaveLength(
      readsAfterFirst,
    );
  });

  it("does not let a broken reporter break storage", async () => {
    const secure = createFakeSecureStore();
    const legacy = createFakeAsyncStorage();
    const storage = createSecureSessionStorage({
      secure: secure.store,
      legacy: legacy.storage,
      onError: () => {
        throw new Error("reporter down");
      },
    });

    secure.failWhen(() => true);

    await storage.setItem(KEY, "v");
    expect(await storage.getItem(KEY)).toBe("v");
  });
});
