export type HeaderRule = {
  source: string;
  headers: { key: string; value: string }[];
};

export type CspDirective = { name: string; sources: string[] };

export function stripJsonComments(text: string): string;
export function parseFirebaseJson(text: string): unknown;
export function assertSupportedGlob(glob: string): void;
export function matchesSource(source: string, pathname: string): boolean;
export function hostingHeaderRules(config: unknown): HeaderRule[];
export function headersForPath(
  rules: HeaderRule[],
  pathname: string,
): Record<string, string>;
export function headerValue(
  headers: Record<string, string>,
  name: string,
): string | undefined;
export function parseCsp(policy: string): CspDirective[];
export function serializeCsp(directives: CspDirective[]): string;
export function cspWithExtraSources(
  policy: string,
  extra: Record<string, string[]>,
): string;
export function cspWithReportUri(policy: string, reportUri: string): string;
export function supabaseCspSources(supabaseUrl: string): {
  "connect-src": string[];
  "img-src": string[];
};
export function createHeaderResolver(
  rules: HeaderRule[],
  options?: { supabaseUrl?: string; reportUri?: string },
): (pathname: string) => Record<string, string>;
export function loadHostingHeaderRules(firebaseJsonPath: string): HeaderRule[];
