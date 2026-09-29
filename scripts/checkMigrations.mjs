#!/usr/bin/env node
/**
 * El guard de migraciones: `npm run migrations:check`.
 *
 * Nació el 2026-09-29, el día que aparecieron ocho migraciones aplicadas en la
 * base local sin fichero en el repo, una de ellas con la misma versión que otra
 * que sí estaba (supabase/rescue/2026-09-29). `db push` compara versiones, no
 * contenidos: con dos ficheros bajo el mismo número, el segundo nunca llega.
 *
 * «Publicado» = lo que ya está en la ref base (por defecto `origin/main`) en
 * su MERGE-BASE con HEAD, no en la punta de la ref: si `main` avanzó desde que
 * se abrió la rama, sus migraciones nuevas no son «borradas» por esta rama, y
 * una migración nueva de la rama no compite con las que aún no conocía.
 *
 * Comprueba que:
 *   - todo fichero de `supabase/migrations/` se llama `<14 dígitos>_<snake>.sql`;
 *   - no hay dos con la misma versión;
 *   - lo ya publicado no se ha editado ni borrado (contenido contra el merge-base);
 *   - lo nuevo lleva una versión posterior a la última publicada, para que
 *     nunca quede ordenado por detrás de algo que ya se aplicó en otro sitio;
 *   - la HISTORIA publicada no tiene ediciones ni borrados sueltos: contra el
 *     contenido no basta, porque con `cancel-in-progress` un push puede
 *     saltarse su comprobación y el siguiente solo mira un tramo. Las cuatro
 *     migraciones de 2026-07-30 editadas una vez en `96adcde` están fijadas en
 *     `LEGACY_EDITS`; una edición más, o una nueva, hace fallar el guard.
 *
 *   node scripts/checkMigrations.mjs                 → contra origin/main
 *   node scripts/checkMigrations.mjs --base <ref>    → contra otra ref
 *   node scripts/checkMigrations.mjs --base none     → solo nombres, duplicados
 *                                                      e historia de HEAD
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
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

/**
 * Migraciones publicadas que se editaron UNA vez antes de que existiera el
 * guard (`96adcde`, «Generate prayer plans with AI»). El valor es cuántas
 * ediciones tiene su historia hoy: si sube, alguien volvió a editarlas.
 *
 * @type {ReadonlyMap<string, number>}
 */
export const LEGACY_EDITS = new Map([
  ["20260730100000_core.sql", 1],
  ["20260730100100_groups.sql", 1],
  ["20260730100200_plans.sql", 1],
  ["20260730100300_social.sql", 1],
]);

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

/**
 * Audita la historia de `supabase/migrations/` de una ref: ningún fichero
 * publicado se edita ni se borra, salvo lo fijado en `legacy`.
 *
 * @param {ReadonlyArray<{ file: string; status: string }>} events cambios de
 *   la historia (`git log --name-status`), en cualquier orden
 * @param {ReadonlyMap<string, number>} [legacy]
 * @returns {string[]}
 */
export const checkHistory = (events, legacy = LEGACY_EDITS) => {
  const errors = [];
  const edits = new Map();
  const removed = new Set();

  for (const { file, status } of events) {
    if (status === "D") removed.add(file);
    else if (status === "M") edits.set(file, (edits.get(file) ?? 0) + 1);
  }

  for (const file of [...removed].sort()) {
    errors.push(
      `${file}: la historia publicada la borra o la renombra en algún commit`,
    );
  }
  for (const [file, count] of [...edits].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const allowed = legacy.get(file) ?? 0;
    if (count > allowed) {
      errors.push(
        allowed === 0
          ? `${file}: la historia publicada la edita ${count} vez/veces tras añadirla — una migración aplicada no se toca`
          : `${file}: tiene ${count} ediciones en la historia y solo ${allowed} están fijadas en LEGACY_EDITS`,
      );
    }
  }
  return errors;
};

/**
 * Lee la salida de `git log --format=%x00 --name-status --no-renames`.
 *
 * @param {string} output
 * @returns {Array<{ file: string; status: string }>}
 */
export const parseNameStatus = (output) =>
  output
    .split("\n")
    .map((line) => /^([AMD])\t(.+)$/u.exec(line.replace(/\r$/u, "")))
    .filter(Boolean)
    .map((match) => ({
      status: match[1],
      file: path.posix.basename(match[2]),
    }));

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

const readTree = (ref) => {
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

const readHistory = (ref) => {
  const log = git([
    "log",
    "--format=",
    "--name-status",
    "--no-renames",
    ref,
    "--",
    `${MIGRATIONS_DIR}/`,
  ]);
  return log === null ? null : parseNameStatus(log);
};

const sameFile = (a, b) => {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
};

const isMain =
  process.argv[1] && sameFile(process.argv[1], fileURLToPath(import.meta.url));

/** Un fallo de lectura de la base, con la causa probable a la vista. */
const explainUnreachable = (ref) => {
  const shallow = git(["rev-parse", "--is-shallow-repository"])?.trim();
  return (
    `No se pudo resolver la ref base «${ref}» contra HEAD.\n` +
    (shallow === "true"
      ? "  Es un clon superficial: usa `fetch-depth: 0` (o `git fetch --unshallow`).\n"
      : "  ¿Falta un `git fetch`? Tras un force-push la ref `before` puede no existir ya.\n") +
    "  Sin base no se comprueba lo publicado: se para en vez de dar un falso verde."
  );
};

if (isMain) {
  const flag = process.argv.indexOf("--base");
  const ref =
    flag === -1 ? "origin/main" : (process.argv[flag + 1] ?? "origin/main");
  // Un push que crea la rama llega con `before` a ceros: no hay base.
  const noBase = ref === "none" || /^0+$/u.test(ref);

  const mergeBase = noBase
    ? null
    : git(["merge-base", "HEAD", ref])?.trim() || null;

  if (!noBase && mergeBase === null) {
    console.error(explainUnreachable(ref));
    process.exitCode = 1;
  } else {
    const base = mergeBase === null ? null : readTree(mergeBase);
    // Lo publicado es lo alcanzable desde el merge-base; sin base, todo HEAD.
    const history = readHistory(mergeBase ?? "HEAD");

    if ((!noBase && base === null) || history === null) {
      console.error(explainUnreachable(ref));
      process.exitCode = 1;
    } else {
      const current = readCurrent();
      const errors = [
        ...checkMigrations(current, base),
        ...checkHistory(history),
      ];
      if (errors.length > 0) {
        for (const error of errors) console.error(`✗ ${error}`);
        process.exitCode = 1;
      } else {
        console.log(
          `✓ ${current.size} migraciones en orden${
            mergeBase
              ? ` frente a ${ref} (merge-base ${mergeBase.slice(0, 7)})`
              : ""
          }`,
        );
      }
    }
  }
}
