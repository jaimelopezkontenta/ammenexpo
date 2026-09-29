import { beforeEach, describe, expect, it, vi } from "vitest";

import { BIBLE_VERSION_STORAGE_KEY } from "./versionChoice";

const storage = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));

/**
 * El almacén es estado de módulo: cada prueba importa uno recién hecho, como
 * un arranque de la app.
 */
const freshStore = async () => {
  vi.resetModules();
  return import("./useBibleVersion");
};

/** Deja correr la lectura del almacén, que son unas pocas promesas. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the bible version store", () => {
  beforeEach(() => {
    storage.store.clear();
    storage.getItem.mockClear();
    storage.setItem.mockClear();
  });

  it("is not ready, and has no choice, until the storage is read", async () => {
    const store = await freshStore();

    expect(store.getBibleVersionChoice()).toEqual({
      choice: null,
      ready: false,
    });
  });

  it("reads the stored choice once someone subscribes, and tells them", async () => {
    storage.store.set(BIBLE_VERSION_STORAGE_KEY, "web");
    const store = await freshStore();
    const listener = vi.fn();

    store.subscribeBibleVersion(listener);
    await settle();

    expect(store.getBibleVersionChoice()).toEqual({
      choice: "web",
      ready: true,
    });
    expect(listener).toHaveBeenCalled();
  });

  it("reads the storage once, however many screens subscribe", async () => {
    const store = await freshStore();

    store.subscribeBibleVersion(() => {});
    store.subscribeBibleVersion(() => {});
    await settle();

    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it("ignores a stored value it does not know, and falls back to the language", async () => {
    storage.store.set(BIBLE_VERSION_STORAGE_KEY, "kjv");
    const store = await freshStore();

    store.subscribeBibleVersion(() => {});
    await settle();

    expect(store.getBibleVersionChoice()).toEqual({
      choice: null,
      ready: true,
    });
  });

  // Modo privado, disco lleno, permisos: leer la Biblia no puede depender de
  // que el almacén funcione.
  it("survives a storage that rejects", async () => {
    storage.getItem.mockRejectedValueOnce(new Error("denied"));
    const store = await freshStore();

    store.subscribeBibleVersion(() => {});
    await settle();

    expect(store.getBibleVersionChoice()).toEqual({
      choice: null,
      ready: true,
    });
  });

  it("survives a storage that throws synchronously", async () => {
    storage.getItem.mockImplementationOnce(() => {
      throw new Error("SecurityError");
    });
    const store = await freshStore();

    store.subscribeBibleVersion(() => {});
    await settle();

    expect(store.getBibleVersionChoice()).toEqual({
      choice: null,
      ready: true,
    });
  });

  it("a choice made while the storage is being read wins over the stored one", async () => {
    storage.store.set(BIBLE_VERSION_STORAGE_KEY, "rvr1909");
    const store = await freshStore();

    store.subscribeBibleVersion(() => {});
    store.setBibleVersion("web");
    await settle();

    expect(store.getBibleVersionChoice()).toEqual({
      choice: "web",
      ready: true,
    });
  });

  it("a choice reaches every subscriber and is remembered on the device", async () => {
    const store = await freshStore();
    const reader = vi.fn();
    const search = vi.fn();

    store.subscribeBibleVersion(reader);
    store.subscribeBibleVersion(search);
    await settle();
    reader.mockClear();
    search.mockClear();

    store.setBibleVersion("web");
    await settle();

    expect(reader).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(storage.store.get(BIBLE_VERSION_STORAGE_KEY)).toBe("web");
  });

  it("a storage that cannot write does not undo the choice", async () => {
    storage.setItem.mockRejectedValueOnce(new Error("quota"));
    const store = await freshStore();

    store.setBibleVersion("web");
    await settle();

    expect(store.getBibleVersionChoice()).toEqual({
      choice: "web",
      ready: true,
    });
  });

  it("an unsubscribed screen stops hearing about changes", async () => {
    const store = await freshStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribeBibleVersion(listener);
    await settle();
    unsubscribe();
    listener.mockClear();

    store.setBibleVersion("web");

    expect(listener).not.toHaveBeenCalled();
  });
});
