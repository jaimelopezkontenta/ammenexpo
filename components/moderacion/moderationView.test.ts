import { describe, expect, it } from "vitest";

import {
  canHideReported,
  requiredText,
  unacknowledged,
} from "./moderationView";

describe("canHideReported", () => {
  it("hides posts, comments and messages for everyone", () => {
    expect(canHideReported("post")).toBe(true);
    expect(canHideReported("comment")).toBe(true);
    expect(canHideReported("message")).toBe(true);
  });

  it("offers no fake button for what staff cannot hide", () => {
    // El testimonio lo retira su autor; la intercesión se resuelve bloqueando.
    expect(canHideReported("testimony")).toBe(false);
    expect(canHideReported("intercession")).toBe(false);
    expect(canHideReported("profile")).toBe(false);
  });
});

describe("requiredText", () => {
  it("is the trimmed text", () => {
    expect(requiredText("  falso positivo \n")).toBe("falso positivo");
  });

  it("is null when blank or never written", () => {
    expect(requiredText("   ")).toBeNull();
    expect(requiredText("")).toBeNull();
    expect(requiredText(undefined)).toBeNull();
  });
});

describe("unacknowledged", () => {
  it("keeps only what nobody has acknowledged yet", () => {
    const rows = [
      { id: "a", acknowledged_at: null },
      { id: "b", acknowledged_at: "2026-09-29T08:00:00Z" },
      { id: "c", acknowledged_at: null },
    ];

    expect(unacknowledged(rows).map((row) => row.id)).toEqual(["a", "c"]);
  });

  it("is empty before the queue loads", () => {
    expect(unacknowledged(undefined)).toEqual([]);
  });
});
