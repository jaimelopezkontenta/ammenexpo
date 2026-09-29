#!/usr/bin/env node
/**
 * El runner de las suites SQL: `npm run db:test`.
 *
 * Antes era una cadena de quince `npm run db:test:<x>` unidas con `&&`, cada
 * una con su `supabaseDbReset && docker exec … psql … < fichero`. Tres
 * problemas: la redirección `<` es de la shell (no de Node, y cada shell la
 * trata a su manera), la primera suite roja paraba todas las demás (una
 * corrida de ocho minutos decía un solo fallo cada vez), y no había tiempos.
 *
 * Ahora hay UNA lista (`SUITES`) y, por suite: reset de la base
 * (`supabaseDbReset.mjs`) + el fichero por stdin a `psql -v ON_ERROR_STOP=1
 * -f -`. Cada suite sigue corriendo sobre una base recién reseteada: un
 * «reset suave» (rollback por fichero) se estudió y se descartó, porque
 * PostgREST, Realtime y pg_cron retienen conexiones y ven lo que la suite
 * deja a medias. Una suite roja no para las siguientes; el código de salida
 * sale ≠ 0 al final, con la salida de cada fallo guardada en `.tmp/db-test/`.
 *
 *   node scripts/dbTest.mjs                      → las suites de siempre
 *   node scripts/dbTest.mjs --only rls,email     → solo esas (también las opcionales)
 *   node scripts/dbTest.mjs --only email --no-reset → sin reset: iterar sobre lo cargado
 *   node scripts/dbTest.mjs --list               → qué suites hay
 *
 * El lock global de la base (`dbLock.mjs`) se respeta siempre: dentro de
 * `with-db-lock.mjs` (que exporta `DB_LOCK_TOKEN`) corre directamente; fuera
 * —un `npm run db:test:email` suelto— se vuelve a lanzar a través de él.
 */

import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DB_CONTAINER = "supabase_db_ammen";

/**
 * Las suites, en el orden en que corren. `optional` = fuera de `db:test` y de
 * `verify`: solo con `--only`. Son harnesses de concurrencia o de la edge
 * function servida, lentos o con requisitos que CI no tiene.
 *
 * Añadir una suite es añadirla aquí y un alias `db:test:<nombre>` en
 * package.json (`dbTest.test.ts` comprueba que los dos casan).
 *
 * @type {ReadonlyArray<{ name: string; file: string; kind: "sql" | "sh"; optional?: boolean; note?: string }>}
 */
export const SUITES = [
  { name: "rls", file: "supabase/tests/rls.sql", kind: "sql" },
  { name: "flows", file: "supabase/tests/flows.sql", kind: "sql" },
  { name: "streak", file: "supabase/tests/streak.sql", kind: "sql" },
  { name: "timezone", file: "supabase/tests/timezone.sql", kind: "sql" },
  { name: "bible", file: "supabase/tests/bible.sql", kind: "sql" },
  { name: "circles", file: "supabase/tests/circles.sql", kind: "sql" },
  { name: "plans", file: "supabase/tests/plans.sql", kind: "sql" },
  { name: "storage", file: "supabase/tests/storage.sql", kind: "sql" },
  { name: "social", file: "supabase/tests/social.sql", kind: "sql" },
  { name: "flags", file: "supabase/tests/flags.sql", kind: "sql" },
  { name: "push", file: "supabase/tests/push.sql", kind: "sql" },
  { name: "generation", file: "supabase/tests/generation.sql", kind: "sql" },
  { name: "email", file: "supabase/tests/email.sql", kind: "sql" },
  { name: "rescued", file: "supabase/tests/rescued.sql", kind: "sql" },
  { name: "scheduler", file: "supabase/tests/scheduler.sql", kind: "sql" },
  {
    name: "generation-races",
    file: "supabase/tests/generation-races.sh",
    kind: "sh",
    optional: true,
    note: "carreras del ledger IA con conexiones independientes",
  },
  {
    name: "generation-concurrency",
    file: "supabase/tests/generation-concurrency.sh",
    kind: "sh",
    optional: true,
    note: "reservas simultáneas contra el límite de planes",
  },
  {
    name: "chunks",
    file: "supabase/tests/chunks.sh",
    kind: "sh",
    optional: true,
    note: "generación por tramos contra la edge function servida",
  },
];

export const USAGE = `Uso: node scripts/dbTest.mjs [--only a,b] [--no-reset] [--list]

  --only a,b   solo esas suites, en ese orden (también las opcionales)
  --no-reset   no resetear la base antes de cada suite (iterar sobre una ya cargada)
  --list       listar las suites y salir`;

