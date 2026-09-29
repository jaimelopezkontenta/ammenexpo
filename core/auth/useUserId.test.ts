import { beforeEach, describe, expect, it, vi } from "vitest";

import { MissingSessionError, useRequiredUserId, useUserId } from "./useUserId";

// `useSession` es un `useContext` y nada más: sustituido por una función que
// devuelve el estado que toque, los dos hooks se prueban llamándolos sin
// montar React (el provider de verdad importa Supabase y expo-router).
const state = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
}));

vi.mock("./SessionProvider", () => ({
  useSession: () => ({ session: state.session }),
}));

describe("useUserId", () => {
  beforeEach(() => {
    state.session = null;
  });

  it("is the signed-in user's id", () => {
    state.session = { user: { id: "user-a" } };
    expect(useUserId()).toBe("user-a");
  });

  it("is undefined without a session, as the data hooks expect", () => {
    expect(useUserId()).toBeUndefined();
  });
});

describe("useRequiredUserId", () => {
  beforeEach(() => {
    state.session = null;
  });

  it("is the id when there is a session", () => {
    state.session = { user: { id: "user-b" } };
    expect(useRequiredUserId()).toBe("user-b");
  });

  it("throws a named error instead of handing out undefined", () => {
    expect(() => useRequiredUserId()).toThrow(MissingSessionError);
  });

  it("treats an empty id as no session", () => {
    state.session = { user: { id: "" } };
    expect(() => useRequiredUserId()).toThrow(MissingSessionError);
  });
});
