export type FileSize = { file: string; raw: number; gzip: number };

export type ExportMeasurement = {
  entry: FileSize;
  total: { files: number; raw: number; gzip: number };
};

export type BudgetKey = "entryRaw" | "entryGzip" | "totalRaw" | "totalGzip";

export type BudgetRow = {
  key: BudgetKey;
  label: string;
  actual: number;
  limit: number;
  ok: boolean;
  tighterLimit: number | null;
};

export const MARGIN: number;
export const METRICS: {
  key: BudgetKey;
  label: string;
  pick: (measurement: ExportMeasurement) => number;
}[];
export function measureExport(exportDir: string): ExportMeasurement;
export function suggestedLimit(bytes: number): number;
export function checkBudget(
  measurement: ExportMeasurement,
  limits: Partial<Record<BudgetKey, number>> | undefined,
): BudgetRow[];
export function formatTable(rows: BudgetRow[]): string;
