#!/usr/bin/env node
import {
  acquireDbLock,
  releaseDbLock,
  startDbLockHeartbeat,
} from "./dbLock.mjs";

const [, , command, durationValue = "0"] = process.argv;
const durationMs = Number(durationValue);
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

if (command === "sleep") {
  await sleep(durationMs);
} else {
  let handle;
  try {
    handle = acquireDbLock(`test-worker-${command}`);
    process.stdout.write("DB_LOCK_TEST_READY\n");

    if (command === "orphan") {
      // Deliberately leave the file behind to exercise dead-PID takeover.
      process.exit(0);
    }

    const stopHeartbeat = startDbLockHeartbeat(handle);
    if (command === "hold") await sleep(durationMs);
    stopHeartbeat();
    releaseDbLock(handle);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
