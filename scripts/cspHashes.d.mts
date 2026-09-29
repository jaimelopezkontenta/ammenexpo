export type InlineScript = { name: string; content: string; hash: string };

export const HYDRATION_FLAG_SCRIPT: string;
export function cspHash(content: string): string;
export function extractThemeBootScript(htmlTsxSource: string): string;
export function expectedInlineScripts(htmlTsxSource: string): InlineScript[];
export function documentCsp(firebaseConfig: unknown): string | undefined;
export function cspProblems(
  policy: string | undefined,
  expected: InlineScript[],
): string[];
export function inlineScripts(html: string): string[];
export function blockedInlineScripts(
  exportDir: string,
  policy: string,
): { file: string; hash: string; preview: string }[];
