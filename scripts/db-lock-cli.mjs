#!/usr/bin/env node
import {
  acquireDbLock,
  isDbLockHeld,
  releaseDbLock,
  startDbLockHeartbeat,
} from "./dbLock.mjs";

const [, , command, ownerOrToken] = process.argv;

try {
  if (command === "hold") {
    const handle = acquireDbLock(ownerOrToken ?? "unknown");
    const stopHeartbeat = startDbLockHeartbeat(handle, {
      onError: (error) => {
        console.error("db lock heartbeat failed", error);
        cleanup(1);
      },
    });
    let finished = false;

    function cleanup(exitCode) {
      if (finished) return;
      finished = true;
      stopHeartbeat();
      releaseDbLock(handle);
      process.exit(exitCode);
    }

    process.once("SIGINT", () => cleanup(130));
    process.once("SIGTERM", () => cleanup(0));
    process.once("SIGHUP", () => cleanup(129));
    process.send?.({
      type: "db-lock-ready",
      token: handle.token,
      lockPath: handle.lockPath,
    });
    process.stdout.write("DB_LOCK_READY\n");
    // Keep the owner process alive; the heartbeat timer is intentionally
    // unref'ed for library users, so this is the holder's explicit lifetime.
    setInterval(() => {}, 60_000);
  } else if (command === "release") {
    if (!ownerOrToken) throw new Error("release requiere el token del dueño");
    const lockPath = process.env.DB_LOCK_PATH;
    if (!lockPath) throw new Error("release requiere DB_LOCK_PATH");
    if (!releaseDbLock({ token: ownerOrToken, lockPath })) process.exitCode = 1;
  } else if (command === "check") {
    if (isDbLockHeld()) throw new Error("db lock is held");
  } else {
    throw new Error(
      `db-lock-cli: unknown command "${command}" — usa hold, release o check`,
    );
  }
} catch (caught) {
  console.error(caught instanceof Error ? caught.message : caught);
  process.exitCode = 1;
}
