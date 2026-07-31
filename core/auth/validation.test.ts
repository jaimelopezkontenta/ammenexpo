import { describe, expect, it } from "vitest";

import { authErrorKey, isValidEmail } from "./validation";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("ana@ammen.app")).toBe(true);
    expect(isValidEmail("ana.lopez+planes@correo.com.mx")).toBe(true);
  });

  it("ignores surrounding whitespace, which is what phone keyboards add", () => {
    expect(isValidEmail("  ana@ammen.app  ")).toBe(true);
  });

  it("rejects what is obviously not an address", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("ana")).toBe(false);
    expect(isValidEmail("ana@")).toBe(false);
    expect(isValidEmail("ana@correo")).toBe(false);
    expect(isValidEmail("@correo.com")).toBe(false);
    expect(isValidEmail("ana lopez@correo.com")).toBe(false);
  });
});

describe("authErrorKey", () => {
  it("recognises a wrong password", () => {
    expect(authErrorKey("Invalid login credentials")).toBe(
      "auth.invalidCredentials",
    );
  });

  it("recognises the several ways GoTrue says an email is taken", () => {
    expect(authErrorKey("User already registered")).toBe("auth.emailTaken");
    expect(authErrorKey("Email address has already been registered")).toBe(
      "auth.emailTaken",
    );
    expect(authErrorKey("User already exists")).toBe("auth.emailTaken");
  });

  it("matches regardless of case, since the wording is not a stable contract", () => {
    expect(authErrorKey("INVALID LOGIN CREDENTIALS")).toBe(
      "auth.invalidCredentials",
    );
  });

  // Guessing at an unknown message would show the wrong Spanish sentence to
  // someone who is already stuck, so anything unrecognised stays generic.
  it("falls back to the generic error rather than guessing", () => {
    expect(authErrorKey("Something nobody has seen before")).toBe(
      "common.errorGeneric",
    );
    expect(authErrorKey("")).toBe("common.errorGeneric");
  });
});
