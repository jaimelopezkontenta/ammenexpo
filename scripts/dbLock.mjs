#!/usr/bin/env node
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
  writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * El lock es de LA BASE, no del árbol de trabajo. Con `git worktree` (o varios
 * agentes a la vez) cada carpeta tenía su propio `.tmp/db.lock` y, sin embargo,
 * todas hablan con los mismos contenedores de Docker (`project_id` igual, mismo
 * puerto): un `db:test` o un e2e en una carpeta reseteaba la base bajo la suite
 * de otra, y el lock no se enteraba. Por eso vive en el directorio temporal de
 * la máquina y se nombra por `project_id`: quien comparta pila, comparte lock.
 */
export const parseProjectId = (config) => {
  const match = /^\s*project_id\s*=\s*"([^"]+)"/mu.exec(config);
  return match ? match[1].replace(/[^A-Za-z0-9_.-]/gu, "_") : null;
};

const projectId = () => {
  try {
    const config = readFileSync(
      path.resolve(process.cwd(), "supabase", "config.toml"),
      "utf8",
    );
    const parsed = parseProjectId(config);
    if (parsed) return parsed;
  } catch {
    // Sin config.toml (un test, otra carpeta): el nombre de siempre.
  }
  return "ammen";
};

const DEFAULT_LOCK_PATH = path.join(tmpdir(), `ammen-db-${projectId()}.lock`);
const DEFAULT_STALE_AFTER_MS = 10 * 60 * 1000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15 * 1000;

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const configFor = (options = {}) => ({
  lockPath: path.resolve(
    options.lockPath ?? process.env.DB_LOCK_PATH ?? DEFAULT_LOCK_PATH,
  ),
  staleAfterMs: positiveNumber(
    options.staleAfterMs ?? process.env.DB_LOCK_STALE_MS,
    DEFAULT_STALE_AFTER_MS,
  ),
  heartbeatIntervalMs: positiveNumber(
    options.heartbeatIntervalMs ?? process.env.DB_LOCK_HEARTBEAT_MS,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
  ),
});

export const LOCK_PATH = configFor().lockPath;
export const STALE_AFTER_MS = configFor().staleAfterMs;
export const HEARTBEAT_INTERVAL_MS = configFor().heartbeatIntervalMs;

const parseMetadata = (raw) => {
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.token !== "string" ||
      typeof value.pid !== "number" ||
      typeof value.hostname !== "string" ||
      typeof value.owner !== "string" ||
      typeof value.acquiredAt !== "number" ||
      typeof value.heartbeatAt !== "number"
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
};

const readSnapshot = (lockPath) => {
  try {
    const raw = readFileSync(lockPath, "utf8");
    const stats = statSync(lockPath);
    return { raw, metadata: parseMetadata(raw), modifiedAt: stats.mtimeMs };
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const processIsAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means that a process exists but this user cannot signal it.
    return Boolean(
      error && typeof error === "object" && error.code === "EPERM",
    );
  }
};

const snapshotIsStale = (snapshot, staleAfterMs) => {
  const metadata = snapshot.metadata;
  const lastHeartbeat = metadata?.heartbeatAt ?? snapshot.modifiedAt;

  if (metadata?.hostname === hostname()) {
    // On the same machine PID liveness is stronger than wall-clock age. It
    // also protects a legitimate long operation if its heartbeat is delayed.
    return !processIsAlive(metadata.pid);
  }

  // Locks from another host (for example a shared workspace) cannot be
  // signalled portably, so only a genuinely old heartbeat permits takeover.
  return Date.now() - lastHeartbeat > staleAfterMs;
};

const restoreForeignSnapshot = (quarantinePath, lockPath) => {
  if (existsSync(lockPath)) return;
  try {
    renameSync(quarantinePath, lockPath);
  } catch {
    // A contender may have installed a new lock. Never overwrite it.
  }
};

/**
 * Moves exactly the stale bytes that were inspected away from the lock path.
 * `rename` + byte comparison prevents the classic read/unlink/create TOCTOU:
 * a lock that changed after inspection is restored, never deleted.
 */
