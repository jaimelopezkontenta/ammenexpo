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

describe("expected errors", () => {
  beforeEach(() => {
    observability.reset();
  });

  const failMutation = (
    client: ReturnType<typeof createQueryClient>,
    error: Error,
  ) =>
    client
      .getMutationCache()
      .build(client, {
        mutationKey: ["intercede"],
        mutationFn: () => Promise.reject(error),
      })
      .execute(undefined)
      .catch(() => {});

  it("does not report an answer the screen already explains as a failure", async () => {
    const reporter = vi.fn();
    observability.configureErrors(reporter);
    const client = createQueryClient();

    // Las clases de dominio, tal como se ven desde aquí: por su nombre.
    for (const name of [
      "AlreadyPrayed",
      "PlanLimitReached",
      "GenerationInFlight",
    ]) {
      const error = new Error(name);
      error.name = name;
      await failMutation(client, error);
    }

    await client
      .fetchQuery({
        queryKey: ["avatar"],
        queryFn: () =>
          Promise.reject(Object.assign(new Error("x"), { expected: true })),
        retry: false,
      })
      .catch(() => {});

    expect(reporter).not.toHaveBeenCalled();
  });

  it("still reports the provider being down", async () => {
    const reporter = vi.fn();
    observability.configureErrors(reporter);
    const client = createQueryClient();
    const error = new Error("generation_unavailable");
    error.name = "GenerationUnavailable";

    await failMutation(client, error);

    expect(reporter).toHaveBeenCalledWith({
      source: "mutation",
      key: "intercede",
      name: "GenerationUnavailable",
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
