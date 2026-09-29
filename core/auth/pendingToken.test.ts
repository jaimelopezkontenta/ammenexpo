import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  redeemPendingTokens,
  redeemShareToken,
  rememberShareToken,
} from "./pendingToken";

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
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((key) => store.delete(key));
    }),
  };
});

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));

vi.mock("@/utils/supabase", () => ({ supabase: { rpc } }));

const SHARE_KEY = "ammen.pendingShareToken";

describe("share token redemption", () => {
  beforeEach(() => {
    storage.store.clear();
    rpc.mockReset();
  });

  it("the next launch does not redeem again a token the preview page already redeemed", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, plan_id: "plan-1" },
      error: null,
    });

    // `/p/[token]` guarda el token al abrirse y lo canjea al pulsar.
    await rememberShareToken("tok-1");
    await redeemShareToken("tok-1");

    // El siguiente arranque: `SessionProvider` canjea lo pendiente.
    const planId = await redeemPendingTokens();

    expect(planId).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("forgets a revoked token too — the server answered, retrying is pointless", async () => {
    rpc.mockResolvedValue({
      data: { ok: false, reason: "revoked" },
      error: null,
    });
    await rememberShareToken("tok-1");

    const { result, error } = await redeemShareToken("tok-1");

    expect(error).toBeNull();
    expect(result).toEqual({ ok: false, reason: "revoked" });
    expect(storage.store.has(SHARE_KEY)).toBe(false);
  });

  it("keeps the token after a network failure, for the next launch", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("Failed to fetch") });
    await rememberShareToken("tok-1");

    await redeemShareToken("tok-1");

    expect(storage.store.get(SHARE_KEY)).toBe("tok-1");
  });

  it("does not forget a different token opened afterwards", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    await rememberShareToken("tok-2");

    await redeemShareToken("tok-1");

    expect(storage.store.get(SHARE_KEY)).toBe("tok-2");
  });

  it("the sign-in path still opens the shared plan once", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, plan_id: "plan-1" },
      error: null,
    });
    await rememberShareToken("tok-1");

    expect(await redeemPendingTokens()).toEqual({
      kind: "plan",
      planId: "plan-1",
    });
    expect(await redeemPendingTokens()).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("a circle invitation redeemed at sign-in opens that circle", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, scope: "circle", circle_id: "circle-9" },
      error: null,
    });
    await rememberShareToken("circle-token");

    expect(await redeemPendingTokens()).toEqual({
      kind: "circle",
      circleId: "circle-9",
    });
  });
});