/**
 * @param {ReadonlyArray<string>} argv argumentos sin `node` ni el script
 * @param {ReadonlyArray<{ name: string }>} suites
 * @returns {{ only: string[] | null; noReset: boolean; list: boolean; help: boolean; errors: string[] }}
 */
export const parseArgs = (argv, suites = SUITES) => {
  const names = new Set(suites.map((suite) => suite.name));
  const options = {
    only: /** @type {string[] | null} */ (null),
    noReset: false,
    list: false,
    help: false,
    errors: /** @type {string[]} */ ([]),
  };

  const addOnly = (value) => {
    if (value === undefined || value === "" || value.startsWith("--")) {
      options.errors.push(
        "--only necesita una lista de suites: --only rls,email",
      );
      return;
    }
    const requested = value
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    for (const name of requested) {
      if (!names.has(name)) {
        options.errors.push(
          `No hay ninguna suite «${name}». Las que hay: ${[...names].join(", ")}`,
        );
      } else if (!(options.only ??= []).includes(name)) {
        options.only.push(name);
      }
    }
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--only") {
      addOnly(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--only=")) {
      addOnly(arg.slice("--only=".length));
    } else if (arg === "--no-reset") {
      options.noReset = true;
    } else if (arg === "--list") {
      options.list = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      options.errors.push(`Argumento desconocido: ${arg}`);
    }
  }

  return options;
};

/**
 * Sin `--only`: todas las no opcionales, en el orden de la lista. Con él:
 * exactamente las pedidas, en el orden pedido.
 *
 * @template {{ name: string; optional?: boolean }} T
 * @param {ReadonlyArray<T>} suites
 * @param {ReadonlyArray<string> | null} only
 * @returns {T[]}
 */
export const selectSuites = (suites, only) => {
  if (!only) return suites.filter((suite) => !suite.optional);
  return only
    .map((name) => suites.find((suite) => suite.name === name))
    .filter((suite) => suite !== undefined);
};

/**
 * Cada suite apunta a un fichero que existe y con la extensión de su tipo.
 *
 * @param {ReadonlyArray<{ name: string; file: string; kind: string }>} suites
 * @param {(file: string) => boolean} exists
 * @returns {string[]}
 */
export const checkSuiteFiles = (suites, exists) => {
  const errors = [];
  const seen = new Set();
  for (const suite of suites) {
    if (seen.has(suite.name)) {
      errors.push(`La suite «${suite.name}» está dos veces en la lista`);
    }
    seen.add(suite.name);
    if (!suite.file.endsWith(`.${suite.kind}`)) {
      errors.push(
        `La suite «${suite.name}» es de tipo ${suite.kind} pero apunta a ${suite.file}`,
      );
    }
    if (!exists(suite.file)) {
      errors.push(
        `La suite «${suite.name}» apunta a ${suite.file}, que no existe`,
      );
    }
  }
  return errors;
};

const ALIAS_PREFIX = "db:test:";
export const aliasCommand = (name) => `node scripts/dbTest.mjs --only ${name}`;

/**
 * Los alias de package.json casan con la lista: cada `db:test:<x>` es
 * exactamente `node scripts/dbTest.mjs --only <x>` de una suite que existe,
 * cada suite tiene el suyo, ningún script sigue con la cadena vieja (`psql …
 * < supabase/tests/…`) y `db:test` pasa por el lock.
 *
 * @param {Record<string, string>} scripts
 * @param {ReadonlyArray<{ name: string }>} suites
 * @returns {string[]}
 */
export const checkPackageScripts = (scripts, suites = SUITES) => {
  const errors = [];
  const names = new Set(suites.map((suite) => suite.name));

  for (const [key, command] of Object.entries(scripts)) {
    if (key.startsWith(ALIAS_PREFIX)) {
      const name = key.slice(ALIAS_PREFIX.length);
      if (!names.has(name)) {
        errors.push(
          `«${key}» no corresponde a ninguna suite de scripts/dbTest.mjs`,
        );
      } else if (command !== aliasCommand(name)) {
        errors.push(
          `«${key}» debería ser «${aliasCommand(name)}», no «${command}»`,
        );
      }
    }
    if (/supabase[/\\]tests[/\\]/u.test(command)) {
      errors.push(
        `«${key}» llama a supabase/tests directamente; las suites pasan por scripts/dbTest.mjs`,
      );
    }
  }

  for (const name of names) {
    if (!(`${ALIAS_PREFIX}${name}` in scripts)) {
      errors.push(`La suite «${name}» no tiene alias «${ALIAS_PREFIX}${name}»`);
    }
  }

  if (
    scripts["db:test"] !==
    'node scripts/with-db-lock.mjs "node scripts/dbTest.mjs"'
  ) {
    errors.push(
      '«db:test» debería ser `node scripts/with-db-lock.mjs "node scripts/dbTest.mjs"`',
    );
  }

  return errors;
};

