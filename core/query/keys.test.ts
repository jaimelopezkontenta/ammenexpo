import { describe, expect, it } from "vitest";

import { qk } from "./keys";

/**
 * Los valores de las claves son un contrato con la caché: cambiar uno cambia qué
 * se guarda y qué invalida cada `invalidateQueries`. Este test los fija.
 */
describe("qk", () => {
  it("a keyed query is [root, ...args] and its .root is just [root]", () => {
    expect(qk.myPlans("u1")).toEqual(["myPlans", "u1"]);
    expect(qk.myPlans.root).toEqual(["myPlans"]);
    expect(qk.planDay("p1", 3)).toEqual(["planDay", "p1", 3]);
    expect(qk.chapterMarks("u1", 43, 3)).toEqual(["chapterMarks", "u1", 43, 3]);
    expect(qk.bibleBooks()).toEqual(["bibleBooks"]);
  });

  it("an undefined argument stays in the key (the query is disabled, not shared)", () => {
    expect(qk.profile(undefined)).toEqual(["profile", undefined]);
  });

  it("the open wall has its own circle id: 'wall'", () => {
    expect(qk.prayerFeed()).toEqual(["prayerFeed", "wall"]);
    expect(qk.prayerFeed("c1")).toEqual(["prayerFeed", "c1"]);
    expect(qk.prayerFeed.root).toEqual(["prayerFeed"]);
  });

  it("the held-content statuses collapse into one stable string", () => {
    expect(qk.heldContentQueue(["held", "pending"])).toEqual([
      "heldContentQueue",
      "held,pending",
    ]);
  });

  it("every .root is a prefix of its builder's key, so invalidating the root reaches it", () => {
    for (const [name, builder] of Object.entries(qk)) {
      const root = builder.root;
      expect(root).toHaveLength(1);
      expect(root[0]).toBe(name);
    }
  });
});
