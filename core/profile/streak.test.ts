import { describe, expect, it } from "vitest";

import { liveStreak } from "./streak";

const at = (iso: string) => new Date(`${iso}T12:00:00`);

describe("liveStreak", () => {
  it("shows nothing when nobody has prayed yet", () => {
    expect(liveStreak(null)).toBe(0);
    expect(liveStreak({ streak_count: 0, streak_last_day: null })).toBe(0);
  });

  it("shows the streak on the day it was earned", () => {
    expect(
      liveStreak(
        { streak_count: 9, streak_last_day: "2026-07-31" },
        at("2026-07-31"),
      ),
    ).toBe(9);
  });

  it("still shows it the next day, before the person has prayed", () => {
    expect(
      liveStreak(
        { streak_count: 9, streak_last_day: "2026-07-31" },
        at("2026-08-01"),
      ),
    ).toBe(9);
  });

  // The grace day: one missed day is forgiven, so the streak is still alive and
  // must still be displayed — otherwise the app tells someone they lost
  // something they have not lost.
  it("survives a single missed day", () => {
    expect(
      liveStreak(
        { streak_count: 9, streak_last_day: "2026-07-31" },
        at("2026-08-02"),
      ),
    ).toBe(9);
  });

  it("is gone once two days have passed with no prayer", () => {
    expect(
      liveStreak(
        { streak_count: 9, streak_last_day: "2026-07-31" },
        at("2026-08-03"),
      ),
    ).toBe(0);
  });

  it("stays gone long after", () => {
    expect(
      liveStreak(
        { streak_count: 40, streak_last_day: "2026-01-01" },
        at("2026-07-31"),
      ),
    ).toBe(0);
  });

  // Month and year boundaries are where date arithmetic usually breaks.
  it("counts across the end of a month", () => {
    expect(
      liveStreak(
        { streak_count: 3, streak_last_day: "2026-01-31" },
        at("2026-02-02"),
      ),
    ).toBe(3);
    expect(
      liveStreak(
        { streak_count: 3, streak_last_day: "2026-01-31" },
        at("2026-02-03"),
      ),
    ).toBe(0);
  });

  it("counts across the end of a year", () => {
    expect(
      liveStreak(
        { streak_count: 5, streak_last_day: "2025-12-31" },
        at("2026-01-02"),
      ),
    ).toBe(5);
    expect(
      liveStreak(
        { streak_count: 5, streak_last_day: "2025-12-31" },
        at("2026-01-03"),
      ),
    ).toBe(0);
  });

  it("counts across a leap day", () => {
    expect(
      liveStreak(
        { streak_count: 2, streak_last_day: "2028-02-28" },
        at("2028-03-01"),
      ),
    ).toBe(2);
    expect(
      liveStreak(
        { streak_count: 2, streak_last_day: "2028-02-29" },
        at("2028-03-02"),
      ),
    ).toBe(2);
  });

  // A clock set backwards, or a stored date briefly ahead of the device, must
  // not read as "lapsed" — the count is not negative, it is just not stale.
  it("does not blank a streak whose date is in the future", () => {
    expect(
      liveStreak(
        { streak_count: 4, streak_last_day: "2026-08-05" },
        at("2026-07-31"),
      ),
    ).toBe(4);
  });
});
