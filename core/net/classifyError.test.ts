import { describe, expect, it } from "vitest";

import { classifyError } from "./classifyError";

describe("classifyError", () => {
  it("recognises the fetch failures of every platform", () => {
    expect(classifyError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyError(new TypeError("Network request failed"))).toBe(
      "network",
    );
    expect(
      classifyError(
        new TypeError("NetworkError when attempting to fetch resource."),
      ),
    ).toBe("network");
    expect(classifyError(new TypeError("Load failed"))).toBe("network");
  });

  it("recognises a PostgREST error wrapping a dead fetch", () => {
    expect(
      classifyError({
        message: "TypeError: Failed to fetch",
        details: "",
        code: "",
      }),
    ).toBe("network");
  });

  it("does not call the app's own errors a network problem", () => {
    // Lo que isNetworkError sí confundía: un error sin código de Postgres.
    expect(classifyError(new Error("set_active_plan_no_rows"))).toBe("generic");
    expect(
      classifyError(new TypeError("Cannot read properties of undefined")),
    ).toBe("generic");
    expect(classifyError({ message: "permission denied", code: "42501" })).toBe(
      "generic",
    );
  });

  it("trusts the platform when it says it is offline", () => {
    expect(classifyError(new Error("anything"), false)).toBe("network");
  });

  it("copes with nothing useful at all", () => {
    expect(classifyError(undefined)).toBe("generic");
    expect(classifyError(null)).toBe("generic");
    expect(classifyError(42)).toBe("generic");
  });
});
