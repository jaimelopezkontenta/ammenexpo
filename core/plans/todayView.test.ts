import { describe, expect, it, vi } from "vitest";

import { GenerationInFlight, RequestIdConflict } from "./queries";
import {
  archiveErrorKey,
  canArchivePlan,
  emptyCopyKeys,
  isCtaBelowFold,
  journeyCaptionKey,
  pickActivePlan,
  prayBackPlanIdFor,
  resumeErrorKey,
  showFloatingCta,
  todayScreen,
} from "./todayView";

// Las clases de error viven en queries.ts, que al importarse arrastra el
// almacén, React Native y Supabase: se sustituyen por nada, que aquí solo
// hacen falta las clases.
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("react-native", () => ({ AppState: {} }));
vi.mock("@/utils/supabase", () => ({ supabase: {} }));

describe("pickActivePlan", () => {
  const plans = [{ id: "newest" }, { id: "older" }];

  it("is the chosen plan", () => {
    expect(pickActivePlan(plans, "older")).toEqual({ id: "older" });
  });

  it("falls back to the newest when nothing was chosen", () => {
    expect(pickActivePlan(plans, null)).toEqual({ id: "newest" });
    expect(pickActivePlan(plans, undefined)).toEqual({ id: "newest" });
  });

  it("falls back to the newest when the chosen plan is gone", () => {
    expect(pickActivePlan(plans, "archived")).toEqual({ id: "newest" });
  });

  it("is null without plans", () => {
    expect(pickActivePlan([], "any")).toBeNull();
    expect(pickActivePlan(undefined, "any")).toBeNull();
  });
});

describe("prayBackPlanIdFor", () => {
  it("is the plan of the first sharer who prayed for you today", () => {
    expect(
      prayBackPlanIdFor(
        [
          { owner_id: "ana", plan_id: "plan-ana" },
          { owner_id: "luis", plan_id: "plan-luis" },
        ],
        [{ intercessor_id: "luis" }, { intercessor_id: "ana" }],
      ),
    ).toBe("plan-ana");
  });

  it("is null when nobody who prayed shared a plan with you", () => {
    expect(
      prayBackPlanIdFor(
        [{ owner_id: "ana", plan_id: "plan-ana" }],
        [{ intercessor_id: "luis" }],
      ),
    ).toBeNull();
    expect(prayBackPlanIdFor(undefined, undefined)).toBeNull();
  });
});

describe("todayScreen", () => {
  const base = {
    plansLoading: false,
    plansFailed: false,
    plan: { status: "active" },
    hasDay: true,
    dayPending: false,
    stuck: false,
    finished: false,
  };

  it("loads while the plans load", () => {
    expect(todayScreen({ ...base, plansLoading: true })).toEqual({
      kind: "loading",
    });
  });

  it("fails when the plans fail", () => {
    expect(todayScreen({ ...base, plansFailed: true })).toEqual({
      kind: "plansError",
    });
  });

  it("keeps loading while today's day is still in flight — no stalled flash", () => {
    // Con el seed (activo, 4/14, heartbeat viejo) `stuck` ya es cierto
    // mientras `get_my_day` vuela: sin esto parpadeaba la pantalla vacía.
    expect(
      todayScreen({ ...base, hasDay: false, dayPending: true, stuck: true }),
    ).toEqual({ kind: "loading" });
  });

  it("blocks on the orb only while there is nothing to pray yet", () => {
    expect(
      todayScreen({
        ...base,
        plan: { status: "generating" },
        hasDay: false,
      }),
    ).toEqual({ kind: "generating" });
    // Con el primer día ya escrito, se ora aunque el resto se esté escribiendo.
    expect(todayScreen({ ...base, plan: { status: "generating" } })).toEqual({
      kind: "journey",
    });
  });

  it("is empty without a plan", () => {
    expect(todayScreen({ ...base, plan: null, hasDay: false })).toEqual({
      kind: "empty",
      reason: "noPlan",
    });
  });

  it("is empty for a failed plan with no day", () => {
    expect(
      todayScreen({ ...base, plan: { status: "failed" }, hasDay: false }),
    ).toEqual({ kind: "empty", reason: "failed" });
  });

  it("offers to resume a generation that died before the first day", () => {
    expect(
      todayScreen({
        ...base,
        plan: { status: "generating" },
        hasDay: false,
        stuck: true,
      }),
    ).toEqual({ kind: "empty", reason: "stalled" });
  });

  it("says the day failed when an active plan's day came back empty", () => {
    expect(todayScreen({ ...base, hasDay: false })).toEqual({
      kind: "dayError",
    });
  });

  it("ends the plan instead of freezing on its last day", () => {
    expect(todayScreen({ ...base, finished: true })).toEqual({
      kind: "finished",
    });
  });

  it("is the journey with a day to pray, stalled or not", () => {
    expect(todayScreen(base)).toEqual({ kind: "journey" });
    expect(todayScreen({ ...base, stuck: true })).toEqual({ kind: "journey" });
  });
});

