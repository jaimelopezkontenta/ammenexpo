import {
  execSync,
  spawn,
  spawnSync,
  type ChildProcess,
} from "node:child_process";

/**
 * RDY-07/RDY-08, segundo ciclo de corrección — punto 4.
 *
 * Antes de esta corrección, `e2e/baseline.spec.ts` y
 * `e2e/public-contract.spec.ts` presuponían una base de datos "conocida"
 * que en la práctica dependía de que quien ejecutara los tests hubiera
 * corrido `npx supabase db reset` a mano justo antes — sin eso, un estado
 * sucio de una corrida anterior podía dar un fallo que no tenía nada que
 * ver con el código bajo prueba, y sin ningún mensaje que lo explicara.
 *
 * Este `globalSetup` corre una vez, antes de cualquier test, y hace tres
 * cosas en orden, cada una con su propio diagnóstico si falla:
 *
 * 1. **Lock exclusivo.** `npm run db:test` y Playwright comparten un único
 *    Postgres local; si el otro ya lo tiene en uso, esto falla aquí, con un
 *    mensaje legible, en vez de que ambos peleen por el mismo `db reset` a
 *    mitad de camino.
 * 2. **Healthcheck.** Supabase local tiene que estar arrancado de verdad
 *    (`npx supabase start`) — sin esto, el error de más abajo sería un
 *    timeout genérico de Playwright esperando un puerto, no una frase que
 *    diga qué hacer.
 * 3. **Reset + verificación del seed.** `supabase db reset` deja la base en
 *    el estado conocido que `supabase/seed.sql` describe, y se comprueba
 *    de verdad que la cuenta `prueba@ammen.local` existe después — no basta
 *    con que el comando no haya lanzado: en este mismo proyecto, `db reset`
 *    a veces "falla" en un paso posterior (reinicio de contenedores) que no
 *    afecta al esquema/seed ya aplicados, así que solo el estado real, no
 *    el código de salida del CLI, cuenta como la señal.
 */

const DB_CONTAINER = "supabase_db_ammen";
const SEED_EMAIL = "prueba@ammen.local";

// `execSync`, comando único vía shell — no `execFileSync` con un array de
// argumentos: `npx` en Windows es `npx.cmd`, no un ejecutable que
// `execFileSync` (sin shell) sepa resolver por PATH, y fallaba con `ENOENT`
// antes de llegar siquiera a comprobar si Supabase estaba arrancado.
const run = (command: string): string =>
  execSync(command, { encoding: "utf8" });

type LockHolder = {
  child: ChildProcess;
  token: string;
  lockPath: string;
};

const startLockHolder = async (): Promise<LockHolder> => {
  const child = spawn(
    process.execPath,
    ["scripts/db-lock-cli.mjs", "hold", "playwright"],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    },
  );
  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const ownership = await new Promise<{ token: string; lockPath: string }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("timeout esperando DB_LOCK_READY"));
      }, 10_000);

      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `el holder terminó antes de adquirir el lock (exit ${code})${stderr ? `\n${stderr}` : ""}`,
          ),
        );
      });
      child.on("message", (message: unknown) => {
        if (
          !message ||
          typeof message !== "object" ||
          !("type" in message) ||
          message.type !== "db-lock-ready" ||
          !("token" in message) ||
          typeof message.token !== "string" ||
          !("lockPath" in message) ||
          typeof message.lockPath !== "string"
        ) {
          return;
        }
        clearTimeout(timeout);
        resolve({ token: message.token, lockPath: message.lockPath });
      });
    },
  ).catch(async (caught) => {
    child.kill("SIGTERM");
    throw new Error(
      `[globalSetup] No se pudo reservar la base de datos local:\n${errorOutput(caught)}`,
    );
  });

  return { child, ...ownership };
};

const stopLockHolder = async (holder: LockHolder) => {
  const { child } = holder;

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5_000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  // On Windows, process.kill(SIGTERM) terminates Node without running its
  // signal handler. The parent therefore performs the same token-checked
  // release after the holder is dead. On POSIX this is an idempotent no-op
  // because the holder already released in its handler.
  const release = spawnSync(
    process.execPath,
    ["scripts/db-lock-cli.mjs", "release", holder.token],
    {
      cwd: process.cwd(),
      env: { ...process.env, DB_LOCK_PATH: holder.lockPath },
      encoding: "utf8",
    },
  );
  if (release.status !== 0 && release.status !== 1) {
    throw new Error(
      `[globalTeardown] no se pudo liberar el lock de DB: ${release.stderr}`,
    );
  }
};

const errorOutput = (caught: unknown): string => {
  if (caught && typeof caught === "object" && "stderr" in caught) {
    const stderr = (caught as { stderr?: Buffer | string }).stderr;
    if (stderr) return String(stderr);
  }

  return caught instanceof Error ? caught.message : String(caught);
};

const checkSupabaseIsRunning = () => {
  try {
    run("npx supabase status");
    return;
  } catch (caught) {
    // En este host Windows el binario del CLI a veces lo bloquea Application
    // Control (`spawnSync UNKNOWN`) aunque los contenedores estén sanos. El
    // healthcheck real es el contenedor de Postgres y la puerta de Auth.
    const cliBlocked =
      errorOutput(caught).includes("UNKNOWN") ||
      errorOutput(caught).includes("spawnSync");

    if (!cliBlocked) {
      throw new Error(
        "[globalSetup] Supabase local no está arrancado (o no responde).\n" +
          "  Corre `npx supabase start` (o `npm run db:start`) antes de `npx playwright test`.\n" +
          `  Detalle: ${errorOutput(caught)}`,
      );
    }
  }

  let health: string;
  try {
    health = run(
      `docker inspect -f "{{.State.Health.Status}}" ${DB_CONTAINER}`,
    ).trim();
  } catch (caught) {
    throw new Error(
      "[globalSetup] El CLI de Supabase no arranca y el contenedor " +
        `${DB_CONTAINER} no responde.\n` +
        "  Corre `npx supabase start` (o `npm run db:start`) antes de `npx playwright test`.\n" +
        `  Detalle: ${errorOutput(caught)}`,
    );
  }

  if (health !== "healthy") {
    throw new Error(
      `[globalSetup] ${DB_CONTAINER} está ${health || "sin healthcheck"}, no healthy.\n` +
        "  Corre `npx supabase start` (o `npm run db:start`) antes de `npx playwright test`.",
    );
  }
};

