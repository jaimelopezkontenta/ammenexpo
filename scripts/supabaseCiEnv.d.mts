export type ExpoPublicSupabaseEnvironment = {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
};

export function parseSupabaseStatusEnv(
  output: string,
): ExpoPublicSupabaseEnvironment;
export function githubEnvironmentBlock(
  environment: ExpoPublicSupabaseEnvironment,
): string;
