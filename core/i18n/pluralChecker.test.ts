import { describe, expect, it, vi } from "vitest";

import { pluralChecker } from "./pluralChecker";

const bundle = (translation: Record<string, unknown>) => ({
  es: { translation },
});

describe("pluralChecker", () => {
  it("passes a correctly formed v3 plural pair", () => {
    expect(
      pluralChecker(
        bundle({
          streak: "{{count}} día de racha",
          streak_plural: "{{count}} días de racha",
        }),
      ),
    ).toEqual([]);
  });

  // The mistake that shipped once already: v4 suffixes are simply never read,
  // so every count silently renders the singular.
  it("catches the v4 suffixes", () => {
    const problems = pluralChecker(
      bundle({ streak_one: "{{count}} día", streak_other: "{{count}} días" }),
    );

    expect(problems).toHaveLength(2);
    expect(problems.join(" ")).toContain("v4 suffix");
  });

  // The inverse, which the suffix check could not see: newPlan.days sat like
  // this unnoticed because no duration on offer was ever 1.
  it("catches a lone key whose text is already plural", () => {
    const problems = pluralChecker(bundle({ days: "{{count}} días" }));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no "_plural" sibling');
  });

  it("accepts a lone key that is genuinely singular", () => {
    expect(pluralChecker(bundle({ day: "Día {{number}}" }))).toEqual([]);
    expect(pluralChecker(bundle({ label: "{{count}} de {{total}}" }))).toEqual(
      [],
    );
  });

  it("does not flag the plural half of a real pair", () => {
    expect(
      pluralChecker(
        bundle({
          members: "{{count}} miembro",
          members_plural: "{{count}} miembros",
        }),
      ),
    ).toEqual([]);
  });

  it("looks inside nested sections", () => {
    const problems = pluralChecker(
      bundle({ bible: { chapters: "{{count}} capítulos" } }),
    );

    expect(problems[0]).toContain("bible.chapters");
  });

  it("reports rather than throws, so i18n still initialises", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      pluralChecker(bundle({ days: "{{count}} días" })),
    ).not.toThrow();
    expect(spy).toHaveBeenCalledOnce();

    spy.mockRestore();
  });
});
