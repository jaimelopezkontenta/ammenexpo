import { describe, expect, it } from "vitest";

import {
  checkDuration,
  CHUNK_DAYS,
  MAX_DAYS,
  MIN_DAYS,
  nextChunk,
} from "./bounds";

describe("checkDuration", () => {
  it("accepts the boundaries and everything between", () => {
    expect(checkDuration(MIN_DAYS)).toEqual({ ok: true, days: MIN_DAYS });
    expect(checkDuration(MAX_DAYS)).toEqual({ ok: true, days: MAX_DAYS });
    expect(checkDuration(7)).toEqual({ ok: true, days: 7 });
  });

  it("rounds a fractional request the same way the server did", () => {
    expect(checkDuration(7.4)).toEqual({ ok: true, days: 7 });
    expect(checkDuration(6.5)).toEqual({ ok: true, days: 7 });
  });

  it("rejects below the minimum", () => {
    expect(checkDuration(MIN_DAYS - 1)).toEqual({
      ok: false,
      min: MIN_DAYS,
      max: MAX_DAYS,
    });
  });

  it("rejects above the maximum", () => {
    expect(checkDuration(MAX_DAYS + 1)).toEqual({
      ok: false,
      min: MIN_DAYS,
      max: MAX_DAYS,
    });
  });

  it("rejects non-numbers and NaN without throwing", () => {
    expect(checkDuration("7").ok).toBe(false);
    expect(checkDuration(undefined).ok).toBe(false);
    expect(checkDuration(null).ok).toBe(false);
    expect(checkDuration(Number.NaN).ok).toBe(false);
  });
});

describe("nextChunk", () => {
  it("returns the first chunk of a fresh plan", () => {
    expect(nextChunk(0, 30)).toEqual({
      fromDay: 1,
      toDay: CHUNK_DAYS,
    });
  });

  it("splits a long plan into equal stretches", () => {
    expect(nextChunk(7, 30)).toEqual({ fromDay: 8, toDay: 14 });
    expect(nextChunk(21, 30)).toEqual({ fromDay: 22, toDay: 28 });
  });

  it("clamps the last chunk to the plan length", () => {
    expect(nextChunk(28, 30)).toEqual({ fromDay: 29, toDay: 30 });
  });

  it("is null once the plan is complete", () => {
    expect(nextChunk(30, 30)).toBeNull();
    expect(nextChunk(31, 30)).toBeNull();
  });

  it("never hands back a range past the duration", () => {
    const chunk = nextChunk(5, 8);
    expect(chunk).not.toBeNull();
    expect(chunk!.toDay).toBeLessThanOrEqual(8);
  });

  it("rejects nonsense input instead of returning an absurd range", () => {
    expect(nextChunk(-1, 30)).toBeNull();
    expect(nextChunk(1.5, 30)).toBeNull();
    expect(nextChunk(0, 0)).toBeNull();
  });
});
