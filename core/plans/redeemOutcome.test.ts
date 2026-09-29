import { describe, expect, it } from "vitest";

import {
  destinationAfterRedeem,
  planIdToOpenAfterRedeem,
  resolveRedeemOutcome,
} from "./redeemOutcome";

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

describe("planIdToOpenAfterRedeem", () => {
  it("opens the intercession day for a recipient", () => {
    expect(
      planIdToOpenAfterRedeem({
        ok: true,
        plan_id: "plan-1",
      }),
    ).toBe("plan-1");
  });

  it("does not send the owner to pray for their own plan", () => {
    expect(
      planIdToOpenAfterRedeem({
        ok: true,
        plan_id: "plan-1",
        self: true,
      }),
    ).toBeNull();
  });

  it("is null when the RPC declined or returned a circle-only join", () => {
    expect(
      planIdToOpenAfterRedeem({ ok: false, plan_id: "plan-1" }),
    ).toBeNull();
    expect(planIdToOpenAfterRedeem({ ok: true })).toBeNull();
    expect(planIdToOpenAfterRedeem(null)).toBeNull();
  });
});

describe("destinationAfterRedeem", () => {
  it("opens the plan to pray for", () => {
    expect(
      destinationAfterRedeem({ ok: true, scope: "plan", plan_id: "plan-1" }),
    ).toEqual({ kind: "plan", planId: "plan-1" });
  });

  it("opens the circle after accepting a circle invitation", () => {
    expect(
      destinationAfterRedeem({ ok: true, scope: "circle", circle_id: "c-1" }),
    ).toEqual({ kind: "circle", circleId: "c-1" });
  });

  it("opens the circle behind a group link", () => {
    expect(
      destinationAfterRedeem({ ok: true, scope: "group", group_id: "g-1" }),
    ).toEqual({ kind: "circle", circleId: "g-1" });
  });

  it("goes nowhere for your own plan, a dead link or nothing", () => {
    expect(
      destinationAfterRedeem({ ok: true, plan_id: "plan-1", self: true }),
    ).toBeNull();
    expect(
      destinationAfterRedeem({ ok: false, reason: "invalid_or_expired" }),
    ).toBeNull();
    expect(destinationAfterRedeem(null)).toBeNull();
  });
});
