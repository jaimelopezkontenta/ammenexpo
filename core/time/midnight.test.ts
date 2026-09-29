import { describe, expect, it } from "vitest";

import { localDateKey, msUntilLocalMidnight } from "./midnight";

describe("msUntilLocalMidnight", () => {
  it("counts down to the next local midnight", () => {
    const now = new Date(2026, 8, 29, 22, 30, 0, 0);

    expect(msUntilLocalMidnight(now)).toBe(90 * 60 * 1000);
  });

  it("at midnight exactly, waits a whole day rather than zero", () => {
    const now = new Date(2026, 8, 30, 0, 0, 0, 0);

    expect(msUntilLocalMidnight(now)).toBe(24 * 60 * 60 * 1000);
  });

  it("never returns zero or less", () => {
    const now = new Date(2026, 8, 29, 23, 59, 59, 999);

    expect(msUntilLocalMidnight(now)).toBeGreaterThanOrEqual(1);
  });
});

describe("localDateKey", () => {
  it("formats the local calendar day, zero-padded", () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
