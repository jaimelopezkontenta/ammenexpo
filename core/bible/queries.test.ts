import { describe, expect, it, vi } from "vitest";

import { verseOfTheDayStaleTime } from "./queries";

// Solo se prueba la función pura: ni la base ni la sesión hacen falta.
vi.mock("@/utils/supabase", () => ({ supabase: {} }));
vi.mock("@/core/auth/SessionProvider", () => ({ useSession: () => ({}) }));

/** Lo que hace React Query con un `staleTime`: viejo si ya pasó. */
const isStale = (dataUpdatedAt: number, now: Date) =>
  dataUpdatedAt + verseOfTheDayStaleTime(dataUpdatedAt) <= now.getTime();

describe("verseOfTheDayStaleTime", () => {
  it("last night's verse is stale this morning", () => {
    const fetchedLastNight = new Date(2026, 8, 28, 23, 0).getTime();
    const thisMorning = new Date(2026, 8, 29, 8, 0);

    expect(isStale(fetchedLastNight, thisMorning)).toBe(true);
  });

  it("today's verse stays fresh until midnight", () => {
    const fetchedThisMorning = new Date(2026, 8, 29, 8, 0).getTime();

    expect(isStale(fetchedThisMorning, new Date(2026, 8, 29, 23, 59))).toBe(
      false,
    );
    expect(isStale(fetchedThisMorning, new Date(2026, 8, 30, 0, 0))).toBe(true);
  });

  it("counts from when it was read, not from when the screen painted", () => {
    const fetched = new Date(2026, 8, 28, 23, 0).getTime();

    expect(verseOfTheDayStaleTime(fetched)).toBe(60 * 60 * 1000);
  });
});
