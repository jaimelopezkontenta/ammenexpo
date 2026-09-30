import { describe, expect, it } from "vitest";

import { canRotateCircleInvite } from "./inviteRotation";

// `queries.ts` importa Supabase; aquí solo se usan sus tipos, y un `import
// type` desaparece al compilar, así que no hace falta simularlo.

const circle = { owner_id: "owner" };

describe("canRotateCircleInvite", () => {
  it("lets the circle's creator renew it, even before the roster loads", () => {
    expect(canRotateCircleInvite("owner", circle, undefined)).toBe(true);
  });

  it("lets an admin or an owner by role renew it", () => {
    expect(
      canRotateCircleInvite("ana", circle, [{ user_id: "ana", role: "admin" }]),
    ).toBe(true);
    expect(
      canRotateCircleInvite("luis", circle, [
        { user_id: "luis", role: "owner" },
      ]),
    ).toBe(true);
  });

  it("hides it from a plain member: the RPC would only ever refuse them", () => {
    expect(
      canRotateCircleInvite("eva", circle, [
        { user_id: "eva", role: "member" },
        { user_id: "ana", role: "admin" },
      ]),
    ).toBe(false);
  });

  it("does not borrow somebody else's role", () => {
    expect(
      canRotateCircleInvite("eva", circle, [{ user_id: "ana", role: "admin" }]),
    ).toBe(false);
  });

  it("is false without a session or without a roster to read", () => {
    expect(
      canRotateCircleInvite(undefined, circle, [
        { user_id: "ana", role: "admin" },
      ]),
    ).toBe(false);
    expect(canRotateCircleInvite("ana", circle, undefined)).toBe(false);
  });
});
