export const MIGRATION_NAME: RegExp;

export const IMMUTABILITY_EXCEPTIONS: ReadonlyMap<string, string>;

export const LEGACY_EDITS: ReadonlyMap<string, number>;

export function checkMigrations(
  current: Map<string, string>,
  base: Map<string, string> | null,
  exceptions?: ReadonlyMap<string, string>,
): string[];

export function checkHistory(
  events: ReadonlyArray<{ file: string; status: string }>,
  legacy?: ReadonlyMap<string, number>,
): string[];

export function parseNameStatus(
  output: string,
): Array<{ file: string; status: string }>;
