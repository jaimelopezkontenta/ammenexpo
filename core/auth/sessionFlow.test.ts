import { describe, expect, it } from "vitest";

import {
  cleanupOnSessionChange,
  destinationPath,
  destinationRoute,
  insideAppGatesOpen,
  redeemAction,
  redeemStep,
} from "./sessionFlow";

describe("cleanupOnSessionChange", () => {
  it("clears the user-scoped storage when the app starts without a session", () => {
    // La sesión se perdió con la app cerrada: no hay transición de A a nadie.
    expect(cleanupOnSessionChange(null, null)).toEqual({
      clearQueryCache: false,
      clearUserStorage: true,
    });
  });

  it("clears everything when the session ends or changes hands", () => {
    expect(cleanupOnSessionChange("user-a", null)).toEqual({
      clearQueryCache: true,
      clearUserStorage: true,
    });
    expect(cleanupOnSessionChange("user-a", "user-b")).toEqual({
      clearQueryCache: true,
      clearUserStorage: true,
    });
  });

  it("leaves a starting or refreshed session alone", () => {
    expect(cleanupOnSessionChange(null, "user-a")).toEqual({
      clearQueryCache: false,
      clearUserStorage: false,
    });
    expect(cleanupOnSessionChange("user-a", "user-a")).toEqual({
      clearQueryCache: false,
      clearUserStorage: false,
    });
  });
});

describe("redeemStep", () => {
  it("hands the destination to returnTo while the terms are still pending", () => {
    // Alta nueva: el canje vuelve con la persona en /aceptar. Navegar ahora
    // era que la puerta la sacara de ahí y el destino se perdiera.
    expect(
      redeemStep({
        hasOnboarded: false,
        termsAccepted: false,
        navigationReady: true,
      }),
    ).toBe("handoff");
  });

  it("hands it over too while onboarding is still pending", () => {
    expect(
      redeemStep({
        hasOnboarded: false,
        termsAccepted: true,
        navigationReady: true,
      }),
    ).toBe("handoff");
  });

  it("waits while the gates are unknown", () => {
    expect(
      redeemStep({
        hasOnboarded: null,
        termsAccepted: null,
        navigationReady: true,
      }),
    ).toBe("wait");
  });

  it("waits for the root navigator", () => {
    expect(
      redeemStep({
        hasOnboarded: true,
        termsAccepted: true,
        navigationReady: false,
      }),
    ).toBe("wait");
  });

  it("navigates once every gate is crossed", () => {
    expect(
      redeemStep({
        hasOnboarded: true,
        termsAccepted: true,
        navigationReady: true,
      }),
    ).toBe("navigate");
  });
});

describe("destinationPath", () => {
  it("is the route the gate will redirect to", () => {
    expect(destinationPath({ kind: "plan", planId: "p-1" })).toBe("/orar/p-1");
    expect(destinationPath({ kind: "circle", circleId: "c-1" })).toBe(
      "/circulo/c-1",
    );
  });
});

describe("destinationRoute", () => {
  it("opens the day to pray for a redeemed plan share", () => {
    expect(destinationRoute({ kind: "plan", planId: "p-1" })).toEqual({
      pathname: "/orar/[planId]",
      params: { planId: "p-1" },
    });
  });

  it("opens the circle for an invitation", () => {
    expect(destinationRoute({ kind: "circle", circleId: "c-1" })).toEqual({
      pathname: "/circulo/[id]",
      params: { id: "c-1" },
    });
  });
});

describe("redeemAction", () => {
  const plan = { kind: "plan", planId: "p-1" } as const;

  it("waits without touching the destination while the gates are unknown", () => {
    expect(
      redeemAction(plan, {
        hasOnboarded: null,
        termsAccepted: true,
        navigationReady: true,
      }),
    ).toEqual({ kind: "wait" });
  });

  it("waits for the root navigator even with every gate open", () => {
    // Un `router.replace` antes de montar el navegador caía en `/` con los
    // parámetros de la ruta anterior (`/?token=…`).
    expect(
      redeemAction(plan, {
        hasOnboarded: true,
        termsAccepted: true,
        navigationReady: false,
      }),
    ).toEqual({ kind: "wait" });
  });

  it("hands the path to returnTo while a gate is still closed, navigator or not", () => {
    for (const navigationReady of [true, false]) {
      expect(
        redeemAction(
          { kind: "circle", circleId: "c 1" },
          { hasOnboarded: true, termsAccepted: false, navigationReady },
        ),
      ).toEqual({ kind: "handoff", path: "/circulo/c%201" });
    }
  });

  it("navigates to the typed route once everything is open", () => {
    expect(
      redeemAction(plan, {
        hasOnboarded: true,
        termsAccepted: true,
        navigationReady: true,
      }),
    ).toEqual({
      kind: "navigate",
      route: { pathname: "/orar/[planId]", params: { planId: "p-1" } },
    });
  });
});

describe("insideAppGatesOpen", () => {
  it("opens only for an account past both gates", () => {
    expect(
      insideAppGatesOpen({
        userId: "u-1",
        hasOnboarded: true,
        termsAccepted: true,
      }),
    ).toBe(true);
  });

  it("stays closed without an account, or while a gate is pending or unknown", () => {
    const closed = [
      { userId: null, hasOnboarded: true, termsAccepted: true },
      { userId: "", hasOnboarded: true, termsAccepted: true },
      { userId: "u-1", hasOnboarded: null, termsAccepted: true },
      { userId: "u-1", hasOnboarded: true, termsAccepted: null },
      { userId: "u-1", hasOnboarded: false, termsAccepted: true },
      { userId: "u-1", hasOnboarded: true, termsAccepted: false },
    ];
    for (const input of closed) {
      expect(insideAppGatesOpen(input)).toBe(false);
    }
  });
});
