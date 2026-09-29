import { describe, expect, it } from "vitest";

import {
  authorizeInvoker,
  isAllowlisted,
  resolveEmailSenderConfig,
} from "./config.ts";

describe("resolveEmailSenderConfig", () => {
  it("kills the sender without leasing anything", () => {
    expect(
      resolveEmailSenderConfig({
        EMAIL_SENDER_ENABLED: "false",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        RESEND_API_KEY: "re_test",
      }),
    ).toEqual({ enabled: false, reason: "kill_switch" });
  });

  it("fails closed when the Resend key is missing", () => {
    expect(
      resolveEmailSenderConfig({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).toEqual({ enabled: false, reason: "not_configured" });
  });

  it("parses a staging allowlist", () => {
    const config = resolveEmailSenderConfig({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      RESEND_API_KEY: "re_test",
      EMAIL_ALLOWLIST: "jaime@ammen.app, zoe@ammen.app",
    });

    expect(config.enabled).toBe(true);
    if (config.enabled) {
      expect(config.allowlist).toEqual(["jaime@ammen.app", "zoe@ammen.app"]);
    }
  });
});

describe("allowlist", () => {
  it("lets everyone through when unset", () => {
    expect(isAllowlisted("anyone@example.com", null)).toBe(true);
  });

  it("blocks a recipient outside staging", () => {
    expect(isAllowlisted("stranger@example.com", ["jaime@ammen.app"])).toBe(
      false,
    );
  });
});

describe("authorizeInvoker", () => {
  const LOCAL = "http://kong:8000";
  const REMOTE = "https://syprzdjznuppckenuaua.supabase.co";

  it("does not require a header locally when the secret is empty", () => {
    expect(authorizeInvoker(null, "  ", LOCAL)).toBe("not_required");
  });

  it("fails closed outside local when the secret is missing", () => {
    expect(authorizeInvoker(null, "  ", REMOTE)).toBe("unauthorized");
    expect(authorizeInvoker("anything", undefined, REMOTE)).toBe(
      "unauthorized",
    );
    expect(authorizeInvoker(null, undefined, undefined)).toBe("unauthorized");
  });

  it("rejects a mismatch without echoing the secret", () => {
    expect(authorizeInvoker("nope", "secret", REMOTE)).toBe("unauthorized");
  });
});
