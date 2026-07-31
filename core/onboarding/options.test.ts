import { describe, expect, it } from "vitest";

import en from "../../translation/en.json";
import es from "../../translation/es.json";

import {
  REMINDER_HOURS,
  SEASON_KEYS,
  TOPIC_KEYS,
  toggleWithLimit,
} from "./options";

describe("toggleWithLimit", () => {
  it("adds and removes", () => {
    expect(toggleWithLimit([], "peace")).toEqual(["peace"]);
    expect(toggleWithLimit(["peace"], "peace")).toEqual([]);
  });

  it("refuses past the limit", () => {
    const three = ["a", "b", "c"];
    expect(toggleWithLimit(three, "d", 3)).toEqual(three);
  });

  // Removing has to keep working at the limit, or somebody who picked three
  // would be stuck with those three.
  it("still removes at the limit", () => {
    expect(toggleWithLimit(["a", "b", "c"], "b", 3)).toEqual(["a", "c"]);
  });

  it("is unbounded without a limit", () => {
    expect(toggleWithLimit(["a", "b", "c"], "d")).toEqual(["a", "b", "c", "d"]);
  });
});

/**
 * The lists live in four places: this module, the two translation files, and
 * the server's own labels in `generate-prayer-plan/prompt.ts` (a Deno function
 * that cannot import from here). Three of the four are checked here; the
 * fourth is checked in the edge function's own test.
 *
 * Without this, a key added to the list and forgotten in `en.json` renders as
 * the raw key — `onboarding.seasons.breakup` — on a screen in English.
 */
describe("every option has a label in both languages", () => {
  const table = [
    ["seasons", SEASON_KEYS],
    ["topics", TOPIC_KEYS],
    ["hours", REMINDER_HOURS.map((slot) => slot.key)],
  ] as const;

  for (const [group, keys] of table) {
    for (const key of keys) {
      it(`${group}.${key}`, () => {
        const spanish = (
          es.onboarding as unknown as Record<string, Record<string, string>>
        )[group];
        const english = (
          en.onboarding as unknown as Record<string, Record<string, string>>
        )[group];

        expect(
          spanish?.[key],
          `es.json onboarding.${group}.${key}`,
        ).toBeTruthy();
        expect(
          english?.[key],
          `en.json onboarding.${group}.${key}`,
        ).toBeTruthy();
      });
    }
  }
});
