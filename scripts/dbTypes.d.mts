export function compareTypes(
  generated: string,
  committed: string,
): { ok: true } | { ok: false; line: number; expected: string; actual: string };
