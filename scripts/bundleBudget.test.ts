import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkBudget,
  formatTable,
  measureExport,
  METRICS,
  suggestedLimit,
  type ExportMeasurement,
} from "./bundleBudget.mjs";

const ENTRY = "var entry = 1;\n".repeat(200);
const CHUNK = "var chunk = 2;\n".repeat(50);

let dir: string;

const writeExportFile = (relative: string, content: string) => {
  const file = join(dir, relative);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bundle-budget-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("measureExport", () => {
  it("mide la entrada y el total de JS, en bruto y en gzip; ignora mapas y CSS", () => {
    writeExportFile("_expo/static/js/web/entry-abc123.js", ENTRY);
    writeExportFile("_expo/static/js/web/route-def456.js", CHUNK);
    writeExportFile(
      "_expo/static/js/web/entry-abc123.js.map",
      "{}".repeat(999),
    );
    writeExportFile("_expo/static/css/web-1.css", "body{}".repeat(999));
    writeExportFile("index.html", "<html></html>");

    const measurement = measureExport(dir);

    expect(measurement.entry).toEqual({
      file: "_expo/static/js/web/entry-abc123.js",
      raw: Buffer.byteLength(ENTRY),
      gzip: gzipSync(ENTRY).length,
    });
    expect(measurement.total).toEqual({
      files: 2,
      raw: Buffer.byteLength(ENTRY) + Buffer.byteLength(CHUNK),
      gzip: gzipSync(ENTRY).length + gzipSync(CHUNK).length,
    });
  });

  it("falla si el export no existe o no tiene JS", () => {
    expect(() => measureExport(join(dir, "no-existe"))).toThrow("No hay JS");
  });

  it("falla si no hay exactamente un chunk de entrada", () => {
    writeExportFile("_expo/static/js/web/route-1.js", CHUNK);
    expect(() => measureExport(dir)).toThrow("hay 0");

    writeExportFile("_expo/static/js/web/entry-1.js", ENTRY);
    writeExportFile("_expo/static/js/web/entry-2.js", ENTRY);
    expect(() => measureExport(dir)).toThrow("hay 2");
  });
});

describe("checkBudget", () => {
  const measurement: ExportMeasurement = {
    entry: { file: "entry.js", raw: 100_000, gzip: 30_000 },
    total: { files: 2, raw: 150_000, gzip: 45_000 },
  };
  const limits = {
    entryRaw: 100_000,
    entryGzip: 30_000,
    totalRaw: 150_000,
    totalGzip: 45_000,
  };

  it("pasa justo en el límite y falla un byte por encima", () => {
    expect(checkBudget(measurement, limits).every((row) => row.ok)).toBe(true);

    const over = checkBudget(measurement, { ...limits, totalGzip: 44_999 });
    expect(over.filter((row) => !row.ok).map((row) => row.key)).toEqual([
      "totalGzip",
    ]);
  });

  it("sugiere apretar el trinquete solo cuando el ahorro pasa del margen", () => {
    const small = { ...limits, entryRaw: suggestedLimit(100_000) };
    expect(checkBudget(measurement, small)[0].tighterLimit).toBeNull();

    const loose = { ...limits, entryRaw: 200_000 };
    expect(checkBudget(measurement, loose)[0].tighterLimit).toBe(
      suggestedLimit(100_000),
    );
  });

  it("exige los cuatro límites", () => {
    expect(() => checkBudget(measurement, { entryRaw: 1 })).toThrow(
      "entryGzip",
    );
  });

  it("la tabla lleva una fila por métrica y marca la que se pasa", () => {
    const table = formatTable(
      checkBudget(measurement, { ...limits, entryRaw: 99_999 }),
    );

    expect(table.split("\n")).toHaveLength(METRICS.length + 1);
    expect(table).toMatch(/Entrada \(bruto\).*✗/u);
    expect(table).toMatch(/JS total \(gzip\).*✓/u);
  });
});

describe("bundle-budget.json", () => {
  const budget = JSON.parse(
    readFileSync(join(__dirname, "..", "bundle-budget.json"), "utf8"),
  ) as {
    export: string;
    limits: Record<string, number>;
    measured: Record<string, number | string>;
  };

  it("tiene los cuatro límites y ninguno por debajo de lo medido", () => {
    for (const { key } of METRICS) {
      expect(Number.isInteger(budget.limits[key])).toBe(true);
      expect(budget.limits[key]).toBeGreaterThanOrEqual(
        budget.measured[key] as number,
      );
    }
    expect(budget.limits.entryRaw).toBeLessThanOrEqual(budget.limits.totalRaw);
    expect(budget.limits.entryGzip).toBeLessThanOrEqual(
      budget.limits.totalGzip,
    );
  });

  it("mide el export del e2e, que es el que CI tiene a mano", () => {
    expect(budget.export).toBe("dist-e2e");
  });
});
