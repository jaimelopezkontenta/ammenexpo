import { describe, expect, it, vi } from "vitest";

import {
  createPushResponseCoordinator,
  type NotificationResponseLike,
  type PushResolutionResult,
} from "./responseCoordinator";

const OUTBOX_ID = "11111111-1111-1111-1111-111111111111";

const response = (
  identifier: string | undefined = "notification-1",
  outboxId = OUTBOX_ID,
): NotificationResponseLike => ({
  notification: {
    request: {
      ...(identifier ? { identifier } : {}),
      content: {
        data: { type: "intercession", outboxId },
      },
    },
  },
});

const authorized: PushResolutionResult = {
  status: "resolved",
  notification: { authorized: true, intercessor_name: "Nombre seguro" },
};

const denied: PushResolutionResult = {
  status: "resolved",
  notification: { authorized: false, intercessor_name: null },
};

const createHarness = (results: PushResolutionResult[] = [authorized]) => {
  const retries: (() => void)[] = [];
  const resolve = vi.fn(async () => results.shift() ?? authorized);
  const navigate = vi.fn();
  const clearLastResponse = vi.fn();
  const reportError = vi.fn();
  const coordinator = createPushResponseCoordinator({
    resolve,
    navigate,
    clearLastResponse,
    reportError,
    retryDelaysMs: [1, 2],
    scheduleRetry: (callback) => {
      retries.push(callback);
      return () => {
        const index = retries.indexOf(callback);
        if (index >= 0) retries.splice(index, 1);
      };
    },
  });

  return {
    coordinator,
    resolve,
    navigate,
    clearLastResponse,
    reportError,
    retries,
  };
};

