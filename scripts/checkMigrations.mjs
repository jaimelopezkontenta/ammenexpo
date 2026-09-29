#!/usr/bin/env node
/**
 * El guard de migraciones: `npm run migrations:check`.
 *
 * Nació el 2026-09-29, el día que aparecieron ocho migraciones aplicadas en la
 * base local sin fichero en el repo, una de ellas con la misma versión que otra
 * que sí estaba (supabase/rescue/2026-09-29). `db push` compara versiones, no
 * contenidos: con dos ficheros bajo el mismo número, el segundo nunca llega.
 *
 * Contra una ref base (por defecto `origin/main`) comprueba que:
 *   - todo fichero de `supabase/migrations/` se llama `<14 dígitos>_<snake>.sql`;
 *   - no hay dos con la misma versión;
 *   - lo ya publicado en la base no se ha editado ni borrado;
 *   - lo nuevo lleva una versión posterior a la última publicada, para que
 *     nunca quede ordenado por detrás de algo que ya se aplicó en otro sitio.
 *
 *   node scripts/checkMigrations.mjs                 → contra origin/main
 *   node scripts/checkMigrations.mjs --base <ref>    → contra otra ref
 *   node scripts/checkMigrations.mjs --base none     → solo nombres y duplicados
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = "supabase/migrations";

export const MIGRATION_NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/u;

/**
 * Ficheros ya publicados que se editaron a propósito, con su motivo. Vacío es
 * lo normal: una migración aplicada no se toca, se añade otra.
 *
 * @type {ReadonlyMap<string, string>}
 */
export const IMMUTABILITY_EXCEPTIONS = new Map();

const normalize = (content) => content.replace(/\r\n/gu, "\n");

/**
 * @param {Map<string, string>} current fichero → contenido en el árbol actual
 * @param {Map<string, string> | null} base fichero → contenido en la ref base
 * @param {ReadonlyMap<string, string>} [exceptions]
 * @returns {string[]} un mensaje por problema; vacío si todo está bien
 */
export const checkMigrations = (
  current,
  base,
  exceptions = IMMUTABILITY_EXCEPTIONS,
) => {
  const errors = [];
  const byVersion = new Map();

  for (const name of [...current.keys()].sort()) {
    const match = MIGRATION_NAME.exec(name);
    if (!match) {
      errors.push(`${name}: el nombre no es <14 dígitos>_<snake_case>.sql`);
      continue;
    }
    const clash = byVersion.get(match[1]);
    if (clash) {
      errors.push(`${name}: repite la versión ${match[1]} de ${clash}`);
    } else {
      byVersion.set(match[1], name);
    }
  }

  if (!base) return errors;

  const baseVersions = [...base.keys()]
    .map((name) => MIGRATION_NAME.exec(name)?.[1])
    .filter(Boolean)
    .sort();
  const lastPublished = baseVersions.at(-1);

  for (const [name, content] of base) {
    if (content === null) {
      errors.push(`${name}: no se pudo leer en la ref base`);
    } else if (!current.has(name)) {
      errors.push(`${name}: ya estaba publicada y se ha borrado`);
    } else if (
      normalize(current.get(name)) !== normalize(content) &&
      !exceptions.has(name)
    ) {
      errors.push(
        `${name}: ya estaba publicada y se ha editado — añade una migración nueva`,
      );
    }
  }

  for (const name of current.keys()) {
    if (base.has(name)) continue;
    const version = MIGRATION_NAME.exec(name)?.[1];
    if (version && lastPublished && version <= lastPublished) {
      errors.push(
        `${name}: es nueva pero su versión no es posterior a la última publicada (${lastPublished}) — usa npx supabase migration new`,
      );
    }
  }

  return errors;
};

const git = (args) => {
  // maxBuffer holgado: 20260730100700_bible_data.sql pesa 4,4 MB y el valor
  // por defecto (1 MB) devolvería null sin avisar.
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout : null;
};

const readCurrent = () =>
  new Map(
    readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => [
        name,
        readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"),
      ]),
  );

const readBase = (ref) => {
  const listing = git(["ls-tree", "--name-only", ref, `${MIGRATIONS_DIR}/`]);
  if (listing === null) return null;
  return new Map(
    listing
      .split("\n")
      .filter((file) => file.endsWith(".sql"))
      .map((file) => [
        path.posix.basename(file),
        git(["show", `${ref}:${file}`]),
      ]),
  );
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const flag = process.argv.indexOf("--base");
  const ref =
    flag === -1 ? "origin/main" : (process.argv[flag + 1] ?? "origin/main");
  // Un push que crea la rama llega con `before` a ceros: no hay base.
  const noBase = ref === "none" || /^0+$/u.test(ref);
  const base = noBase ? null : readBase(ref);

  if (!noBase && base === null) {
    console.error(`No se pudo leer la ref base «${ref}» (¿falta un fetch?)`);
    process.exitCode = 1;
  } else {
    const current = readCurrent();
    const errors = checkMigrations(current, base);
    if (errors.length > 0) {
      for (const error of errors) console.error(`✗ ${error}`);
      process.exitCode = 1;
    } else {
      console.log(
        `✓ ${current.size} migraciones en orden${base ? ` frente a ${ref}` : ""}`,
      );
    }
  }
}
