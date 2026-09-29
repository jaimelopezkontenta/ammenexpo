export type DbLockOptions = {
  lockPath?: string;
  staleAfterMs?: number;
  heartbeatIntervalMs?: number;
};

export type DbLockHandle = {
  token: string;
  lockPath: string;
  owner: string;
  pid: number;
  hostname: string;
  acquiredAt: number;
  heartbeatIntervalMs: number;
};

export const LOCK_PATH: string;
export const STALE_AFTER_MS: number;
export const HEARTBEAT_INTERVAL_MS: number;
export function acquireDbLock(
  owner: string,
  options?: DbLockOptions,
): DbLockHandle;
export function heartbeatDbLock(handle: DbLockHandle): boolean;
export function startDbLockHeartbeat(
  handle: DbLockHandle,
  options?: { intervalMs?: number; onError?: (error: unknown) => void },
): () => void;
export function releaseDbLock(
  handle: Pick<DbLockHandle, "token" | "lockPath">,
): boolean;
export function isDbLockHeld(options?: DbLockOptions): boolean;
export function dbLockHeldBy(
  token: string | undefined,
  options?: DbLockOptions,
): boolean;
