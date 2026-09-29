import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isOnlineState,
  type NetInfoLike,
  type NetInfoStateLike,
  wireOnlineManager,
} from "./online";

/** NetInfo falso: guarda el listener para emitir estados a mano. */
const createFakeNetInfo = () => {
  const listeners = new Set<(state: NetInfoStateLike) => void>();
  const netInfo: NetInfoLike = {
    addEventListener: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    netInfo,
    listeners,
    emit: (state: NetInfoStateLike) => {
      for (const listener of listeners) listener(state);
    },
  };
};

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("isOnlineState", () => {
  it("is offline only on an explicit no", () => {
    expect(isOnlineState({ isConnected: false })).toBe(false);
    expect(
      isOnlineState({ isConnected: true, isInternetReachable: false }),
    ).toBe(false);
  });

  it("treats an unknown reachability or connection as online", () => {
    expect(
      isOnlineState({ isConnected: true, isInternetReachable: null }),
    ).toBe(true);
    expect(
      isOnlineState({ isConnected: null, isInternetReachable: null }),
    ).toBe(true);
    expect(isOnlineState({ isConnected: true })).toBe(true);
  });
});

describe("wireOnlineManager", () => {
  it("tells React Query when the network goes and comes back", () => {
    const { netInfo, emit } = createFakeNetInfo();

    const unwire = wireOnlineManager(netInfo, onlineManager, "ios");

    emit({ isConnected: false, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);

    emit({ isConnected: true, isInternetReachable: null });
    expect(onlineManager.isOnline()).toBe(true);

    unwire();
  });

  it("unsubscribes from NetInfo and leaves React Query online when unwired", () => {
    const { netInfo, emit, listeners } = createFakeNetInfo();

    const unwire = wireOnlineManager(netInfo, onlineManager, "android");
    emit({ isConnected: false });
    unwire();

    expect(listeners.size).toBe(0);
    expect(onlineManager.isOnline()).toBe(true);
  });

  it("does nothing on web, where React Query already listens to the window", () => {
    const netInfo = { addEventListener: vi.fn(() => () => {}) };
    const manager = { setEventListener: vi.fn(), setOnline: vi.fn() };

    wireOnlineManager(netInfo, manager, "web")();

    expect(netInfo.addEventListener).not.toHaveBeenCalled();
    expect(manager.setEventListener).not.toHaveBeenCalled();
  });

  it("stays online as before if NetInfo throws", () => {
    const netInfo: NetInfoLike = {
      addEventListener: () => {
        throw new Error("RNCNetInfo missing");
      },
    };

    expect(() =>
      wireOnlineManager(netInfo, onlineManager, "ios"),
    ).not.toThrow();
    expect(onlineManager.isOnline()).toBe(true);
  });
});
