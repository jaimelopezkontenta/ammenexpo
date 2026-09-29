import { describe, expect, it } from "vitest";

import {
  EDGE_SECRETS,
  ENVIRONMENTS,
  LOCAL_ONLY_KEYS,
  gcpSecretName,
  parseArgs,
  parseEnvFile,
  redactSecrets,
  resolveTargets,
  selectSecrets,
  serializeEnvFile,
  supabaseEnvName,
  valuesForCatalog,
} from "./secretsSync.mjs";

describe("secretsSync catalog", () => {
  it("maps GCP secret names 1:1 to Edge env vars", () => {
    for (const key of EDGE_SECRETS) {
      expect(gcpSecretName(key)).toBe(key);
      expect(supabaseEnvName(key)).toBe(key);
    }
  });

  it("covers the email and documented remote Edge secrets", () => {
    expect(EDGE_SECRETS).toEqual([
      "RESEND_API_KEY",
      "RESEND_WEBHOOK_SECRET",
      "EMAIL_ALLOWLIST",
      "EMAIL_SENDER_ENABLED",
      "EMAIL_APP_ORIGIN",
      "AMMEN_EMAIL_INVOKE_SECRET",
      "ANTHROPIC_API_KEY",
      "PUSH_SENDER_ENABLED",
      "AMMEN_PUSH_INVOKE_SECRET",
    ]);
  });

  it("keeps LM Studio out of the remote catalog", () => {
    expect(LOCAL_ONLY_KEYS).toEqual([
      "UNSLOTH_URL",
      "UNSLOTH_MODEL",
      "UNSLOTH_API_KEY",
    ]);
    for (const key of LOCAL_ONLY_KEYS) {
      expect(EDGE_SECRETS).not.toContain(key);
    }
  });

  it("points staging at the Firebase/GCP project and known Supabase ref", () => {
    expect(ENVIRONMENTS.staging).toEqual({
      gcpProject: "ammen-staging",
      supabaseProjectRef: "syprzdjznuppckenuaua",
    });
  });
});

describe("secretsSync parseArgs", () => {
  it("defaults to pull without inventing a second environment", () => {
    expect(parseArgs([])).toMatchObject({
      command: "pull",
      dryRun: false,
      env: undefined,
    });
  });

  it("treats seed as push", () => {
    expect(parseArgs(["seed", "--env-file", "local.env"]).command).toBe("push");
  });

  it("accepts --project as alias of --gcp-project", () => {
    expect(parseArgs(["--project", "ammen-staging"]).gcpProject).toBe(
      "ammen-staging",
    );
  });

  it("fails closed on an unknown command or flag", () => {
    expect(() => parseArgs(["vault"])).toThrow(/desconocido/);
    expect(() => parseArgs(["pull", "--doppler"])).toThrow(/flag desconocido/);
  });
});

describe("secretsSync env files", () => {
  it("parses dotenv without leaking extra keys into the catalog set", () => {
    const parsed = parseEnvFile(
      [
        "# comentario",
        "export RESEND_API_KEY=re_test",
        'EMAIL_ALLOWLIST="jaime@ammen.app"',
        "UNSLOTH_URL=http://host.docker.internal:8888/v1",
        "IGNORED_LINE",
        "",
      ].join("\n"),
    );

    expect(parsed.get("RESEND_API_KEY")).toBe("re_test");
    expect(parsed.get("EMAIL_ALLOWLIST")).toBe("jaime@ammen.app");
    expect(parsed.get("UNSLOTH_URL")).toContain("host.docker.internal");
  });

  it("refuses empty catalog values and skips local-only keys", () => {
    const parsed = parseEnvFile(
      [
        "RESEND_API_KEY=re_test",
        "UNSLOTH_MODEL=unsloth/Qwen3.8-27B-GGUF",
        "ANTHROPIC_API_KEY=",
      ].join("\n"),
    );

    expect(() =>
      valuesForCatalog(parsed, ["RESEND_API_KEY", "ANTHROPIC_API_KEY"]),
    ).toThrow(/ANTHROPIC_API_KEY/);

    const { selected, skipped } = valuesForCatalog(parsed, ["RESEND_API_KEY"]);
    expect([...selected.keys()]).toEqual(["RESEND_API_KEY"]);
    expect(skipped).toContain("UNSLOTH_MODEL");
  });

  it("round-trips values without printing them", () => {
    const original = new Map([
      ["RESEND_API_KEY", 're_with"quote'],
      ["EMAIL_ALLOWLIST", "a@ammen.app,b@ammen.app"],
    ]);
    const parsed = parseEnvFile(serializeEnvFile(original));
    expect(parsed.get("RESEND_API_KEY")).toBe('re_with"quote');
    expect(parsed.get("EMAIL_ALLOWLIST")).toBe("a@ammen.app,b@ammen.app");
  });
});

describe("secretsSync selectSecrets", () => {
  it("rejects the local Unsloth keys and unknown names", () => {
    expect(() => selectSecrets("UNSLOTH_URL")).toThrow(/solo local/);
    expect(() => selectSecrets("NOT_A_SECRET")).toThrow(/catálogo/);
  });

  it("narrows the catalog with --only", () => {
    expect(selectSecrets("RESEND_API_KEY,EMAIL_ALLOWLIST")).toEqual([
      "RESEND_API_KEY",
      "EMAIL_ALLOWLIST",
    ]);
  });
});

describe("secretsSync resolveTargets", () => {
  const isolatedEnv = (): NodeJS.ProcessEnv => ({
    ...process.env,
    AMMEN_ENV: undefined,
    AMMEN_GCP_PROJECT: undefined,
    AMMEN_SUPABASE_PROJECT_REF: undefined,
  });

  it("defaults staging to ammen-staging / the documented Supabase ref", () => {
    expect(resolveTargets({}, { env: isolatedEnv() })).toEqual({
      environment: "staging",
      gcpProject: "ammen-staging",
      supabaseProjectRef: "syprzdjznuppckenuaua",
    });
  });

  it("does not invent production: unknown --env needs both ids", () => {
    expect(() =>
      resolveTargets({ env: "prod" }, { env: isolatedEnv() }),
    ).toThrow(/no hay mapeo/);

    expect(
      resolveTargets(
        {
          env: "prod",
          gcpProject: "ammen-prod",
          projectRef: "abcdefghijabcdefghij",
        },
        { env: isolatedEnv() },
      ),
    ).toMatchObject({
      gcpProject: "ammen-prod",
      supabaseProjectRef: "abcdefghijabcdefghij",
    });
  });

  it("prefers the documented staging ref over a stray local link", () => {
    expect(
      resolveTargets(
        {},
        { linkedRef: "linkedreflinkedrefxx", env: isolatedEnv() },
      ).supabaseProjectRef,
    ).toBe("syprzdjznuppckenuaua");
  });

  it("prefers an explicit project-ref over the linked fallback", () => {
    expect(
      resolveTargets(
        { projectRef: "explicitrefexplicitref" },
        { linkedRef: "linkedreflinkedrefxx", env: isolatedEnv() },
      ).supabaseProjectRef,
    ).toBe("explicitrefexplicitref");
  });
});

describe("secretsSync redact", () => {
  it("never leaves a secret value in a child-process error", () => {
    expect(
      redactSecrets("failed re_live_super_secret in gcloud", [
        "re_live_super_secret",
      ]),
    ).toBe("failed *** in gcloud");
  });
});
