import { describe, expect, it, vi } from "vitest";

import {
  classifyContinueReject,
  CreateAttemptKey,
  formatUuid,
  functionErrorStatus,
  newRequestId,
  readFunctionErrorCode,
} from "./requestId";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("newRequestId", () => {
  it("returns a version-4 UUID", () => {
    expect(newRequestId()).toMatch(UUID_V4_RE);
  });

  it("returns a fresh value each call", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newRequestId()));

    expect(seen.size).toBe(500);
  });

  it("formats the Math.random fallback bytes into a valid UUID", () => {
    // Without a crypto object, newRequestId falls back to Math.random and then
    // to formatUuid. Driving it through a stubbed random and a stubbed global
    // exercises exactly that path, without deleting the real `crypto` (which
    // is read-only on modern runtimes).
    const random = vi.spyOn(Math, "random").mockReturnValue(0.25);
    vi.stubGlobal("crypto", undefined);

    try {
      expect(newRequestId()).toMatch(UUID_V4_RE);
    } finally {
      random.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("forces version 4 and the RFC 4122 variant onto raw bytes", () => {
    const bytes = new Uint8Array(16); // all zeros

    expect(formatUuid(bytes)).toBe("00000000-0000-4000-8000-000000000000");
  });
});

describe("CreateAttemptKey", () => {
  it("reuses the same key across retries of one create attempt", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    expect(attempt.acquire()).toBe("key-1");
    // A network timeout + immediate retry must not mint a second key.
    expect(attempt.acquire()).toBe("key-1");
    expect(attempt.acquire()).toBe("key-1");
  });

  it("mints a fresh key after a definitive success", () => {
    const ids = ["key-1", "key-2"];
    let calls = 0;
    const attempt = new CreateAttemptKey(() => ids[calls++]);

    expect(attempt.acquire()).toBe("key-1");
    attempt.clear(); // the reservation succeeded
    expect(attempt.acquire()).toBe("key-2");
  });

  it("reports no current key before the attempt starts and after it clears", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    expect(attempt.current).toBeNull();
    attempt.acquire();
    expect(attempt.current).toBe("key-1");
    attempt.clear();
    expect(attempt.current).toBeNull();
  });

  it("keeps the key after a failure, so the retry stays idempotent", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    const key = attempt.acquire();
    // No clear() here: the mutation threw, the attempt is still open.
    expect(attempt.acquire()).toBe(key);
  });

  it("clears after a definitive HTTP error (400)", () => {
    const ids = ["key-1", "key-2"];
    let calls = 0;
    const attempt = new CreateAttemptKey(() => ids[calls++]);

    expect(attempt.acquire()).toBe("key-1");
    attempt.clearOnError({ context: { status: 400 } });
    expect(attempt.current).toBeNull();
    expect(attempt.acquire()).toBe("key-2");
  });

  it("clears after a definitive HTTP error (402 paywall)", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    attempt.acquire();
    attempt.clearOnError({ context: { status: 402 } });
    expect(attempt.current).toBeNull();
  });

  it("clears after a definitive HTTP error (403 circle_not_allowed)", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    attempt.acquire();
    attempt.clearOnError({ context: { status: 403 } });
    expect(attempt.current).toBeNull();
  });

  it("clears after a definitive HTTP error (409 request_id_conflict)", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    attempt.acquire();
    attempt.clearOnError({ context: { status: 409 } });
    expect(attempt.current).toBeNull();
  });

  it("keeps the key after an in-flight 409 (not definitive)", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    const key = attempt.acquire();
    attempt.clearOnError({
      name: "GenerationInFlight",
      message: "generation_in_flight",
      context: { status: 409 },
    });
    expect(attempt.acquire()).toBe(key);
  });

  it("does not throw when the error is null or not an object", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    const key = attempt.acquire();
    attempt.clearOnError(null);
    attempt.clearOnError(undefined);
    attempt.clearOnError("boom");
    expect(attempt.acquire()).toBe(key);
  });

  it("clears after a definitive HTTP error (422 plan_not_generatable)", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    attempt.acquire();
    attempt.clearOnError({ context: { status: 422 } });
    expect(attempt.current).toBeNull();
  });

  it("keeps the key after an ambiguous error (network — no status)", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    const key = attempt.acquire();
    // A network timeout carries no context.status.
    attempt.clearOnError({});
    expect(attempt.acquire()).toBe(key);
  });

  it("keeps the key after an ambiguous error (500)", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    const key = attempt.acquire();
    attempt.clearOnError({ context: { status: 500 } });
    expect(attempt.acquire()).toBe(key);
  });

  it("keeps the key after an ambiguous error (503 provider unavailable)", () => {
    const attempt = new CreateAttemptKey(() => "key-1");

    const key = attempt.acquire();
    attempt.clearOnError({ context: { status: 503 } });
    expect(attempt.acquire()).toBe(key);
  });
});

describe("classifyContinueReject", () => {
  it("distinguishes in-flight from a request_id conflict", () => {
    expect(classifyContinueReject(409, "generation_in_flight")).toBe(
      "in_flight",
    );
    expect(classifyContinueReject(409, "request_id_conflict")).toBe(
      "request_id_conflict",
    );
    expect(classifyContinueReject(409, "something_else")).toBe("other");
    expect(classifyContinueReject(500, "generation_in_flight")).toBe("other");
  });
});

describe("function error helpers", () => {
  it("reads the status and the JSON error code", async () => {
    const error = {
      context: {
        status: 409,
        json: async () => ({ error: "request_id_conflict" }),
      },
    };

    expect(functionErrorStatus(error)).toBe(409);
    expect(await readFunctionErrorCode(error)).toBe("request_id_conflict");
  });

  it("returns undefined for a null error or a consumed body", async () => {
    expect(functionErrorStatus(null)).toBeUndefined();
    expect(await readFunctionErrorCode(null)).toBeUndefined();
    expect(
      await readFunctionErrorCode({
        context: {
          json: async () => {
            throw new Error("body already read");
          },
        },
      }),
    ).toBeUndefined();
  });
});
