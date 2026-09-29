import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createHeaderResolver,
  cspWithExtraSources,
  cspWithReportUri,
  headersForPath,
  headerValue,
  hostingHeaderRules,
  loadHostingHeaderRules,
  matchesSource,
  parseCsp,
  parseFirebaseJson,
  stripJsonComments,
  supabaseCspSources,
  type HeaderRule,
} from "./webHeaders.mjs";

const FIREBASE_JSON = join(__dirname, "..", "firebase.json");
const LOCAL_SUPABASE = "http://127.0.0.1:54421";

const directive = (policy: string, name: string) =>
  parseCsp(policy).find((d) => d.name === name)?.sources;

describe("stripJsonComments (firebase.json se lee como cjson)", () => {
  it("quita // y /* */ pero no toca // dentro de una cadena", () => {
    const text = [
      "{",
      "  // una nota",
      '  "csp": "img-src https://*.supabase.co", /* otra */',
      '  "raro": "comillas \\" y // dentro"',
      "}",
    ].join("\n");

    expect(parseFirebaseJson(text)).toEqual({
      csp: "img-src https://*.supabase.co",
      raro: 'comillas " y // dentro',
    });
  });

  it("conserva los saltos de línea, para que los errores señalen la buena", () => {
    expect(stripJsonComments('{\n// a\n"b": 1\n}').split("\n")).toHaveLength(4);
  });

  it("falla con un /* sin cerrar", () => {
    expect(() => stripJsonComments("{ /* nunca }")).toThrow("sin cerrar");
  });
});

describe("matchesSource (glob de Firebase)", () => {
  it("`**` casa con cualquier ruta, la raíz incluida", () => {
    for (const path of [
      "/",
      "/entrar",
      "/p/abc",
      "/_expo/static/js/web/entry.js",
    ]) {
      expect(matchesSource("**", path)).toBe(true);
    }
  });

  it("una ruta concreta con `**` casa solo con su subárbol", () => {
    expect(
      matchesSource("/_expo/static/**", "/_expo/static/js/web/entry.js"),
    ).toBe(true);
    expect(matchesSource("/_expo/static/**", "/_expo/other/x.js")).toBe(false);
    expect(matchesSource("/_expo/static/**", "/assets/font.ttf")).toBe(false);
    expect(matchesSource("/_expo/static/**", "/entrar")).toBe(false);
  });

  it("`*` y `?` no cruzan barras", () => {
    expect(matchesSource("/assets/*.ttf", "/assets/a.ttf")).toBe(true);
    expect(matchesSource("/assets/*.ttf", "/assets/fonts/a.ttf")).toBe(false);
    expect(matchesSource("/p/???", "/p/abc")).toBe(true);
    expect(matchesSource("/p/???", "/p/abcd")).toBe(false);
  });

  it("como minimatch, un comodín no casa con un segmento que empieza por punto", () => {
    expect(matchesSource("**", "/.well-known/assetlinks.json")).toBe(false);
    expect(
      matchesSource("/.well-known/**", "/.well-known/assetlinks.json"),
    ).toBe(true);
  });

  it("rompe con un glob que no sabe leer en vez de casar con nada", () => {
    expect(() => matchesSource("**/*.@(js|css)", "/a.js")).toThrow(
      "no soportado",
    );
    expect(() => matchesSource("/{a,b}/**", "/a/x")).toThrow("no soportado");
  });
});

describe("headersForPath (todas las reglas que casan; la última gana)", () => {
  const rules: HeaderRule[] = [
    {
      source: "**",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'" },
        { key: "Cache-Control", value: "no-store" },
      ],
    },
    {
      source: "/_expo/static/**",
      headers: [{ key: "cache-control", value: "public, immutable" }],
    },
  ];

  it("el Cache-Control de /_expo/static/** pisa al de ** sin perder la CSP", () => {
    const headers = headersForPath(rules, "/_expo/static/js/web/entry.js");

    expect(headerValue(headers, "Cache-Control")).toBe("public, immutable");
    expect(headerValue(headers, "Content-Security-Policy")).toBe(
      "default-src 'self'",
    );
    // Una sola Cache-Control, aunque las claves difieran en mayúsculas.
    expect(
      Object.keys(headers).filter((k) => k.toLowerCase() === "cache-control"),
    ).toHaveLength(1);
  });

  it("una ruta de la app se queda con las de **", () => {
    expect(headerValue(headersForPath(rules, "/entrar"), "Cache-Control")).toBe(
      "no-store",
    );
  });
});

describe("hostingHeaderRules", () => {
  it("rechaza reglas por `regex`: el e2e no sabría aplicarlas", () => {
    expect(() =>
      hostingHeaderRules({
        hosting: { headers: [{ regex: "^/a$", headers: [] }] },
      }),
    ).toThrow("regex");
  });

  it("rechaza una cabecera sin valor de texto", () => {
    expect(() =>
      hostingHeaderRules({
        hosting: { headers: [{ source: "**", headers: [{ key: "X" }] }] },
      }),
    ).toThrow("value");
  });
});