/** 83.4 s → «1m23s»; por debajo del minuto, con un decimal. */
export const formatDuration = (milliseconds) => {
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes}m${String(rest).padStart(2, "0")}s`;
};

/**
 * Las líneas que dicen POR QUÉ falló una suite: la aserción (`FAIL  …`) o el
 * error de psql, sin el resto del ruido de NOTICEs.
 *
 * @param {string} output
 * @returns {string[]}
 */
export const failureLines = (output) =>
  output
    .split(/\r?\n/u)
    .filter((line) => /\bFAIL\b|\bERROR\b|error:|FATAL/u.test(line))
    .slice(0, 8);

// ---------------------------------------------------------------------------
// Lo que toca procesos, ficheros y la base
// ---------------------------------------------------------------------------

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOG_DIR = path.join(ROOT, ".tmp", "db-test");

/**
 * El proceso hijo en curso, para reenviarle un Ctrl+C.
 *
 * @type {import("node:child_process").ChildProcess | null}
 */
let current = null;

/**
 * Lanza un proceso reenviando su salida a la terminal y guardándola a la vez
 * (para el resumen y el log de un fallo). `stdinFile` va por stdin sin shell.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ stdinFile?: string; echo?: boolean }} options
 * @returns {Promise<{ code: number; output: string; ms: number }>}
 */
const run = (command, args, { stdinFile, echo = true } = {}) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const chunks = [];
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: [stdinFile ? "pipe" : "ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    current = child;

    const collect = (stream, target) => {
      stream.on("data", (chunk) => {
        chunks.push(chunk);
        if (echo) target.write(chunk);
      });
    };
    collect(child.stdout, process.stdout);
    collect(child.stderr, process.stderr);

    if (stdinFile) {
      const input = createReadStream(path.join(ROOT, stdinFile));
      input.on("error", (error) => child.stdin.destroy(error));
      // psql puede cerrar stdin antes de leerlo todo (ON_ERROR_STOP): no es
      // un fallo del runner, el código de salida ya lo dirá.
      child.stdin.on("error", () => {});
      input.pipe(child.stdin);
    }

    child.once("error", (error) => {
      current = null;
      resolve({
        code: 127,
        output: `${Buffer.concat(chunks).toString("utf8")}\nerror: ${error.message}\n`,
        ms: Date.now() - startedAt,
      });
    });
    child.once("close", (code, signal) => {
      current = null;
      resolve({
        code: code ?? (signal ? 1 : 0),
        output: Buffer.concat(chunks).toString("utf8"),
        ms: Date.now() - startedAt,
      });
    });
  });

const resetDb = () =>
  run(process.execPath, [path.join("scripts", "supabaseDbReset.mjs")], {
    // El reset es ruido cuando sale bien (setenta líneas de «Applying
    // migration»): solo se enseña si falla.
    echo: false,
  });

const runSuiteBody = (suite) =>
  suite.kind === "sql"
    ? run(
        "docker",
        [
          "exec",
          "-i",
          DB_CONTAINER,
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-f",
          "-",
        ],
        { stdinFile: suite.file },
      )
    : run("bash", [suite.file]);

const logFile = (name) => path.join(LOG_DIR, `${name}.log`);

const saveLog = (name, text) => {
  mkdirSync(LOG_DIR, { recursive: true });
  const file = logFile(name);
  writeFileSync(file, text, "utf8");
  return path.relative(ROOT, file);
};

const runAll = async (suites, { noReset }) => {
  const results = [];
  const startedAt = Date.now();

  for (const [index, suite] of suites.entries()) {
    console.log(`\n── ${suite.name} (${index + 1}/${suites.length}) ──`);
    const result = { name: suite.name, resetMs: 0, suiteMs: 0, ok: false };
    // El log de un fallo anterior ya no dice nada de esta corrida.
    rmSync(logFile(suite.name), { force: true });

    if (!noReset) {
      const reset = await resetDb();
      result.resetMs = reset.ms;
      if (reset.code !== 0) {
        process.stderr.write(reset.output);
        result.log = saveLog(suite.name, reset.output);
        result.reason = [`el reset falló (código ${reset.code})`];
        console.log(
          `✗ ${suite.name}: el reset falló; sigue la siguiente suite`,
        );
        results.push(result);
        continue;
      }
      console.log(`  reset ${formatDuration(reset.ms)}`);
    }

    const body = await runSuiteBody(suite);
    result.suiteMs = body.ms;
    result.ok = body.code === 0;
    if (!result.ok) {
      result.log = saveLog(suite.name, body.output);
      result.reason = failureLines(body.output);
      if (result.reason.length === 0) {
        result.reason = [`salió con código ${body.code}`];
      }
    }
    console.log(
      `${result.ok ? "✓" : "✗"} ${suite.name} ${formatDuration(body.ms)}`,
    );
    results.push(result);
  }

  const width = Math.max(...results.map((result) => result.name.length));
  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n══ db:test: ${results.length - failed.length}/${results.length} en verde · ${formatDuration(Date.now() - startedAt)} ══`,
  );
  for (const result of results) {
    const times = noReset
      ? formatDuration(result.suiteMs)
      : `reset ${formatDuration(result.resetMs).padStart(6)} · suite ${formatDuration(result.suiteMs).padStart(6)}`;
    console.log(
      `  ${result.ok ? "✓" : "✗"} ${result.name.padEnd(width)}  ${times}`,
    );
  }
  for (const result of failed) {
    console.log(`\n✗ ${result.name} — salida completa en ${result.log}`);
    for (const line of result.reason ?? []) console.log(`    ${line.trim()}`);
  }

  return failed.length === 0 ? 0 : 1;
};

