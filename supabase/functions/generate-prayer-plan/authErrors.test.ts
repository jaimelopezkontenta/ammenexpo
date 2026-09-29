import { describe, expect, it } from "vitest";

import { isTransientAuthError } from "./authErrors.ts";

describe("isTransientAuthError", () => {
  it("un fallo de red o del servicio de auth es transitorio", () => {
    expect(
      isTransientAuthError({ name: "AuthRetryableFetchError", status: 0 }),
    ).toBe(true);
    expect(isTransientAuthError({ name: "AuthRetryableFetchError" })).toBe(
      true,
    );
    expect(isTransientAuthError({ name: "AuthApiError", status: 500 })).toBe(
      true,
    );
    expect(isTransientAuthError({ status: 503 })).toBe(true);
    expect(isTransientAuthError({ status: 0 })).toBe(true);
  });

  it("un JWT rechazado no es transitorio: es una sesión inválida", () => {
    expect(isTransientAuthError({ name: "AuthApiError", status: 401 })).toBe(
      false,
    );
    expect(isTransientAuthError({ name: "AuthApiError", status: 403 })).toBe(
      false,
    );
    expect(
      isTransientAuthError({ name: "AuthSessionMissingError", status: 400 }),
    ).toBe(false);
  });

  it("sin error, o con algo irreconocible, cuenta como sesión inválida", () => {
    for (const weird of [null, undefined, "boom", 500, {}, { status: "503" }]) {
      expect(isTransientAuthError(weird)).toBe(false);
    }
  });
});
