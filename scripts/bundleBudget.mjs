#!/usr/bin/env node
/**
 * Presupuesto de tamaño del JS del export web — un trinquete.
 *
 * Mide el chunk de entrada (`_expo/static/js/web/entry-*.js`) y el total de JS
 * del export, en bruto y en gzip, y falla si algo pasa de `bundle-budget.json`.
 * El límite es lo medido más un 5 %: una dependencia que entra sin querer (un
 * import de barril, una librería de servidor) salta aquí y no en el móvil de
 * alguien con mala cobertura. Puede bajar, no subir: cuando el bundle adelgaza
 * el script sugiere el límite nuevo; subirlo es una decisión que se explica en
 * el PR. Qué pesa hoy: docs/runbooks/ci.md.
 *
 *   npm run bundle:budget                  mide `dist-e2e` (el export del e2e)
 *   node scripts/bundleBudget.mjs <dir>    mide otro export
 *   … --budget <fichero>                   otro presupuesto
 *
 * gzip con el nivel por defecto de zlib: lo que viaja depende del CDN, pero
 * para comparar una medición con la anterior basta con que sea siempre igual.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const JS_DIR = path.join("_expo", "static", "js");
const ENTRY_FILE = /^entry-[^/\\]*\.js$/u;

export const MARGIN = 0.05;

export const METRICS = [
  { key: "entryRaw", label: "Entrada (bruto)", pick: (m) => m.entry.raw },
  { key: "entryGzip", label: "Entrada (gzip)", pick: (m) => m.entry.gzip },
  { key: "totalRaw", label: "JS total (bruto)", pick: (m) => m.total.raw },
  { key: "totalGzip", label: "JS total (gzip)", pick: (m) => m.total.gzip },
];

const toPosix = (value) => value.split(path.sep).join("/");

export const measureExport = (exportDir) => {
  const jsRoot = path.join(exportDir, JS_DIR);
  if (!fs.existsSync(jsRoot)) {
    throw new Error(
      `No hay JS en ${jsRoot}. ¿Está exportado? (lo exporta el e2e estático: npm run e2e:static)`,
    );
  }

  const files = fs
    .readdirSync(jsRoot, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
    .map((file) => {
      const content = fs.readFileSync(file);
      return {
        file: toPosix(path.relative(exportDir, file)),
        raw: content.length,
        gzip: zlib.gzipSync(content).length,
      };
    });

  const entries = files.filter((f) =>
    ENTRY_FILE.test(path.posix.basename(f.file)),
  );
  if (entries.length !== 1) {
    throw new Error(
      `Se esperaba un único chunk de entrada (entry-*.js) en ${jsRoot} y hay ${entries.length}`,
    );
  }

  const sum = (key) => files.reduce((total, f) => total + f[key], 0);
  return {
    entry: entries[0],
    total: { files: files.length, raw: sum("raw"), gzip: sum("gzip") },
  };
};

/** Lo medido más el margen, redondeado hacia arriba al KiB. */
export const suggestedLimit = (bytes) =>
  Math.ceil((bytes * (1 + MARGIN)) / 1024) * 1024;

export const checkBudget = (measurement, limits) =>
  METRICS.map(({ key, label, pick }) => {
    const limit = limits?.[key];
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(
        `bundle-budget.json: falta el límite «${key}» (bytes, entero)`,
      );
    }
    const actual = pick(measurement);
    const suggested = suggestedLimit(actual);
    return {
      key,
      label,
      actual,
      limit,
      ok: actual <= limit,
      // Solo se sugiere bajar cuando el ahorro pasa del propio margen: así un
      // cambio de pocos bytes no pide tocar el fichero en cada PR.
      tighterLimit: suggested < limit * (1 - MARGIN) ? suggested : null,
    };
  });

const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

export const formatTable = (rows) => {
  const header = ["Métrica", "Medido", "Límite", "Uso", ""];
  const lines = rows.map((row) => [
    row.label,
    kib(row.actual),
    kib(row.limit),
    `${((row.actual / row.limit) * 100).toFixed(1)} %`,
    row.ok ? "✓" : "✗",
  ]);
  const widths = header.map((_, i) =>
    Math.max(...[header, ...lines].map((cells) => cells[i].length)),
  );
  return [header, ...lines]
    .map((cells) =>
      cells
        .map((cell, i) =>
          i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]),
        )
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
};

const readOption = (args, name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const root = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const args = process.argv.slice(2);
    const budgetFile = path.resolve(
      root,
      readOption(args, "--budget") ?? "bundle-budget.json",
    );
    const budget = JSON.parse(fs.readFileSync(budgetFile, "utf8"));
    const positional = args.filter(
      (arg, i) => !arg.startsWith("--") && args[i - 1] !== "--budget",
    );
    const exportDir = path.resolve(
      root,
      positional[0] ?? budget.export ?? "dist-e2e",
    );

    const measurement = measureExport(exportDir);
    const rows = checkBudget(measurement, budget.limits);

    console.log(
      `Bundle web de ${exportDir} (${measurement.total.files} fichero(s) JS; entrada ${measurement.entry.file}):\n`,
    );
    console.log(formatTable(rows));

    const over = rows.filter((row) => !row.ok);
    for (const row of over) {
      console.error(
        `\n✗ ${row.label}: ${row.actual} B > ${row.limit} B. Si el crecimiento es deliberado, sube «${row.key}» en bundle-budget.json y explica en el PR qué entra y por qué.`,
      );
    }
    for (const row of rows.filter((r) => r.tighterLimit !== null)) {
      console.log(
        `\n↓ ${row.label} ha bajado: aprieta el trinquete, «${row.key}»: ${row.tighterLimit} en bundle-budget.json.`,
      );
    }
    if (over.length > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