const quarantineStaleSnapshot = (lockPath, snapshot) => {
  const quarantinePath = `${lockPath}.stale.${process.pid}.${randomUUID()}`;

  try {
    renameSync(lockPath, quarantinePath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  let movedRaw;
  try {
    movedRaw = readFileSync(quarantinePath, "utf8");
  } catch {
    restoreForeignSnapshot(quarantinePath, lockPath);
    return false;
  }

  if (movedRaw !== snapshot.raw) {
    restoreForeignSnapshot(quarantinePath, lockPath);
    return false;
  }

  rmSync(quarantinePath, { force: true });
  return true;
};

const lockError = (snapshot, lockPath) => {
  const metadata = snapshot.metadata;
  const heartbeat = metadata?.heartbeatAt ?? snapshot.modifiedAt;
  const ageSeconds = Math.max(0, Math.round((Date.now() - heartbeat) / 1000));
  const owner = metadata?.owner ?? "desconocido";
  const pid = metadata?.pid ?? "desconocido";
  const host = metadata?.hostname ?? "desconocido";

  return new Error(
    "\n✖ La base de datos local ya está en uso por otro proceso.\n" +
      `  Dueño: ${owner} (PID ${pid}, host ${host}); último heartbeat hace ${ageSeconds}s.\n` +
      "  `npm run db:test` y Playwright comparten un solo Postgres local y no\n" +
      "  pueden correr a la vez. Espera a que termine el dueño; un lock con PID\n" +
      "  muerto o heartbeat realmente stale se recupera automáticamente.\n" +
      `  Lock: ${lockPath}\n`,
  );
};

const writeExclusiveLock = (lockPath, metadata) => {
  const descriptor = openSync(lockPath, "wx", 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  } finally {
    closeSync(descriptor);
  }
};

export const acquireDbLock = (owner, options = {}) => {
  const config = configFor(options);
  mkdirSync(path.dirname(config.lockPath), { recursive: true });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const now = Date.now();
    const metadata = {
      token: randomUUID(),
      pid: process.pid,
      hostname: hostname(),
      owner: String(owner || "unknown"),
      acquiredAt: now,
      heartbeatAt: now,
    };

    try {
      // `wx` maps to O_CREAT|O_EXCL: exactly one contender can create it.
      writeExclusiveLock(config.lockPath, metadata);
      return {
        token: metadata.token,
        lockPath: config.lockPath,
        owner: metadata.owner,
        pid: metadata.pid,
        hostname: metadata.hostname,
        acquiredAt: metadata.acquiredAt,
        heartbeatIntervalMs: config.heartbeatIntervalMs,
      };
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "EEXIST") {
        throw error;
      }
    }

    const snapshot = readSnapshot(config.lockPath);
    if (!snapshot) continue;
    if (!snapshotIsStale(snapshot, config.staleAfterMs)) {
      throw lockError(snapshot, config.lockPath);
    }
    quarantineStaleSnapshot(config.lockPath, snapshot);
  }

  throw new Error(`No se pudo adquirir el lock atómico ${config.lockPath}`);
};

export const heartbeatDbLock = (handle) => {
  let descriptor;
  try {
    descriptor = openSync(handle.lockPath, "r+");
    const raw = readFileSync(descriptor, "utf8");
    const metadata = parseMetadata(raw);
    if (!metadata || metadata.token !== handle.token) return false;

    const next = { ...metadata, heartbeatAt: Date.now() };
    ftruncateSync(descriptor, 0);
    writeSync(descriptor, `${JSON.stringify(next, null, 2)}\n`, 0, "utf8");
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
};

export const startDbLockHeartbeat = (handle, options = {}) => {
  const intervalMs = positiveNumber(
    options.intervalMs,
    handle.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
  );
  const onError = options.onError ?? (() => {});
  const timer = setInterval(() => {
    try {
      if (!heartbeatDbLock(handle)) {
        onError(new Error("El lock de DB ya no pertenece a este proceso"));
      }
    } catch (error) {
      onError(error);
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
};

export const releaseDbLock = (handle) => {
  const snapshot = readSnapshot(handle.lockPath);
  if (!snapshot?.metadata || snapshot.metadata.token !== handle.token) {
    return false;
  }

  // Renombrar primero permite volver a verificar el token sobre exactamente
  // el inode que se va a borrar. Si cambió, se restaura y no se toca lo ajeno.
  const releasePath = `${handle.lockPath}.release.${process.pid}.${randomUUID()}`;
  try {
    renameSync(handle.lockPath, releasePath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  const moved = readSnapshot(releasePath);
  if (!moved?.metadata || moved.metadata.token !== handle.token) {
    restoreForeignSnapshot(releasePath, handle.lockPath);
    return false;
  }

  rmSync(releasePath, { force: true });
  return true;
};

/**
 * ¿El lock vigente es el de este token? Lo usa quien corre DENTRO de
 * `with-db-lock.mjs` (que exporta `DB_LOCK_TOKEN` y `DB_LOCK_PATH` a su hijo)
 * para no intentar cogerlo otra vez: el dueño está vivo y el segundo intento
 * fallaría con «ya está en uso».
 */
export const dbLockHeldBy = (token, options = {}) => {
  if (!token) return false;
  const snapshot = readSnapshot(configFor(options).lockPath);
  return snapshot?.metadata?.token === token;
};

export const isDbLockHeld = (options = {}) => {
  const config = configFor(options);
  const snapshot = readSnapshot(config.lockPath);
  return Boolean(snapshot && !snapshotIsStale(snapshot, config.staleAfterMs));
};
