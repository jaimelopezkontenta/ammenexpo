import { describe, expect, it } from "vitest";

import {
  cleanupOnSessionChange,
  destinationPath,
  redeemStep,
} from "./sessionFlow";

describe("cleanupOnSessionChange", () => {
  it("clears the cached days when the app starts without a session", () => {
    // La sesión se perdió con la app cerrada: no hay transición de A a nadie.
    expect(cleanupOnSessionChange(null, null)).toEqual({
      clearQueryCache: false,
      clearCachedDays: true,
    });
  });

  it("clears everything when the session ends or changes hands", () => {
    expect(cleanupOnSessionChange("user-a", null)).toEqual({
      clearQueryCache: true,
      clearCachedDays: true,
    });
    expect(cleanupOnSessionChange("user-a", "user-b")).toEqual({
      clearQueryCache: true,
      clearCachedDays: true,
    });
  });

  it("leaves a starting or refreshed session alone", () => {
    expect(cleanupOnSessionChange(null, "user-a")).toEqual({
      clearQueryCache: false,
      clearCachedDays: false,
    });
    expect(cleanupOnSessionChange("user-a", "user-a")).toEqual({
      clearQueryCache: false,
      clearCachedDays: false,
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
