#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { constants as osConstants } from "node:os";

import {
  acquireDbLock,
  releaseDbLock,
  startDbLockHeartbeat,
} from "./dbLock.mjs";

const command = process.argv.slice(2).join(" ");

const terminateChildTree = (child, signal = "SIGTERM") => {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return;

  if (process.platform === "win32") {
    const killed = spawnSync(
      "taskkill",
      ["/pid", String(child.pid), "/t", "/f"],
      { stdio: "ignore", windowsHide: true },
    );
    if (killed.status === 0) return;
  } else {
    try {
      // The shell is started as its own process group below, so this reaches
      // both the shell and the actual command rather than orphaning a reset.
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to the portable direct-child fallback.
    }
  }

  try {
    child.kill(signal);
  } catch {
    // `close` may have won the race; there is nothing left to terminate.
  }
};

if (!command) {
  console.error("Usage: node scripts/with-db-lock.mjs <command...>");
  process.exitCode = 1;
} else {
  let handle;
  try {
    handle = acquireDbLock(process.env.DB_LOCK_OWNER ?? "npm run db:test");
  } catch (caught) {
    console.error(caught instanceof Error ? caught.message : caught);
    process.exitCode = 1;
  }

  if (handle) {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
      // El hijo sabe que ya corre dentro del lock (y de cuál): así
      // `dbTest.mjs --only x` no intenta cogerlo otra vez.
      env: {
        ...process.env,
        DB_LOCK_TOKEN: handle.token,
        DB_LOCK_PATH: handle.lockPath,
      },
      detached: process.platform !== "win32",
    });
    let heartbeatFailure = false;
    const stopHeartbeat = startDbLockHeartbeat(handle, {
      onError: (error) => {
        if (heartbeatFailure) return;
        heartbeatFailure = true;
        console.error("db lock heartbeat failed", error);
        // Perder el token significa perder el derecho a seguir tocando la DB.
        // No se espera a que el comando termine por sí solo.
        terminateChildTree(child);
      },
    });
    let forwardedSignal;
    const forward = (signal) => {
      forwardedSignal = signal;
      terminateChildTree(child, signal);
    };

    const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
    const signalHandlers = new Map(
      signals.map((signal) => [signal, () => forward(signal)]),
    );
    for (const [signal, handler] of signalHandlers) {
      process.once(signal, handler);
    }

    try {
      const outcome = await new Promise((resolve) => {
        child.once("error", (error) => resolve({ error }));
        child.once("close", (code, signal) => resolve({ code, signal }));
      });

      if ("error" in outcome) {
        console.error("No se pudo iniciar el comando protegido", outcome.error);
        process.exitCode = 1;
      } else if (heartbeatFailure) {
        process.exitCode = 1;
      } else if (outcome.code !== null) {
        process.exitCode = outcome.code;
      } else {
        const signal = outcome.signal ?? forwardedSignal;
        const signalNumber = signal ? osConstants.signals[signal] : undefined;
        process.exitCode = signalNumber ? 128 + signalNumber : 1;
      }
    } finally {
      for (const [signal, handler] of signalHandlers) {
        process.removeListener(signal, handler);
      }
      stopHeartbeat();
      if (!releaseDbLock(handle)) {
        console.error("No se liberó el lock: el token ya no coincide");
        process.exitCode = process.exitCode || 1;
      }
    }
  }
}
