import { describe, expect, it } from "vitest";

import { resolveRedeemOutcome } from "./redeemOutcome";

describe("resolveRedeemOutcome", () => {
  it("is ok for a successful redemption", () => {
    expect(resolveRedeemOutcome({ hadError: false, reason: "ok" })).toBe("ok");
  });

  it("maps every reason the server actually returns today", () => {
    expect(
      resolveRedeemOutcome({ hadError: false, reason: "invalid_or_expired" }),
    ).toBe("invalid_or_expired");
    expect(
      resolveRedeemOutcome({ hadError: false, reason: "plan_missing" }),
    ).toBe("plan_missing");
  });

  it("is error when the call itself failed, regardless of any reason string", () => {
    expect(
      resolveRedeemOutcome({ hadError: true, reason: "invalid_or_expired" }),
    ).toBe("error");
    expect(resolveRedeemOutcome({ hadError: true, reason: null })).toBe(
      "error",
    );
  });

  // El punto exacto de esta corrección: un motivo nuevo que el servidor
  // empiece a devolver mañana no se pierde en silencio ni se reenvía tal
  // cual — cae en un cajón fijo que la allowlist ya conoce.
  it("falls back to unknown for a reason the client does not recognise yet, never forwarding it raw", () => {
    expect(
      resolveRedeemOutcome({
        hadError: false,
        reason: "some_future_reason_the_server_invents",
      }),
    ).toBe("unknown");
  });

  it("is unknown, not error, when there is no reason and no error", () => {
    expect(resolveRedeemOutcome({ hadError: false, reason: null })).toBe(
      "unknown",
    );
    expect(resolveRedeemOutcome({ hadError: false, reason: undefined })).toBe(
      "unknown",
    );
    expect(resolveRedeemOutcome({ hadError: false, reason: "" })).toBe(
      "unknown",
    );
  });
});
