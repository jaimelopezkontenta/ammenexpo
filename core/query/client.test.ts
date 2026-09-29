import { beforeEach, describe, expect, it, vi } from "vitest";

import { observability } from "@/core/observability/track";

import { createQueryClient, wireAppFocus } from "./client";

const appState = vi.hoisted(() => {
  const remove = vi.fn();
  return { remove, addEventListener: vi.fn(() => ({ remove })) };
});

const platform = vi.hoisted(() => ({ OS: "ios" }));

vi.mock("react-native", () => ({ AppState: appState, Platform: platform }));

describe("createQueryClient", () => {
  beforeEach(() => {
    observability.reset();
  });

  it("reports a failed query by the root of its key only", async () => {
    const reporter = vi.fn();
    observability.configureErrors(reporter);
    const client = createQueryClient();

    await client
      .fetchQuery({
        queryKey: ["todayDay", "plan-secreto-123"],
        queryFn: () => Promise.reject(new Error("Failed to fetch")),
        retry: false,
      })
      .catch(() => {});

    expect(reporter).toHaveBeenCalledWith({
      source: "query",
      key: "todayDay",
      name: "Error",
    });
    expect(JSON.stringify(reporter.mock.calls)).not.toContain(
      "plan-secreto-123",
    );
  });

  it("reports a failed mutation", async () => {
    const reporter = vi.fn();
    observability.configureErrors(reporter);
    const client = createQueryClient();

    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["markPrayed"],
        mutationFn: () => Promise.reject(new Error("boom")),
      })
      .execute(undefined)
      .catch(() => {});

    expect(reporter).toHaveBeenCalledWith({
      source: "mutation",
      key: "markPrayed",
      name: "Error",
    });
  });
});

describe("wireAppFocus", () => {
  it("listens to AppState on native and can be unhooked", () => {
    platform.OS = "ios";
    const unhook = wireAppFocus();

    expect(appState.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    unhook();
    expect(appState.remove).toHaveBeenCalled();
  });

  it("leaves the web to React Query's own window focus", () => {
    platform.OS = "web";
    appState.addEventListener.mockClear();

    wireAppFocus();

    expect(appState.addEventListener).not.toHaveBeenCalled();
  });
});
