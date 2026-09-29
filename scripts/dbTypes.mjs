#!/usr/bin/env node
/**
 * Los tipos de la base (`types/supabase.ts`), generados y comprobados.
 *
 *   node scripts/dbTypes.mjs --write   → regenera el fichero (`npm run db:types`)
 *   node scripts/dbTypes.mjs --check   → falla si el fichero no coincide con la
 *                                        base local (`npm run db:types:check`)
 *
 * Antes era `supabase gen types … > types/supabase.ts` en el script de npm y un
 * `| diff` en el workflow: la redirección de shell cambia según el terminal
 * (PowerShell escribe UTF-16) y el check solo existía en CI. Aquí el proceso lo
 * lanza Node, se compara normalizando saltos de línea y funciona igual en
 * Windows, macOS y Linux.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TYPES_FILE = "types/supabase.ts";

const normalize = (text) => text.replace(/\r\n/gu, "\n");

/**
 * @param {string} generated lo que devuelve `supabase gen types`
 * @param {string} committed lo que hay en el repo
 * @returns {{ ok: true } | { ok: false; line: number; expected: string; actual: string }}
 */
export const compareTypes = (generated, committed) => {
  const a = normalize(generated).split("\n");
  const b = normalize(committed).split("\n");
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) {
      return {
        ok: false,
        line: i + 1,
        expected: a[i] ?? "(fin del fichero)",
        actual: b[i] ?? "(fin del fichero)",
      };
    }
  }
  return { ok: true };
};

const GEN_ARGS = [
  "supabase",
  "gen",
  "types",
  "typescript",
  "--local",
  "--schema",
  "public",
];

const generate = () => {
  const options = { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  // `npx` en Windows es un batch: necesita shell, y con shell el comando va
  // como una sola cadena (pasar un array con `shell: true` está deprecado).
  const result =
    process.platform === "win32"
      ? spawnSync(`npx ${GEN_ARGS.join(" ")}`, { ...options, shell: true })
      : spawnSync("npx", GEN_ARGS, options);
  if (result.status !== 0) {
    throw new Error(
      "`supabase gen types` falló — ¿Supabase local arrancado (`npm run db:start`)?\n" +
        (result.stderr || result.error?.message || ""),
    );
  }
  return result.stdout;
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const mode = process.argv[2];
  if (mode !== "--write" && mode !== "--check") {
    console.error("Uso: node scripts/dbTypes.mjs --write | --check");
    process.exit(2);
  }

  try {
    const generated = generate();
    if (mode === "--write") {
      writeFileSync(TYPES_FILE, normalize(generated), "utf8");
      console.log(`✓ ${TYPES_FILE} regenerado`);
    } else {
      const outcome = compareTypes(generated, readFileSync(TYPES_FILE, "utf8"));
      if (outcome.ok) {
        console.log(`✓ ${TYPES_FILE} coincide con la base local`);
      } else {
        console.error(
          `✗ ${TYPES_FILE} no coincide con la base local (primera diferencia en la línea ${outcome.line}).\n` +
            `  base:    ${outcome.expected}\n  fichero: ${outcome.actual}\n` +
            "  Regenera con `npm run db:types` y commitea el resultado.",
        );
        process.exitCode = 1;
      }
    }
  } catch (caught) {
    console.error(caught instanceof Error ? caught.message : String(caught));
    process.exitCode = 1;
  }
}
