import { describe, expect, it } from "vitest";

import {
  checkHistory,
  checkMigrations,
  parseNameStatus,
} from "./checkMigrations.mjs";

const files = (entries: Record<string, string>) =>
  new Map(Object.entries(entries));

describe("checkMigrations", () => {
  const published = files({
    "20260907100000_plus_waitlist.sql": "create table a();",
    "20260908100000_email_lifecycle.sql": "create table b();",
  });

  it("accepts published migrations plus a newer one", () => {
    const current = files({
      ...Object.fromEntries(published),
      "20260929062117_export_personal_collections.sql": "select 1;",
    });

    expect(checkMigrations(current, published)).toEqual([]);
  });

  it("rejects two files with the same version — the rescue's collision", () => {
    const current = files({
      "20260908100000_email_lifecycle.sql": "create table b();",
      "20260908100000_export_personal_collections.sql": "select 1;",
    });

    expect(checkMigrations(current, null)).toEqual([
      expect.stringContaining("repite la versión 20260908100000"),
    ]);
  });

  it("rejects editing a migration that was already published", () => {
    const current = files({
      ...Object.fromEntries(published),
      "20260907100000_plus_waitlist.sql": "create table a(id int);",
    });

    expect(checkMigrations(current, published)).toEqual([
      expect.stringContaining("se ha editado"),
    ]);
  });

  it("allows an edit listed as a documented exception", () => {
    const current = files({
      ...Object.fromEntries(published),
      "20260907100000_plus_waitlist.sql": "create table a(id int);",
    });
    const exceptions = new Map([
      ["20260907100000_plus_waitlist.sql", "motivo documentado"],
    ]);

    expect(checkMigrations(current, published, exceptions)).toEqual([]);
  });

  it("ignores line endings, so a Windows checkout is not an edit", () => {
    const current = files({
      "20260907100000_plus_waitlist.sql": "create table a();\r\n",
      "20260908100000_email_lifecycle.sql": "create table b();",
    });
    const base = files({
      "20260907100000_plus_waitlist.sql": "create table a();\n",
      "20260908100000_email_lifecycle.sql": "create table b();",
    });

    expect(checkMigrations(current, base)).toEqual([]);
  });

  it("rejects deleting a published migration", () => {
    const current = files({
      "20260908100000_email_lifecycle.sql": "create table b();",
    });

    expect(checkMigrations(current, published)).toEqual([
      expect.stringContaining("se ha borrado"),
    ]);
  });

  it("rejects a new migration versioned before the last published one", () => {
    const current = files({
      ...Object.fromEntries(published),
      "20260907200000_hand_numbered.sql": "select 1;",
    });

    expect(checkMigrations(current, published)).toEqual([
      expect.stringContaining("no es posterior a la última publicada"),
    ]);
  });

  it("rejects a dollar-quote tag inside a line comment (the supabase CLI splitter opens a literal on it)", () => {
    const current = files({
      "20260929125011_bible_web_data.sql":
        "-- El dollar-quote $web$ no interpreta nada\nselect 1;",
    });

    expect(checkMigrations(current, null)).toEqual([
      expect.stringContaining("etiqueta de dollar-quote"),
    ]);
  });

  it("accepts dollar-quoted code and comments without a tag", () => {
    const current = files({
      "20260929125012_ok.sql":
        "-- una función con cuerpo entre dólares\ncreate function f() returns int language sql as $$ select 1 $$;",
    });

    expect(checkMigrations(current, null)).toEqual([]);
  });

  it("rejects names that are not <14 digits>_<snake>.sql", () => {
    const current = files({ "2026_Mal-Nombre.sql": "select 1;" });

    expect(checkMigrations(current, null)).toEqual([
      expect.stringContaining("el nombre no es"),
    ]);
  });
});

describe("checkHistory", () => {
  const added = (file: string) => ({ file, status: "A" });
  const edited = (file: string) => ({ file, status: "M" });

  it("accepts a history of only additions", () => {
    expect(
      checkHistory([
        added("20260907100000_plus_waitlist.sql"),
        added("20260908100000_email_lifecycle.sql"),
      ]),
    ).toEqual([]);
  });

  it("rejects an edit after the add, even when no single push shows it", () => {
    expect(
      checkHistory([
        added("20260907100000_plus_waitlist.sql"),
        edited("20260907100000_plus_waitlist.sql"),
      ]),
    ).toEqual([expect.stringContaining("la edita 1 vez")]);
  });

  it("rejects a deleted or renamed migration", () => {
    expect(
      checkHistory([
        added("20260907100000_plus_waitlist.sql"),
        { file: "20260907100000_plus_waitlist.sql", status: "D" },
      ]),
    ).toEqual([expect.stringContaining("la borra o la renombra")]);
  });

  it("tolerates exactly the pinned legacy edits and not one more", () => {
    const legacy = new Map([["20260730100000_core.sql", 1]]);
    const once = [
      added("20260730100000_core.sql"),
      edited("20260730100000_core.sql"),
    ];

    expect(checkHistory(once, legacy)).toEqual([]);
    expect(
      checkHistory([...once, edited("20260730100000_core.sql")], legacy),
    ).toEqual([expect.stringContaining("solo 1 están fijadas")]);
  });

  it("the real legacy pins match what the repository history contains", async () => {
    const { LEGACY_EDITS } = await import("./checkMigrations.mjs");

    expect([...LEGACY_EDITS.keys()].sort()).toEqual([
      "20260730100000_core.sql",
      "20260730100100_groups.sql",
      "20260730100200_plans.sql",
      "20260730100300_social.sql",
      "20260929125011_bible_web_data.sql",
    ]);
  });
});

describe("parseNameStatus", () => {
  it("reads A/M/D lines from git log --name-status and ignores blanks", () => {
    const output =
      "\nA\tsupabase/migrations/20260907100000_a.sql\n\r\n" +
      "M\tsupabase/migrations/20260907100000_a.sql\r\n" +
      "D\tsupabase/migrations/20260908100000_b.sql\n";

    expect(parseNameStatus(output)).toEqual([
      { status: "A", file: "20260907100000_a.sql" },
      { status: "M", file: "20260907100000_a.sql" },
      { status: "D", file: "20260908100000_b.sql" },
    ]);
  });
});
