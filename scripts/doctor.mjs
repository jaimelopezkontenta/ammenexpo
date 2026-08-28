#!/usr/bin/env node
/**
 * El médico del entorno local: `npm run doctor`.
 *
 * Nació el 2026-08-28, un día en que tres males distintos del entorno se
 * comieron horas de suite: un dev server de OTRO proyecto con 13,8 GB de RAM
 * ralentizando cada page.goto, un Metro degradado que acabó muriendo por OOM,
 * y un Kong que tras un `db reset` se quedó con el upstream viejo de GoTrue
 * devolviendo 502 en /auth/v1/health. Ninguno de los tres decía su nombre:
 * todos se presentaban como "los tests van lentos o fallan".
 *
 * Es deliberadamente de SOLO LECTURA y sin lock: se puede correr en cualquier
 * momento, incluso con una suite en marcha. Los chequeos duros del harness
 * (con reset y verificación de seed) siguen viviendo en `e2e/globalSetup.ts`;
 * esto es el chivato que se mira ANTES de lanzar nada.
 *
 * Sale con código 1 solo si un chequeo duro falla (Docker/DB/Auth); los
 * avisos (procesos gordos, .env.local con la URL del emulador) no bloquean.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";

const DB_CONTAINER = "supabase_db_ammen";
const AUTH_HEALTH = "http://127.0.0.1:54421/auth/v1/health";
const SEED_EMAIL = "prueba@ammen.local";
const HEAVY_NODE_GB = 2;

let hardFailure = false;

const ok = (message) => console.log(`  ✓ ${message}`);
const warn = (message) => console.log(`  ! ${message}`);
const fail = (message) => {
  hardFailure = true;
  console.log(`  ✗ ${message}`);
};

const run = (command) => execSync(command, { encoding: "utf8" });

/** Procesos node con la memoria por las nubes — el mal de Trabajala. */
const checkHeavyNodeProcesses = () => {
  try {
    const raw =
      process.platform === "win32"
        ? spawnSync(
            "powershell",
            [
              "-NoProfile",
              "-Command",
              'Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id) $([math]::Round($_.WorkingSet64/1GB,2))" }',
            ],
            { encoding: "utf8" },
          ).stdout
        : spawnSync("ps", ["-eo", "pid,rss,comm"], { encoding: "utf8" })
            .stdout.split("\n")
            .filter((line) => line.includes("node"))
            .map((line) => {
              const [pid, rss] = line.trim().split(/\s+/);
              return `${pid} ${(Number(rss) / 1024 / 1024).toFixed(2)}`;
            })
            .join("\n");

    const heavy = (raw ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [pid, gb] = line.split(/\s+/);
        return { pid, gb: Number(gb) };
      })
      .filter((entry) => entry.gb >= HEAVY_NODE_GB);

    if (heavy.length === 0) {
      ok("ningún proceso node con la memoria por las nubes");
      return;
    }

    for (const entry of heavy) {
      warn(
        `node PID ${entry.pid} usa ${entry.gb} GB — con la máquina así cada ` +
          "page.goto se multiplica; mira si es un dev server olvidado y mátalo",
      );
    }
  } catch {
    warn("no se pudo listar procesos node (chequeo omitido)");
  }
};

/** ¿Quién escucha en 8081 — Metro, el estático de e2e, o nadie? */
const checkPort8081 = async () => {
  const listening = await new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port: 8081 });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    setTimeout(() => done(false), 1_500);
  });

  if (!listening) {
    ok(
      "puerto 8081 libre (Playwright arrancará su propio servidor; " +
        "`npm run e2e:static` lo necesita así)",
    );
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:8081/status", {
      signal: AbortSignal.timeout(3_000),
    });
    const body = await response.text();
    if (body.includes("packager-status")) {
      ok(
        "puerto 8081: Metro (dev). Recuerda: `npm run e2e:static` exige el " +
          "puerto libre",
      );
      return;
    }
  } catch {
    // No es Metro; sigue abajo.
  }

  warn("puerto 8081 ocupado por algo que no parece Metro — identifícalo");
};

const checkDocker = () => {
  let health;
  try {
    health = run(
      `docker inspect -f "{{.State.Health.Status}}" ${DB_CONTAINER}`,
    ).trim();
  } catch {
    fail(
      `Docker no responde o el contenedor ${DB_CONTAINER} no existe — ` +
        "corre `npx supabase start`",
    );
    return false;
  }

  if (health !== "healthy") {
    fail(`${DB_CONTAINER} está "${health || "sin healthcheck"}", no healthy`);
    return false;
  }

  ok(`${DB_CONTAINER} healthy`);
  return true;
};

/**
 * La puerta de Auth A TRAVÉS de Kong: un 502 aquí con el contenedor de auth
 * sano es el gateway con el upstream viejo — `docker restart
 * supabase_kong_ammen` lo cura (visto el 2026-08-28).
 */
const checkAuthHealth = async () => {
  try {
    const response = await fetch(AUTH_HEALTH, {
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) {
      ok("GoTrue responde vía Kong (auth/v1/health 200)");
      return;
    }
    fail(
      `auth/v1/health devolvió ${response.status} — si auth está sano, es ` +
        "Kong con el upstream viejo: `docker restart supabase_kong_ammen`",
    );
  } catch {
    fail(
      "auth/v1/health no responde — ¿Supabase arrancado? ¿Kong colgado? " +
        "(`docker restart supabase_kong_ammen` si los contenedores están Up)",
    );
  }
};

const checkSeed = () => {
  try {
    const output = run(
      `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -t -A ` +
        `-c "select count(*) from auth.users where email = '${SEED_EMAIL}'"`,
    ).trim();
    if (output === "1") {
      ok(`cuenta semilla ${SEED_EMAIL} presente`);
    } else {
      warn(
        `la cuenta semilla ${SEED_EMAIL} no está (¿base sin resetear?) — el ` +
          "globalSetup de Playwright la repone con su reset",
      );
    }
  } catch {
    warn("no se pudo consultar el seed (¿contenedor accesible?)");
  }
};

/** Los dos .env con trampa conocida. */
const checkEnvFiles = () => {
  if (existsSync(".env.local")) {
    const envLocal = readFileSync(".env.local", "utf8");
    if (envLocal.includes("10.0.2.2")) {
      warn(
        ".env.local apunta Supabase a 10.0.2.2 (emulador Android): correcto " +
          "para el emulador, pero un `expo export` a mano sin override deja " +
          "el bundle roto en navegador. El harness ya lo tapa con env.",
      );
    }
  }

  const functionsEnv = "supabase/functions/.env";
  if (
    existsSync(functionsEnv) &&
    readFileSync(functionsEnv, "utf8").includes("AI_PROVIDER=fixture")
  ) {
    ok("generate-prayer-plan con AI_PROVIDER=fixture (e2e sin Anthropic)");
  } else {
    warn(
      `${functionsEnv} sin AI_PROVIDER=fixture: el final del onboarding en ` +
        "e2e llamará a Anthropic de verdad (coste y latencia). CI lo fija; " +
        "en local, añádelo si vas a correr fresh-account.",
    );
  }
};

console.log("Doctor del entorno Ammen\n");
checkHeavyNodeProcesses();
await checkPort8081();
if (checkDocker()) {
  checkSeed();
}
await checkAuthHealth();
checkEnvFiles();

if (hardFailure) {
  console.log(
    "\nHay chequeos duros en rojo: el harness no va a arrancar bien.",
  );
  process.exitCode = 1;
} else {
  console.log("\nTodo razonable. Adelante.");
}
