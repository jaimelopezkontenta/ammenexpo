import { describe, expect, it, vi } from "vitest";

import { chapterPlaceholder } from "./queries";

// Solo se prueba la función pura: ni la base ni la sesión hacen falta.
vi.mock("@/utils/supabase", () => ({ supabase: {} }));
vi.mock("@/core/auth/SessionProvider", () => ({ useSession: () => ({}) }));

const juan3 = [{ verse: 16, text: "Porque de tal manera amó Dios al mundo" }];

describe("chapterPlaceholder", () => {
  it("keeps the chapter on screen while the other version arrives", () => {
    expect(
      chapterPlaceholder(juan3, ["bibleChapter", "rvr1909", 43, 3], 43, 3),
    ).toBe(juan3);
  });

  // Enseñar Juan 3 bajo el título «Juan 4» mientras llega sería mentir.
  it("shows nothing borrowed when the chapter changes", () => {
    expect(
      chapterPlaceholder(juan3, ["bibleChapter", "rvr1909", 43, 3], 43, 4),
    ).toBeUndefined();
    expect(
      chapterPlaceholder(juan3, ["bibleChapter", "rvr1909", 43, 3], 44, 3),
    ).toBeUndefined();
  });

  it("shows nothing on a first read", () => {
    expect(chapterPlaceholder(undefined, undefined, 43, 3)).toBeUndefined();
  });

  it("does not borrow from a query that is not a chapter", () => {
    expect(
      chapterPlaceholder(juan3, ["bibleSearch", "rvr1909", 43, 3], 43, 3),
    ).toBeUndefined();
  });
});