describe("emptyCopyKeys", () => {
  it("resumes a stalled plan for free and starts a failed one over", () => {
    expect(emptyCopyKeys("stalled").cta).toBe("plan.stalledCta");
    expect(emptyCopyKeys("failed").cta).toBe("plan.createAnother");
    expect(emptyCopyKeys("noPlan").cta).toBe("plan.createCta");
  });

  it("titles each reason with its own copy", () => {
    expect(emptyCopyKeys("stalled").title).toBe("plan.stalledTitle");
    expect(emptyCopyKeys("failed").title).toBe("plan.failedTitle");
    expect(emptyCopyKeys("noPlan").title).toBe("plan.noPlanTitle");
  });
});

describe("journeyCaptionKey", () => {
  it("says done, continue or coming up", () => {
    expect(journeyCaptionKey(true, 1)).toBe("plan.captionDone");
    expect(journeyCaptionKey(false, 4)).toBe("plan.captionContinue");
    expect(journeyCaptionKey(false, 1)).toBe("plan.captionComingUp");
    expect(journeyCaptionKey(undefined, 1)).toBe("plan.captionComingUp");
  });
});

describe("canArchivePlan", () => {
  it("archives only a live or completed plan", () => {
    expect(canArchivePlan("active")).toBe(true);
    expect(canArchivePlan("completed")).toBe(true);
    expect(canArchivePlan("generating")).toBe(false);
    expect(canArchivePlan("failed")).toBe(false);
  });
});

describe("resumeErrorKey", () => {
  it("does not call an in-flight generation a failure", () => {
    expect(resumeErrorKey(new GenerationInFlight())).toBe(
      "plan.generationInFlight",
    );
  });

  it("names a used request id", () => {
    expect(resumeErrorKey(new RequestIdConflict())).toBe(
      "plan.requestIdConflict",
    );
  });

  it("is the generic error for anything else", () => {
    expect(resumeErrorKey(new Error("boom"))).toBe("common.errorGeneric");
    expect(resumeErrorKey(null)).toBe("common.errorGeneric");
  });
});

describe("archiveErrorKey", () => {
  it("names a plan that cannot be archived", () => {
    expect(archiveErrorKey({ message: "not_archivable", code: "P0001" })).toBe(
      "plan.notArchivable",
    );
    expect(archiveErrorKey(new Error("error: not_archivable (plan)"))).toBe(
      "plan.notArchivable",
    );
  });

  it("is the generic error for anything else", () => {
    expect(archiveErrorKey({ message: "Failed to fetch" })).toBe(
      "common.errorGeneric",
    );
    expect(archiveErrorKey("not_archivable")).toBe("common.errorGeneric");
    expect(archiveErrorKey(undefined)).toBe("common.errorGeneric");
  });
});

describe("floating CTA", () => {
  const viewport = { y: 100, height: 600 };

  it("floats while the real CTA's centre is below the fold", () => {
    expect(isCtaBelowFold(viewport, { y: 680, height: 48 })).toBe(true);
    expect(isCtaBelowFold(viewport, { y: 670, height: 48 })).toBe(false);
  });

  it("shows only on mobile, once we know you have not prayed", () => {
    expect(
      showFloatingCta({ prayed: false, ctaOffscreen: true, isWide: false }),
    ).toBe(true);
    // Mientras carga no se sabe: no parpadea.
    expect(
      showFloatingCta({ prayed: undefined, ctaOffscreen: true, isWide: false }),
    ).toBe(false);
    expect(
      showFloatingCta({ prayed: true, ctaOffscreen: true, isWide: false }),
    ).toBe(false);
    expect(
      showFloatingCta({ prayed: false, ctaOffscreen: false, isWide: false }),
    ).toBe(false);
    expect(
      showFloatingCta({ prayed: false, ctaOffscreen: true, isWide: true }),
    ).toBe(false);
  });
});
