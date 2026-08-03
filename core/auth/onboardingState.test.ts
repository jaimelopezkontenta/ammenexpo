import { describe, expect, it } from "vitest";

import { TERMS_VERSION } from "../legal/documents";

import { gateStateFrom } from "./onboardingState";

describe("gateStateFrom", () => {
  it("no decide nada sin sesión", () => {
    expect(
      gateStateFrom({ userId: null, read: undefined, readFailed: false }),
    ).toEqual({ hasOnboarded: null, termsAccepted: null, failed: false });
  });

  it("espera mientras la lectura no ha vuelto", () => {
    const state = gateStateFrom({
      userId: "u1",
      read: undefined,
      readFailed: false,
    });

    expect(state.failed).toBe(false);
    expect(state.hasOnboarded).toBeNull();
  });

  /**
   * La regresión que motiva este fichero: con sesión y sin fila de ajustes, la
   * app se quedaba en la pantalla de arranque para siempre. Tiene que caer en
   * la de error, que es la única con la salida de cerrar sesión.
   */
  it("una cuenta que ya no existe va a la pantalla de error, no a esperar", () => {
    const state = gateStateFrom({
      userId: "u1",
      read: { missing: true },
      readFailed: false,
    });

    expect(state.failed).toBe(true);
  });

  it("un fallo de lectura también, porque ahí sí se puede reintentar", () => {
    expect(
      gateStateFrom({ userId: "u1", read: undefined, readFailed: true }).failed,
    ).toBe(true);
  });

  it("con la fila, dice si falta el onboarding", () => {
    const state = gateStateFrom({
      userId: "u1",
      read: { missing: false, onboarded: false, termsVersion: TERMS_VERSION },
      readFailed: false,
    });

    expect(state).toEqual({
      hasOnboarded: false,
      termsAccepted: true,
      failed: false,
    });
  });

  it("y vuelve a preguntar los términos cuando la versión aceptada es otra", () => {
    const state = gateStateFrom({
      userId: "u1",
      read: { missing: false, onboarded: true, termsVersion: "0.0.0-vieja" },
      readFailed: false,
    });

    expect(state.termsAccepted).toBe(false);
    expect(state.hasOnboarded).toBe(true);
  });

  it("y también cuando no se aceptó ninguna", () => {
    const state = gateStateFrom({
      userId: "u1",
      read: { missing: false, onboarded: true, termsVersion: null },
      readFailed: false,
    });

    expect(state.termsAccepted).toBe(false);
  });
});
