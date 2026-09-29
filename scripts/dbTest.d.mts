export type DbTestSuite = {
  name: string;
  file: string;
  kind: "sql" | "sh";
  optional?: boolean;
  note?: string;
};

export type DbTestOptions = {
  only: string[] | null;
  noReset: boolean;
  list: boolean;
  help: boolean;
  errors: string[];
};

export const DB_CONTAINER: string;
export const SUITES: ReadonlyArray<DbTestSuite>;
export const USAGE: string;

export function parseArgs(
  argv: ReadonlyArray<string>,
  suites?: ReadonlyArray<{ name: string }>,
): DbTestOptions;

export function selectSuites<T extends { name: string; optional?: boolean }>(
  suites: ReadonlyArray<T>,
  only: ReadonlyArray<string> | null,
): T[];

export function checkSuiteFiles(
  suites: ReadonlyArray<{ name: string; file: string; kind: string }>,
  exists: (file: string) => boolean,
): string[];

export function aliasCommand(name: string): string;

export function checkPackageScripts(
  scripts: Record<string, string>,
  suites?: ReadonlyArray<{ name: string }>,
): string[];

export function formatDuration(milliseconds: number): string;

export function failureLines(output: string): string[];
