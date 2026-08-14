import { describe, expect, it } from "vitest";

import { resolveSignupSource } from "./signupSource";

describe("resolveSignupSource", () => {
  it("is organic when nothing was stashed at all", () => {
    expect(resolveSignupSource(null)).toBe("organic");
  });

  it("maps every share-link source tag to share_link", () => {
    expect(resolveSignupSource("plan")).toBe("share_link");
    expect(resolveSignupSource("imagen")).toBe("share_link");
    expect(resolveSignupSource("circulo")).toBe("share_link");
  });

  it("maps the invitation tag to invite", () => {
    expect(resolveSignupSource("invitacion")).toBe("invite");
  });

  it("is unknown for a tag it does not recognise, never a guess", () => {
    expect(resolveSignupSource("algo-nuevo-que-no-existe-todavia")).toBe(
      "unknown",
    );
  });
});
