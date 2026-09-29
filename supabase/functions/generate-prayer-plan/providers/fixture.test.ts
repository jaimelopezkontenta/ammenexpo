import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PLAN_LOCALES } from "../locale.ts";
import { isGeneratedPlan } from "../schema.ts";
import { createFixtureProvider, FIXTURE_PLANS } from "./fixture.ts";

/**
 * Los nombres de libro de la WEB, sacados de la migración que los carga
 * (`bible_books.name_en`). Una migración publicada no se edita, así que es una
 * fuente estable; el resolver acepta estos nombres tal cual.
 */
const webBookNames = (): Set<string> => {
  const sql = readFileSync(
    fileURLToPath(
      new URL(
        "../../../migrations/20260929122550_bible_versions.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );

  const block = sql.slice(
    sql.indexOf("set name_en = n.name_en"),
    sql.indexOf(") as n (id, name_en)"),
  );

  return new Set(
    [...block.matchAll(/\(\d+, '([^']+)'\)/g)].map((match) => match[1]),
  );
};

const bookOf = (ref: string) => ref.replace(/\s+\d+:\d+(-\d+)?$/, "");

const generate = (locale?: "es" | "en") =>
  createFixtureProvider()
    .generate({ system: "", messages: [], schema: {}, locale })
    .then((result) => JSON.parse(result.json) as unknown);

describe("el proveedor de pruebas contesta en el idioma del plan", () => {
  it("sin idioma, el plan español de siempre", async () => {
    const plan = await generate();

    expect(plan).toEqual(FIXTURE_PLANS.es);
    expect(plan).toMatchObject({ title: "Paz para este tramo" });
  });

  it("en inglés, el plan inglés", async () => {
    expect(await generate("en")).toEqual(FIXTURE_PLANS.en);
    expect(await generate("es")).toEqual(FIXTURE_PLANS.es);
  });

  it("los dos pasan la validación del generador, con los mismos días", () => {
    for (const locale of PLAN_LOCALES) {
      expect(isGeneratedPlan(FIXTURE_PLANS[locale]), locale).toBe(true);
    }

    expect(FIXTURE_PLANS.en.days.map((day) => day.day_number)).toEqual(
      FIXTURE_PLANS.es.days.map((day) => day.day_number),
    );
  });

  it("el inglés cita con nombres de libro de la WEB, contra la que se verifica", () => {
    const names = webBookNames();

    expect(names.size).toBe(66);

    for (const day of FIXTURE_PLANS.en.days) {
      expect(names, day.scripture_ref).toContain(bookOf(day.scripture_ref));
    }
  });

  it("los mismos pasajes en los dos idiomas", () => {
    const verses = (locale: "es" | "en") =>
      FIXTURE_PLANS[locale].days.map((day) =>
        day.scripture_ref.replace(/^.*\s(\d+:\d+(-\d+)?)$/, "$1"),
      );

    expect(verses("en")).toEqual(verses("es"));
  });
});
