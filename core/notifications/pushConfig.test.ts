import { describe, expect, it } from "vitest";

import { canRegisterRemotePush } from "./pushConfig";

describe("canRegisterRemotePush", () => {
  it("is false without a projectId", () => {
    expect(canRegisterRemotePush(undefined)).toBe(false);
  });

  it("is true with a projectId", () => {
    expect(canRegisterRemotePush("abc")).toBe(true);
  });

  it("is false for an empty projectId", () => {
    expect(canRegisterRemotePush("")).toBe(false);
  });
});
