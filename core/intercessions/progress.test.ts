import { describe, expect, it } from "vitest";

import { derivePrayerProgress } from "./progress";

describe("derivePrayerProgress", () => {
  it("puts pending plans first without changing either group's order", () => {
    const plans = [
      { id: "completed-1", already_prayed: true },
      { id: "pending-1", already_prayed: false },
      { id: "completed-2", already_prayed: true },
      { id: "pending-2", already_prayed: false },
    ];

    const progress = derivePrayerProgress(plans);

    expect(progress.pending.map((plan) => plan.id)).toEqual([
      "pending-1",
      "pending-2",
    ]);
    expect(progress.completed.map((plan) => plan.id)).toEqual([
      "completed-1",
      "completed-2",
    ]);
    expect(plans.map((plan) => plan.id)).toEqual([
      "completed-1",
      "pending-1",
      "completed-2",
      "pending-2",
    ]);
  });

  it("derives an honest completed/total count", () => {
    expect(
      derivePrayerProgress([
        { already_prayed: true },
        { already_prayed: false },
        { already_prayed: true },
      ]),
    ).toMatchObject({ completedCount: 2, total: 3, allPrayed: false });
  });

  it("only marks a non-empty list as fully prayed", () => {
    expect(derivePrayerProgress([]).allPrayed).toBe(false);
    expect(
      derivePrayerProgress([{ already_prayed: true }, { already_prayed: true }])
        .allPrayed,
    ).toBe(true);
  });
});