const resetDatabase = () => {
  try {
    // No se comprueba el código de salida como única señal: este mismo
    // proyecto documenta (`docs/runbooks/readiness-local.md`) que `supabase
    // db reset` a veces devuelve un error de un paso posterior al esquema —
    // por eso el siguiente paso verifica el estado real, no este comando.
    run("npx supabase db reset");
  } catch (caught) {
    console.warn(
      "[globalSetup] `supabase db reset` devolvió un error; verificando el estado real de la base antes de decidir si es fatal.\n" +
        `  Detalle: ${errorOutput(caught)}`,
    );
  }
};

const EDGE_CONTAINER = "supabase_edge_runtime_ammen";

const ensureEdgeRuntime = () => {
  try {
    run(`docker start ${EDGE_CONTAINER}`);
  } catch (caught) {
    console.warn(
      `[globalSetup] no se pudo arrancar ${EDGE_CONTAINER}: ${errorOutput(caught)}`,
    );
  }
};

const verifySeedAccountExists = () => {
  let output: string;

  try {
    output = run(
      `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -t -A ` +
        `-c "select count(*) from auth.users where email = '${SEED_EMAIL}'"`,
    );
  } catch (caught) {
    throw new Error(
      "[globalSetup] No se pudo consultar la base tras el reset — el contenedor " +
        `${DB_CONTAINER} no responde.\n` +
        `  Detalle: ${errorOutput(caught)}`,
    );
  }

  const count = Number.parseInt(output.trim(), 10);

  if (count !== 1) {
    throw new Error(
      `[globalSetup] El reset no dejó la cuenta semilla "${SEED_EMAIL}" en el estado esperado ` +
        `(se esperaba 1 fila, se encontraron ${Number.isNaN(count) ? "0 (respuesta ilegible)" : count}).\n` +
        "  Revisa `supabase/seed.sql` y que las migraciones se aplicaron sin error real " +
        "(no solo sin el `LegacyStorageGatewayStatusError` cosmético del paso de reinicio de contenedores).",
    );
  }
};

const AUTH_HEALTH = "http://127.0.0.1:54421/auth/v1/health";
const AUTH_WAIT_MS = 90_000;
const AUTH_POLL_MS = 2_000;

/**
 * `db reset` recrea contenedores. Auth tarda en volver a escuchar y los
 * primeros logins pintan "Algo salió mal" aunque el seed ya esté. Esperar
 * al health de GoTrue evita esa carrera.
 */
const authIsUp = async (deadline: number) => {
  while (Date.now() < deadline) {
    try {
      // Con timeout: si Kong acepta la conexión y se cuelga, sin él cada
      // intento esperaba minutos y el reinicio «a mitad de plazo» no llegaba.
      const response = await fetch(AUTH_HEALTH, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return true;
    } catch {
      // Todavía levantando.
    }
    await new Promise((resolve) => setTimeout(resolve, AUTH_POLL_MS));
  }
  return false;
};

/**
 * Auth, vía Kong, tras el reset. Un `db reset` reinicia GoTrue y a veces Kong
 * se queda con el upstream viejo devolviendo 502 aunque auth esté sano (visto
 * el 2026-08-28 y tres veces el 2026-09-29). El remedio conocido es reiniciar
 * Kong: se aplica solo, una vez, a mitad de plazo, en vez de tumbar la corrida.
 */
const waitForAuth = async () => {
  if (await authIsUp(Date.now() + AUTH_WAIT_MS / 2)) return;

  console.warn(
    "[globalSetup] Auth no responde vía Kong; reiniciando supabase_kong_ammen (upstream viejo tras el reset).",
  );
  try {
    run("docker restart supabase_kong_ammen");
  } catch (caught) {
    console.warn(
      `[globalSetup] no se pudo reiniciar Kong: ${errorOutput(caught)}`,
    );
  }

  if (await authIsUp(Date.now() + AUTH_WAIT_MS)) return;

  throw new Error(
    `[globalSetup] Auth no respondió tras el reset ni tras reiniciar Kong (${AUTH_HEALTH}).`,
  );
};

export default async function globalSetup() {
  const lockHolder = await startLockHolder();

  try {
    checkSupabaseIsRunning();
    resetDatabase();
    ensureEdgeRuntime();
    verifySeedAccountExists();
    await waitForAuth();
  } catch (caught) {
    // El lock no puede sobrevivir a un setup que falló: la próxima corrida
    // — de Playwright o de `npm run db:test` — tiene que poder intentarlo
    // de nuevo, no encontrar el lock de esta que nunca llegó a empezar.
    await stopLockHolder(lockHolder);
    throw caught;
  }

  // Playwright admite que globalSetup devuelva su teardown. La misma
  // instancia de proceso que adquirió el lock permanece viva y enviando
  // heartbeat durante toda la suite; no se finge propiedad con un CLI que
  // adquiere y termina antes de que empiecen los tests.
  return async () => {
    await stopLockHolder(lockHolder);
  };
}
