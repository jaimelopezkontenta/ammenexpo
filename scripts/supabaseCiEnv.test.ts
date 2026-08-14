import { describe, expect, it } from "vitest";

import {
  githubEnvironmentBlock,
  parseSupabaseStatusEnv,
} from "./supabaseCiEnv.mjs";

describe("Supabase CI environment export", () => {
  const statusOutput = [
    'API_URL="http://127.0.0.1:54321"',
    'ANON_KEY="public-anon-value"',
    'SERVICE_ROLE_KEY="must-never-be-exported"',
    'SECRET_KEY="must-never-be-exported-either"',
  ].join("\n");

  it("selects only the Expo public URL and anon key", () => {
    expect(parseSupabaseStatusEnv(statusOutput)).toEqual({
      EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-anon-value",
    });
  });

  it("writes a GitHub environment block without privileged keys", () => {
    const block = githubEnvironmentBlock(parseSupabaseStatusEnv(statusOutput));

    expect(block).toContain("EXPO_PUBLIC_SUPABASE_URL<<");
    expect(block).toContain("EXPO_PUBLIC_SUPABASE_ANON_KEY<<");
    expect(block).not.toContain("SERVICE_ROLE");
    expect(block).not.toContain("SECRET_KEY");
    expect(block).not.toContain("must-never-be-exported");
  });

  it("fails closed when a required public value is absent", () => {
    expect(() => parseSupabaseStatusEnv('API_URL="http://local"')).toThrow(
      "ANON_KEY",
    );
  });
});
