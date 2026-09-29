import { beforeEach, describe, expect, it } from "vitest";

import {
  clearReturnTo,
  isSafeReturnTo,
  peekReturnTo,
  rememberReturnTo,
} from "./returnTo";

describe("returnTo", () => {
  beforeEach(() => {
    clearReturnTo();
  });

  it("remembers where you were going", () => {
    rememberReturnTo("/avisos");

    expect(peekReturnTo()).toBe("/avisos");
  });

  it("accepts app routes only", () => {
    expect(isSafeReturnTo("/circulo/abc")).toBe(true);
    expect(isSafeReturnTo("//malicioso.example/x")).toBe(false);
    expect(isSafeReturnTo("https://malicioso.example")).toBe(false);
    expect(isSafeReturnTo("/")).toBe(false);
    expect(isSafeReturnTo(undefined)).toBe(false);
  });

  it("never treats the sign-in or sign-up screens as a destination", () => {
    for (const path of [
      "/entrar",
      "/crear-cuenta",
      "/bienvenida",
      "/aceptar",
    ]) {
      rememberReturnTo(path);
      expect(peekReturnTo()).toBeNull();
    }
  });

  it("forgets it once cleared", () => {
    rememberReturnTo("/avisos");
    clearReturnTo();

    expect(peekReturnTo()).toBeNull();
  });
});
