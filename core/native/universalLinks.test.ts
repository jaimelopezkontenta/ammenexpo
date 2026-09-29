import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

// CommonJS (lo lee app.config.js en Node): se carga con el require de Node.
const require = createRequire(import.meta.url);
const { normalizeLinkHost, universalLinkConfig } =
  require("./universalLinks.js") as typeof import("./universalLinks.js");
const appConfig = require("../../app.config.js") as (context: {
  config: Record<string, unknown>;
}) => {
  ios: Record<string, unknown>;
  android: Record<string, unknown>;
};

const ENV_KEY = "EXPO_PUBLIC_UNIVERSAL_LINK_HOST";
// Acceso literal: la regla de Expo (no-dynamic-env-var) no deja indexar
// process.env con una variable.
const original = process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST;

afterEach(() => {
  if (original === undefined)
    delete process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST;
  else process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST = original;
});

describe("universalLinkConfig", () => {
  it("adds nothing while there is no domain", () => {
    expect(universalLinkConfig({})).toEqual({ ios: {}, android: {} });
    expect(universalLinkConfig({ [ENV_KEY]: "  " })).toEqual({
      ios: {},
      android: {},
    });
  });

  it("declares the iOS associated domain and a verified Android filter for /p/ and /c/", () => {
    const links = universalLinkConfig({ [ENV_KEY]: "ammen.app" });

    expect(links.ios).toEqual({ associatedDomains: ["applinks:ammen.app"] });
    expect(links.android.intentFilters).toEqual([
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "ammen.app", pathPrefix: "/p/" },
          { scheme: "https", host: "ammen.app", pathPrefix: "/c/" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ]);
  });
});

describe("normalizeLinkHost", () => {
  it("forgives a scheme, a trailing slash and upper case", () => {
    expect(normalizeLinkHost("https://Ammen.App/")).toBe("ammen.app");
    expect(normalizeLinkHost("staging.ammen.app")).toBe("staging.ammen.app");
  });

  it("stops the build on anything that is not a domain", () => {
    for (const bad of [
      "localhost",
      "ammen.app:8081",
      "ammen.app/p",
      "ammen app",
      "-ammen.app",
    ]) {
      expect(() => normalizeLinkHost(bad)).toThrow(ENV_KEY);
    }
  });
});

describe("app.config.js", () => {
  it("builds exactly as before without the variable", () => {
    delete process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST;
    const config = appConfig({ config: {} });

    expect(config.ios).not.toHaveProperty("associatedDomains");
    expect(config.android).not.toHaveProperty("intentFilters");
    expect(config.ios.bundleIdentifier).toBe("app.ammen.ammen");
    expect(config.android.allowBackup).toBe(false);
  });

  it("wires the links in when the owner sets a domain", () => {
    process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST = "ammen.app";
    const config = appConfig({ config: {} });

    expect(config.ios.associatedDomains).toEqual(["applinks:ammen.app"]);
    expect(config.android.intentFilters).toHaveLength(1);
    expect(config.android.package).toBe("app.ammen.ammen");
  });
});