/**
 * ¿Este proceso corre ya dentro del lock? `with-db-lock.mjs` exporta el token
 * que tiene; solo vale si el fichero de lock sigue siendo suyo.
 */
const insideDbLock = async () => {
  const token = process.env.DB_LOCK_TOKEN;
  if (!token) return false;
  const { dbLockHeldBy } = await import("./dbLock.mjs");
  return dbLockHeldBy(token);
};

/** Fuera del lock: vuelve a lanzarse a través de `with-db-lock.mjs`. */
const relaunchUnderLock = (argv) =>
  new Promise((resolve) => {
    const quote = (value) => `"${value.replace(/"/gu, '\\"')}"`;
    const inner = [
      quote(process.execPath),
      quote(fileURLToPath(import.meta.url)),
      ...argv.map(quote),
    ].join(" ");
    const child = spawn(
      process.execPath,
      [path.join(ROOT, "scripts", "with-db-lock.mjs"), inner],
      {
        cwd: ROOT,
        stdio: "inherit",
        env: {
          ...process.env,
          DB_LOCK_OWNER:
            process.env.DB_LOCK_OWNER ?? `db:test ${argv.join(" ")}`.trim(),
          AMMEN_DB_TEST_RELAUNCHED: "1",
        },
      },
    );
    child.once("error", (error) => {
      console.error("No se pudo lanzar with-db-lock.mjs", error);
      resolve(1);
    });
    child.once("close", (code) => resolve(code ?? 1));
  });

const sameFile = (a, b) => {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
};

const isMain =
  process.argv[1] && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (isMain) {
  const argv = process.argv.slice(2);
  const options = parseArgs(argv);
  const fileErrors = checkSuiteFiles(SUITES, (file) =>
    existsSync(path.join(ROOT, file)),
  );

  if (options.help) {
    console.log(USAGE);
  } else if (options.errors.length > 0 || fileErrors.length > 0) {
    for (const error of [...options.errors, ...fileErrors]) {
      console.error(`✗ ${error}`);
    }
    console.error(`\n${USAGE}`);
    process.exitCode = 2;
  } else if (options.list) {
    const width = Math.max(...SUITES.map((suite) => suite.name.length));
    for (const suite of SUITES) {
      console.log(
        `${suite.name.padEnd(width)}  ${suite.file}${
          suite.optional ? `  (opcional: ${suite.note})` : ""
        }`,
      );
    }
  } else if (!(await insideDbLock())) {
    if (process.env.AMMEN_DB_TEST_RELAUNCHED === "1") {
      // with-db-lock no nos pasó un token válido: mejor parar que girar.
      console.error(
        "dbTest: relanzado bajo el lock pero sin DB_LOCK_TOKEN válido",
      );
      process.exitCode = 1;
    } else {
      process.exitCode = await relaunchUnderLock(argv);
    }
  } else {
    const onSignal = (signal) => {
      current?.kill(signal);
      process.exitCode = 130;
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);

    process.exitCode = await runAll(
      selectSuites(SUITES, options.only),
      options,
    );
  }
}
