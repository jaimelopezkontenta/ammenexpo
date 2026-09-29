import { describe, expect, it } from "vitest";

import { checkMigrations } from "./checkMigrations.mjs";

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

  it("rejects names that are not <14 digits>_<snake>.sql", () => {
    const current = files({ "2026_Mal-Nombre.sql": "select 1;" });

    expect(checkMigrations(current, null)).toEqual([
      expect.stringContaining("el nombre no es"),
    ]);
  });
});