describe("push response coordinator", () => {
  it("captures a cold start but waits for a late restored session", async () => {
    const harness = createHarness();

    await harness.coordinator.capture(response(), "cold-start");

    expect(harness.resolve).not.toHaveBeenCalled();
    expect(harness.clearLastResponse).not.toHaveBeenCalled();
    expect(harness.coordinator.pendingCount()).toBe(1);

    await harness.coordinator.updateSession({
      resolved: true,
      userId: "user-a",
    });

    expect(harness.resolve).toHaveBeenCalledOnce();
    expect(harness.navigate).toHaveBeenCalledWith("/avisos");
    expect(harness.clearLastResponse).toHaveBeenCalledOnce();
  });

  it("keeps an initial anonymous response through null to login", async () => {
    const harness = createHarness();

    await harness.coordinator.updateSession({ resolved: true, userId: null });
    await harness.coordinator.capture(response(), "listener");
    expect(harness.resolve).not.toHaveBeenCalled();

    await harness.coordinator.updateSession({
      resolved: true,
      userId: "user-a",
    });

    expect(harness.resolve).toHaveBeenCalledOnce();
    expect(harness.navigate).toHaveBeenCalledOnce();
  });

  it("preserves a retryable error and retries with a bounded scheduler", async () => {
    const transient = new Error("temporary network failure");
    const harness = createHarness([
      { status: "retryable_error", error: transient },
      authorized,
    ]);
    await harness.coordinator.updateSession({
      resolved: true,
      userId: "user-a",
    });

    await harness.coordinator.capture(response(), "cold-start");

    expect(harness.coordinator.pendingCount()).toBe(1);
    expect(harness.clearLastResponse).not.toHaveBeenCalled();
    expect(harness.retries).toHaveLength(1);
    expect(harness.reportError).toHaveBeenCalledWith(transient);

    harness.retries.shift()?.();
    await vi.waitFor(() => expect(harness.coordinator.pendingCount()).toBe(0));

    expect(harness.navigate).toHaveBeenCalledOnce();
    expect(harness.clearLastResponse).toHaveBeenCalledOnce();
    expect(harness.coordinator.pendingCount()).toBe(0);
  });

  it("treats a server deny as terminal and clears without navigating", async () => {
    const harness = createHarness([denied]);
    await harness.coordinator.updateSession({
      resolved: true,
      userId: "user-a",
    });

    await harness.coordinator.capture(response(), "cold-start");

    expect(harness.resolve).toHaveBeenCalledOnce();
    expect(harness.navigate).not.toHaveBeenCalled();
    expect(harness.clearLastResponse).toHaveBeenCalledOnce();
    expect(harness.coordinator.pendingCount()).toBe(0);
  });

  it("navigates only after an authorized server resolution", async () => {
    const harness = createHarness();
    await harness.coordinator.updateSession({
      resolved: true,
      userId: "user-a",
    });

    await harness.coordinator.capture(response(), "listener");

    expect(harness.resolve).toHaveBeenCalledWith(OUTBOX_ID);
    expect(harness.navigate).toHaveBeenCalledWith("/avisos");
  });

  it.each([
    ["listener", "cold-start"],
    ["cold-start", "listener"],
  ] as const)(
    "dedupes listener and cold start in %s → %s order",
    async (first, second) => {
      const harness = createHarness();

      await harness.coordinator.capture(response(), first);
      await harness.coordinator.capture(response(), second);
      await harness.coordinator.updateSession({
        resolved: true,
        userId: "user-a",
      });

      expect(harness.resolve).toHaveBeenCalledOnce();
      expect(harness.navigate).toHaveBeenCalledOnce();
      expect(harness.clearLastResponse).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [response(), response(undefined)],
    [response(undefined), response()],
  ])(
    "dedupes mixed identifier availability for listener and cold start",
    async (first, second) => {
      const harness = createHarness();

      await harness.coordinator.capture(first, "listener");
      await harness.coordinator.capture(second, "cold-start");
      await harness.coordinator.updateSession({
        resolved: true,
        userId: "user-a",
      });

      expect(harness.resolve).toHaveBeenCalledOnce();
      expect(harness.navigate).toHaveBeenCalledOnce();
      expect(harness.clearLastResponse).toHaveBeenCalledOnce();
    },
  );

  it("clears a late cold-start duplicate after listener navigation without reopening", async () => {
    const harness = createHarness();
    await harness.coordinator.updateSession({
      resolved: true,
      userId: "user-a",
    });

    await harness.coordinator.capture(response(), "listener");
    await harness.coordinator.capture(response(), "cold-start");

    expect(harness.resolve).toHaveBeenCalledOnce();
    expect(harness.navigate).toHaveBeenCalledOnce();
    expect(harness.clearLastResponse).toHaveBeenCalledOnce();
  });

  it.each([
    ["listener", "cold-start"],
    ["cold-start", "listener"],
  ] as const)(
    "falls back to outboxId when identifier is absent in %s → %s order",
    async (first, second) => {
      const harness = createHarness();

      await harness.coordinator.capture(response(undefined), first);
      await harness.coordinator.capture(response(undefined), second);
      await harness.coordinator.updateSession({
        resolved: true,
        userId: "user-a",
      });

      expect(harness.resolve).toHaveBeenCalledOnce();
      expect(harness.navigate).toHaveBeenCalledOnce();
      expect(harness.clearLastResponse).toHaveBeenCalledOnce();
    },
  );

  it("makes logout terminal for pending work and never opens it for the next account", async () => {
    let finishResolution: ((result: PushResolutionResult) => void) | undefined;
    const resolve = vi.fn(
      () =>
        new Promise<PushResolutionResult>((resolvePromise) => {
          finishResolution = resolvePromise;
        }),
    );
    const navigate = vi.fn();
    const clearLastResponse = vi.fn();
    const coordinator = createPushResponseCoordinator({
      resolve,
      navigate,
      clearLastResponse,
      retryDelaysMs: [],
    });
    await coordinator.updateSession({ resolved: true, userId: "user-a" });

    const processing = coordinator.capture(response(), "cold-start");
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledOnce());
    const logout = coordinator.updateSession({ resolved: true, userId: null });
    finishResolution?.(authorized);
    await processing;
    await logout;
    await coordinator.updateSession({ resolved: true, userId: "user-b" });

    expect(navigate).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledOnce();
    expect(clearLastResponse).toHaveBeenCalledOnce();
    expect(coordinator.pendingCount()).toBe(0);
  });

  it("redrains an earlier retry that becomes ready while a later pending response is draining", async () => {
    const firstOutbox = "11111111-1111-1111-1111-111111111111";
    const secondOutbox = "22222222-2222-2222-2222-222222222222";
    const calls: string[] = [];
    let firstAttempts = 0;
    let releaseRetry: (() => void) | undefined;
    const navigate = vi.fn();
    const coordinator = createPushResponseCoordinator({
      resolve: async (outboxId) => {
        calls.push(outboxId);
        if (outboxId === firstOutbox) {
          firstAttempts += 1;
          if (firstAttempts === 1) {
            return {
              status: "retryable_error",
              error: new Error("temporary"),
            };
          }
        } else {
          // El timer de A vence exactamente mientras B está dentro del mismo
          // drain. Antes de la señal de redrain, esta llamada se coalescía con
          // la promesa activa y A no volvía a procesarse nunca.
          releaseRetry?.();
        }
        return authorized;
      },
      navigate,
      clearLastResponse: vi.fn(),
      retryDelaysMs: [1],
      scheduleRetry: (callback) => {
        releaseRetry = callback;
        return () => {
          releaseRetry = undefined;
        };
      },
    });

    await coordinator.capture(
      response("notification-a", firstOutbox),
      "listener",
    );
    await coordinator.capture(
      response("notification-b", secondOutbox),
      "listener",
    );
    await coordinator.updateSession({ resolved: true, userId: "user-a" });

    expect(calls).toEqual([firstOutbox, secondOutbox, firstOutbox]);
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(coordinator.pendingCount()).toBe(0);
  });

  it("dispose cancels scheduled retries", async () => {
    const transient = new Error("temporary");
    const harness = createHarness([
      { status: "retryable_error", error: transient },
      authorized,
    ]);
    await harness.coordinator.updateSession({
      resolved: true,
      userId: "user-a",
    });
    await harness.coordinator.capture(response(), "listener");
    expect(harness.retries).toHaveLength(1);

    harness.coordinator.dispose();

    expect(harness.retries).toHaveLength(0);
    expect(harness.coordinator.pendingCount()).toBe(0);
    expect(harness.navigate).not.toHaveBeenCalled();
  });

  it("opens Hoy for a local reminder tap and never calls resolve", async () => {
    const harness = createHarness();

    await harness.coordinator.capture(
      {
        notification: {
          request: {
            identifier: "ammen-reminder-8",
            content: { data: null },
          },
        },
      },
      "listener",
    );

    expect(harness.resolve).not.toHaveBeenCalled();
    expect(harness.navigate).toHaveBeenCalledWith("/");
    expect(harness.navigate).not.toHaveBeenCalledWith("/avisos");
  });

  it("still opens /avisos for an authorized intercession with outboxId", async () => {
    const harness = createHarness();
    await harness.coordinator.updateSession({
      resolved: true,
      userId: "user-a",
    });

    await harness.coordinator.capture(response(), "listener");

    expect(harness.resolve).toHaveBeenCalledWith(OUTBOX_ID);
    expect(harness.navigate).toHaveBeenCalledWith("/avisos");
  });

  it("dedupes a local reminder across listener and cold-start without resolving", async () => {
    const harness = createHarness();
    const localReminder: NotificationResponseLike = {
      notification: {
        request: {
          identifier: "ammen-reminder-8",
          content: { data: null },
        },
      },
    };

    await harness.coordinator.capture(localReminder, "listener");
    await harness.coordinator.capture(localReminder, "cold-start");

    expect(harness.resolve).not.toHaveBeenCalled();
    expect(harness.navigate).toHaveBeenCalledOnce();
    expect(harness.navigate).toHaveBeenCalledWith("/");
    expect(harness.clearLastResponse).toHaveBeenCalledOnce();
  });

  it("dispose prevents navigation when an in-flight resolution finishes", async () => {
    let finishResolution: ((result: PushResolutionResult) => void) | undefined;
    const resolve = vi.fn(
      () =>
        new Promise<PushResolutionResult>((resolvePromise) => {
          finishResolution = resolvePromise;
        }),
    );
    const navigate = vi.fn();
    const coordinator = createPushResponseCoordinator({
      resolve,
      navigate,
      clearLastResponse: vi.fn(),
    });
    await coordinator.updateSession({ resolved: true, userId: "user-a" });

    const processing = coordinator.capture(response(), "listener");
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledOnce());
    coordinator.dispose();
    finishResolution?.(authorized);
    await processing;

    expect(navigate).not.toHaveBeenCalled();
    expect(coordinator.pendingCount()).toBe(0);
  });
});
