export const MIGRATION_NAME: RegExp;

export const IMMUTABILITY_EXCEPTIONS: ReadonlyMap<string, string>;

export function checkMigrations(
  current: Map<string, string>,
  base: Map<string, string> | null,
  exceptions?: ReadonlyMap<string, string>,
): string[];
