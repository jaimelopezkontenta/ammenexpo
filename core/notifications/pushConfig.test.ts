import {
  focusManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canRegisterRemotePush, PUSH_PERMISSION_REFRESH } from "./pushConfig";

describe("canRegisterRemotePush", () => {
  it("is false without a projectId", () => {
    expect(canRegisterRemotePush(undefined)).toBe(false);
  });

  it("is true with a projectId", () => {
    expect(canRegisterRemotePush("abc")).toBe(true);
  });

  it("is false for an empty projectId", () => {
    expect(canRegisterRemotePush("")).toBe(false);
  });
});

describe("push permission refresh", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it("asks again when coming back from Settings, even within 30 s", async () => {
    // Los mismos defaults que createQueryClient (core/query/client.ts).
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    });
    client.mount();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("denied")
      .mockResolvedValue("granted");
    const options = {
      queryKey: ["pushPermission"],
      queryFn,
      ...PUSH_PERMISSION_REFRESH,
    };

    const profile = new QueryObserver(client, options);
    const unsubscribe = profile.subscribe(() => {});
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    // Volver a montar Perfil enseguida no vuelve a preguntar.
    const again = new QueryObserver(client, options);
    const unsubscribeAgain = again.subscribe(() => {});
    await settle();
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Ajustes del sistema y de vuelta, unos segundos después.
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await vi.waitFor(() =>
      expect(client.getQueryData(["pushPermission"])).toBe("granted"),
    );
    expect(queryFn).toHaveBeenCalledTimes(2);

    unsubscribe();
    unsubscribeAgain();
    client.unmount();
    client.clear();
  });
});