describe("CSP", () => {
  it("amplía las directivas que existen sin duplicar fuentes", () => {
    const policy = cspWithExtraSources(
      "default-src 'self'; connect-src 'self' https://*.supabase.co",
      { "connect-src": ["https://*.supabase.co", "http://127.0.0.1:54421"] },
    );

    expect(directive(policy, "connect-src")).toEqual([
      "'self'",
      "https://*.supabase.co",
      "http://127.0.0.1:54421",
    ]);
  });

  it("si falta la directiva, parte de default-src (que es la que mandaba)", () => {
    const policy = cspWithExtraSources("default-src 'self'", {
      "img-src": ["http://127.0.0.1:54421"],
    });

    expect(directive(policy, "img-src")).toEqual([
      "'self'",
      "http://127.0.0.1:54421",
    ]);
  });

  it("'none' deja de valer en cuanto hay otra fuente, así que se sustituye", () => {
    const policy = cspWithExtraSources("img-src 'none'", {
      "img-src": ["http://x"],
    });

    expect(directive(policy, "img-src")).toEqual(["http://x"]);
  });

  it("una directiva repetida es un error: el navegador ignora la segunda", () => {
    expect(() => parseCsp("img-src 'self'; img-src data:")).toThrow("repetida");
  });

  it("report-uri se sustituye, no se duplica", () => {
    const policy = cspWithReportUri("default-src 'self'; report-uri /a", "/b");

    expect(directive(policy, "report-uri")).toEqual(["/b"]);
  });

  it("el origen de Supabase entra en http(s) y en ws(s)", () => {
    expect(supabaseCspSources("http://127.0.0.1:54421/")).toEqual({
      "connect-src": ["http://127.0.0.1:54421", "ws://127.0.0.1:54421"],
      "img-src": ["http://127.0.0.1:54421"],
    });
    expect(
      supabaseCspSources("https://abc.supabase.co")["connect-src"],
    ).toEqual(["https://abc.supabase.co", "wss://abc.supabase.co"]);
    expect(() => supabaseCspSources("ftp://x")).toThrow("http(s)");
  });
});

describe("firebase.json tal cual, como lo sirve el e2e", () => {
  const rules = loadHostingHeaderRules(FIREBASE_JSON);
  const production = (path: string) => headersForPath(rules, path);
  const e2e = createHeaderResolver(rules, {
    supabaseUrl: LOCAL_SUPABASE,
    reportUri: "/__csp-report",
  });

  it("se lee igual que firebase-tools (con comentarios)", () => {
    expect(() =>
      JSON.parse(stripJsonComments(readFileSync(FIREBASE_JSON, "utf8"))),
    ).not.toThrow();
  });

  it("el HTML y los estáticos llevan la CSP; los estáticos, además, caché inmutable", () => {
    for (const path of ["/", "/entrar", "/_expo/static/js/web/entry-abc.js"]) {
      expect(headerValue(e2e(path), "Content-Security-Policy")).toBeTruthy();
      expect(headerValue(e2e(path), "X-Frame-Options")).toBe("DENY");
    }
    expect(headerValue(e2e("/entrar"), "Cache-Control")).toBe("no-store");
    expect(
      headerValue(e2e("/_expo/static/js/web/entry-abc.js"), "Cache-Control"),
    ).toBe("public, max-age=31536000, immutable");
    expect(
      headerValue(e2e("/assets/assets/fonts/a.ttf"), "Cache-Control"),
    ).toBe("public, max-age=31536000, immutable");
  });

  it("el e2e solo añade su Supabase (http y ws) y el report-uri", () => {
    const prod = headerValue(production("/"), "Content-Security-Policy")!;
    const local = headerValue(e2e("/"), "Content-Security-Policy")!;

    expect(directive(local, "connect-src")).toEqual([
      ...directive(prod, "connect-src")!,
      "http://127.0.0.1:54421",
      "ws://127.0.0.1:54421",
    ]);
    expect(directive(local, "img-src")).toEqual([
      ...directive(prod, "img-src")!,
      "http://127.0.0.1:54421",
    ]);
    expect(directive(local, "report-uri")).toEqual(["/__csp-report"]);

    const untouched = (policy: string) =>
      parseCsp(policy).filter(
        (d) => !["connect-src", "img-src", "report-uri"].includes(d.name),
      );
    expect(untouched(local)).toEqual(untouched(prod));
  });

  it("el resto de cabeceras del e2e son las de producción", () => {
    const withoutCsp = (headers: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(headers).filter(
          ([k]) => k.toLowerCase() !== "content-security-policy",
        ),
      );

    for (const path of ["/", "/_expo/static/js/web/entry-abc.js"]) {
      expect(withoutCsp(e2e(path))).toEqual(withoutCsp(production(path)));
    }
  });
});
