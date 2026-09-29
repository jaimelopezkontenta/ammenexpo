import { beforeEach, describe, expect, it } from "vitest";

import {
  clearReturnTo,
  forgetReturnToOnSignOut,
  isSafeReturnTo,
  noteSessionUser,
  peekReturnTo,
  rememberReturnTo,
  resetReturnToForTests,
  resumeReturnTo,
} from "./returnTo";

describe("returnTo", () => {
  beforeEach(() => {
    resetReturnToForTests();
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

  it("does not remember the screen you signed out from on purpose", () => {
    noteSessionUser("user-a");
    // Perfil → «Cerrar sesión»: la puerta, sin sesión, intenta recordar
    // /perfil antes de mandar a /entrar.
    forgetReturnToOnSignOut();
    rememberReturnTo("/perfil");

    expect(peekReturnTo()).toBeNull();
  });

  it("forgets what was remembered before signing out on purpose", () => {
    rememberReturnTo("/avisos");
    forgetReturnToOnSignOut();

    expect(peekReturnTo()).toBeNull();
  });

  it("remembers again once the sign-in screen is up", () => {
    noteSessionUser("user-a");
    forgetReturnToOnSignOut();
    rememberReturnTo("/perfil");
    resumeReturnTo();

    // Un enlace abierto ya sin sesión sí es un destino, para quien entre.
    rememberReturnTo("/circulo/abc");
    noteSessionUser("user-b");

    expect(peekReturnTo()).toBe("/circulo/abc");
  });

  it("brings you back where you were when your session just expired", () => {
    noteSessionUser("user-a");
    rememberReturnTo("/perfil");
    noteSessionUser("user-a");

    expect(peekReturnTo()).toBe("/perfil");
  });

  it("does not hand someone else the screen the previous account was on", () => {
    noteSessionUser("user-a");
    // A user-a se le cae la sesión en /perfil, sin cerrarla él.
    rememberReturnTo("/perfil");
    noteSessionUser("user-b");

    expect(peekReturnTo()).toBeNull();
  });

  it("a link opened before anyone signed in is for whoever signs in", () => {
    rememberReturnTo("/avisos");
    noteSessionUser("user-b");

    expect(peekReturnTo()).toBe("/avisos");
  });

  it("losing the session keeps who it belonged to", () => {
    noteSessionUser("user-a");
    noteSessionUser(null);
    rememberReturnTo("/perfil");
    noteSessionUser("user-b");

    expect(peekReturnTo()).toBeNull();
  });
});
