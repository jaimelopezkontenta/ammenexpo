import { describe, expect, it } from "vitest";

import {
  isStuckGenerating,
  STUCK_AFTER_MS,
  type PlanProgressLike,
  type StuckPlan,
} from "./stuckDetection";

const NOW = Date.parse("2026-09-02T12:00:00.000Z");
const stale = new Date(NOW - STUCK_AFTER_MS - 1).toISOString();
const fresh = new Date(NOW - STUCK_AFTER_MS + 1).toISOString();

const basePlan = (overrides: Partial<StuckPlan> = {}): StuckPlan => ({
  status: "active",
  duration_days: 30,
  created_at: stale,
  updated_at: stale,
  ...overrides,
});

const progress = (written: number, total: number): PlanProgressLike => ({
  days_written: written,
  days_total: total,
});

describe("isStuckGenerating", () => {
  it("is never true without a plan", () => {
    expect(isStuckGenerating(null, null, NOW)).toBe(false);
    expect(isStuckGenerating(undefined, null, NOW)).toBe(false);
  });

  it.each(["failed", "completed", "archived"] as const)(
    "never offers continue to a terminal %s plan",
    (status) => {
      expect(isStuckGenerating(basePlan({ status }), null, NOW)).toBe(false);
    },
  );

  it("flags generating + null progress when its stale created_at says no first day landed", () => {
    // This is the actual plan_progress shape for zero days: no row, not
    // `{ days_written: 0 }`, because its query joins prayer_plan_days.
    expect(
      isStuckGenerating(
        basePlan({
          status: "generating",
          created_at: stale,
          updated_at: fresh,
        }),
        null,
        NOW,
      ),
    ).toBe(true);
  });

  it("does not flag generating + null progress with a fresh claim heartbeat", () => {
    expect(
      isStuckGenerating(
        basePlan({
          status: "generating",
          created_at: stale,
          generation_heartbeat_at: fresh,
        }),
        null,
        NOW,
      ),
    ).toBe(false);
  });

  it("also handles a known zero-day generating progress row", () => {
    expect(
      isStuckGenerating(
        basePlan({ status: "generating" }),
        progress(0, 30),
        NOW,
      ),
    ).toBe(true);
  });

  it("does not flag an active plan with null or undefined progress", () => {
    expect(isStuckGenerating(basePlan({ status: "active" }), null, NOW)).toBe(
      false,
    );
    expect(
      isStuckGenerating(basePlan({ status: "active" }), undefined, NOW),
    ).toBe(false);
  });

  it("flags an active incomplete plan only from a stale generation heartbeat", () => {
    expect(
      isStuckGenerating(
        basePlan({
          status: "active",
          generation_heartbeat_at: stale,
          updated_at: fresh,
        }),
        progress(7, 30),
        NOW,
      ),
    ).toBe(true);
  });

  it("does not flag an active incomplete plan with a fresh heartbeat", () => {
    expect(
      isStuckGenerating(
        basePlan({ status: "active", generation_heartbeat_at: fresh }),
        progress(7, 30),
        NOW,
      ),
    ).toBe(false);
  });

  it("never flags a plan whose known progress has every promised day", () => {
    expect(
      isStuckGenerating(
        basePlan({ status: "active", generation_heartbeat_at: stale }),
        progress(30, 30),
        NOW,
      ),
    ).toBe(false);
  });

  it("does not let a rename's fresh updated_at reset the generation clock", () => {
    expect(
      isStuckGenerating(
        basePlan({
          status: "active",
          created_at: stale,
          updated_at: fresh,
          generation_heartbeat_at: null,
        }),
        progress(7, 30),
        NOW,
      ),
    ).toBe(true);
  });

  it("falls back to created_at, never updated_at, when the heartbeat column is absent", () => {
    expect(
      isStuckGenerating(
        basePlan({
          status: "generating",
          created_at: stale,
          updated_at: fresh,
        }),
        progress(1, 30),
        NOW,
      ),
    ).toBe(true);
  });
});
