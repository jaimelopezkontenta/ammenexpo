import { describe, expect, it } from "vitest";

import en from "@/translation/en.json";
import es from "@/translation/es.json";

import { INVITE_ROTATION_COPY } from "./inviteRotation";

const lookup = (json: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      json,
    );

describe("INVITE_ROTATION_COPY", () => {
  const entries = Object.entries(INVITE_ROTATION_COPY).flatMap(([kind, copy]) =>
    Object.entries(copy).map(([slot, key]) => ({ kind, slot, key })),
  );

  it.each(entries)(
    "$kind.$slot ($key) is written in Spanish and in English",
    ({ key }) => {
      for (const json of [es, en]) {
        const value = lookup(json, key);
        expect(typeof value).toBe("string");
        expect((value as string).trim()).not.toBe("");
      }
    },
  );

  it("warns, in both languages and for both links, that the current one dies", () => {
    for (const copy of Object.values(INVITE_ROTATION_COPY)) {
      expect(lookup(es, copy.body)).toMatch(/dejará de funcionar/);
      expect(lookup(en, copy.body)).toMatch(/stop working/);
    }
  });

  it("tells a circle admin that people already inside stay inside", () => {
    expect(lookup(es, INVITE_ROTATION_COPY.circle.body)).toMatch(
      /sigue dentro/,
    );
    expect(lookup(en, INVITE_ROTATION_COPY.circle.body)).toMatch(/stays in/);
  });
});
