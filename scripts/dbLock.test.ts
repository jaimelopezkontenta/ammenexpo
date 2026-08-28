import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { acquireDbLock, releaseDbLock } from "./dbLock.mjs";

type LockMetadata = {
  token: string;
  pid: number;
  hostname: string;
  owner: string;
  acquiredAt: number;
  heartbeatAt: number;
};

const scratchDirectories: string[] = [];

const lockPathForTest = () => {
  // En el tmp del sistema y NO bajo el proyecto: el watcher de Metro en
  // Windows (FallbackWatcher) recorre todos los directorios del root y moría
  // con ENOENT cuando estos scratch aparecían y desaparecían en mitad de un
  // run de vitest — el blockList del resolver no protege ese recorrido.
  const directory = path.resolve(tmpdir(), "ammen-db-lock-tests", randomUUID());
  mkdirSync(directory, { recursive: true });
  scratchDirectories.push(directory);
  return path.join(directory, "db.lock");
};

const workerEnvironment = (
  lockPath: string,
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv => ({
  ...process.env,
  DB_LOCK_PATH: lockPath,
  ...overrides,
});

const waitForReady = async (child: ChildProcess) => {
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`worker timeout\n${stderr}`)),
      5_000,
    );
    const poll = setInterval(() => {
      if (!stdout.includes("DB_LOCK_TEST_READY")) return;
      clearTimeout(timeout);
      clearInterval(poll);
      resolve();
    }, 5);
    child.once("exit", (code) => {
      if (stdout.includes("DB_LOCK_TEST_READY")) return;
      clearTimeout(timeout);
      clearInterval(poll);
      reject(new Error(`worker exited ${code}\n${stderr}`));
    });
  });
};

const waitForExit = (child: ChildProcess) =>
  new Promise<number | null>((resolve) => {
    if (child.exitCode !== null) {
      resolve(child.exitCode);
      return;
    }
    child.once("exit", resolve);
  });

const readMetadata = (lockPath: string): LockMetadata =>
  JSON.parse(readFileSync(lockPath, "utf8")) as LockMetadata;

const readMetadataEventually = async (lockPath: string) => {
  const startedAt = Date.now();
  while (true) {
    try {
      return readMetadata(lockPath);
    } catch (error) {
      if (Date.now() - startedAt > 1_000) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
};

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("atomic database lock", () => {
  it("provides real cross-process exclusion", async () => {
    const lockPath = lockPathForTest();
    const holder = spawn(
      process.execPath,
      ["scripts/dbLockTestWorker.mjs", "hold", "300"],
      {
        cwd: process.cwd(),
        env: workerEnvironment(lockPath),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    await waitForReady(holder);

    const contender = spawnSync(
      process.execPath,
      ["scripts/dbLockTestWorker.mjs", "once"],
      {
        cwd: process.cwd(),
        env: workerEnvironment(lockPath),
        encoding: "utf8",
      },
    );

    expect(contender.status).toBe(1);
    expect(contender.stderr).toContain("ya está en uso");
    expect(await waitForExit(holder)).toBe(0);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("never releases a lock whose token belongs to somebody else", () => {
    const lockPath = lockPathForTest();
    const original = acquireDbLock("original", { lockPath });
    const now = Date.now();
    const foreign: LockMetadata = {
      token: randomUUID(),
      pid: process.pid,
      hostname: hostname(),
      owner: "foreign",
      acquiredAt: now,
      heartbeatAt: now,
    };
    writeFileSync(lockPath, `${JSON.stringify(foreign)}\n`, "utf8");

    expect(releaseDbLock(original)).toBe(false);
    expect(readMetadata(lockPath).token).toBe(foreign.token);
    expect(releaseDbLock({ token: foreign.token, lockPath })).toBe(true);
  });

  it("takes over a fresh-looking lock when its same-host PID is dead", async () => {
    const lockPath = lockPathForTest();
    const orphan = spawn(
      process.execPath,
      ["scripts/dbLockTestWorker.mjs", "orphan"],
      {
        cwd: process.cwd(),
        env: workerEnvironment(lockPath, { DB_LOCK_STALE_MS: "60000" }),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    await waitForReady(orphan);
    expect(await waitForExit(orphan)).toBe(0);

    const replacement = acquireDbLock("replacement", {
      lockPath,
      staleAfterMs: 60_000,
    });
    expect(replacement.token).not.toBe("");
    expect(releaseDbLock(replacement)).toBe(true);
  });

  it("takes over an expired heartbeat from a host it cannot probe", () => {
    const lockPath = lockPathForTest();
    const old = Date.now() - 10_000;
    const stale: LockMetadata = {
      token: randomUUID(),
      pid: 12345,
      hostname: "unreachable-test-host",
      owner: "stale-owner",
      acquiredAt: old,
      heartbeatAt: old,
    };
    writeFileSync(lockPath, `${JSON.stringify(stale)}\n`, "utf8");

    const replacement = acquireDbLock("replacement", {
      lockPath,
      staleAfterMs: 50,
    });

    expect(replacement.token).not.toBe(stale.token);
    expect(releaseDbLock(replacement)).toBe(true);
  });

  it("heartbeats through an operation longer than the stale threshold", async () => {
    const lockPath = lockPathForTest();
    const environment = workerEnvironment(lockPath, {
      DB_LOCK_STALE_MS: "80",
      DB_LOCK_HEARTBEAT_MS: "20",
    });
    const wrapper = spawn(
      process.execPath,
      [
        "scripts/with-db-lock.mjs",
        "node scripts/dbLockTestWorker.mjs sleep 350",
      ],
      {
        cwd: process.cwd(),
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const startedAt = Date.now();
    while (!existsSync(lockPath)) {
      if (Date.now() - startedAt > 5_000) throw new Error("lock not created");
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const firstHeartbeat = (await readMetadataEventually(lockPath)).heartbeatAt;
    await new Promise((resolve) => setTimeout(resolve, 180));
    const laterHeartbeat = (await readMetadataEventually(lockPath)).heartbeatAt;

    const contender = spawnSync(
      process.execPath,
      ["scripts/dbLockTestWorker.mjs", "once"],
      { cwd: process.cwd(), env: environment, encoding: "utf8" },
    );

    expect(laterHeartbeat).toBeGreaterThan(firstHeartbeat);
    expect(contender.status).toBe(1);
    expect(await waitForExit(wrapper)).toBe(0);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("aborts the child immediately when heartbeat ownership is lost", async () => {
    const lockPath = lockPathForTest();
    const environment = workerEnvironment(lockPath, {
      DB_LOCK_STALE_MS: "500",
      DB_LOCK_HEARTBEAT_MS: "20",
    });
    const startedAt = Date.now();
    const wrapper = spawn(
      process.execPath,
      [
        "scripts/with-db-lock.mjs",
        "node scripts/dbLockTestWorker.mjs sleep 5000",
      ],
      {
        cwd: process.cwd(),
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    while (!existsSync(lockPath)) {
      if (Date.now() - startedAt > 5_000) throw new Error("lock not created");
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await readMetadataEventually(lockPath);
    const now = Date.now();
    const foreign: LockMetadata = {
      token: randomUUID(),
      pid: process.pid,
      hostname: hostname(),
      owner: "replacement-owner",
      acquiredAt: now,
      heartbeatAt: now,
    };
    writeFileSync(lockPath, `${JSON.stringify(foreign)}\n`, "utf8");

    expect(await waitForExit(wrapper)).toBe(1);
    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(readMetadata(lockPath).token).toBe(foreign.token);
    expect(releaseDbLock({ token: foreign.token, lockPath })).toBe(true);
  });
});
