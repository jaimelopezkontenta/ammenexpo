import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  blockedInlineScripts,
  cspHash,
  cspProblems,
  documentCsp,
  expectedInlineScripts,
  extractThemeBootScript,
  HYDRATION_FLAG_SCRIPT,
  inlineScripts,
} from "./cspHashes.mjs";
import { parseCsp, parseFirebaseJson } from "./webHeaders.mjs";

/**
 * La CSP de `firebase.json` contra lo que de verdad emite el export estático.
 *
 * Si este test te ha parado tras tocar el script del tema de `app/+html.tsx`:
 * `npm run csp:hashes` imprime el hash nuevo; cópialo en `script-src` de
 * `firebase.json` en lugar del viejo. Sin eso, en staging el script no corre
 * (y el tema forzado parpadea al cargar).
 */

const ROOT = join(__dirname, "..");
const firebaseConfig = parseFirebaseJson(
  readFileSync(join(ROOT, "firebase.json"), "utf8"),
);
const htmlTsx = readFileSync(join(ROOT, "app", "+html.tsx"), "utf8");
const policy = documentCsp(firebaseConfig);

const sources = (name: string) =>
  parseCsp(policy ?? "").find((d) => d.name === name)?.sources ?? [];

describe("la CSP de firebase.json", () => {
  it("existe para los documentos HTML", () => {
    expect(policy).toBeTruthy();
  });

  it("no abre script-src a inline ni a eval", () => {
    expect(sources("script-src")).toContain("'self'");
    expect(sources("script-src")).not.toContain("'unsafe-inline'");
    expect(sources("script-src")).not.toContain("'unsafe-eval'");
  });

  it("permite exactamente los scripts inline del export: el del tema y el de Expo Router", () => {
    expect(cspProblems(policy, expectedInlineScripts(htmlTsx))).toEqual([]);
  });

  it("cierra lo que no se usa: marcos, <base>, plugins y formularios ajenos", () => {
    expect(sources("default-src")).toEqual(["'self'"]);
    expect(sources("frame-ancestors")).toEqual(["'none'"]);
    expect(sources("base-uri")).toEqual(["'none'"]);
    expect(sources("object-src")).toEqual(["'none'"]);
    expect(sources("form-action")).toEqual(["'self'"]);
  });

  it("deja leer con fetch el blob: de la foto de perfil (expo-image-picker en web)", () => {
    expect(sources("connect-src")).toContain("blob:");
    expect(sources("img-src")).toEqual(
      expect.arrayContaining(["blob:", "data:", "https://*.supabase.co"]),
    );
  });
});

describe("los scripts inline esperados", () => {
  it("el del tema sale tal cual de THEME_BOOT_SCRIPT", () => {
    const script = extractThemeBootScript(htmlTsx);

    expect(script).toContain('localStorage.getItem("ammen.theme.v1")');
    expect(htmlTsx).toContain("__html: THEME_BOOT_SCRIPT");
  });

  it("la bandera de hidratación es la que emite la versión instalada de Expo", () => {
    // serializeHtml de @expo/cli la inserta antes de </head> en `output:
    // "static"`. Se resuelve como lo hace Node (expo → @expo/cli →
    // @expo/router-server) y no por una ruta fija de node_modules.
    const fromRoot = createRequire(join(ROOT, "package.json"));
    const fromExpo = createRequire(fromRoot.resolve("expo/package.json"));
    const fromCli = createRequire(fromExpo.resolve("@expo/cli/package.json"));
    const html = fromCli("@expo/router-server/build/utils/html.js") as {
      getHydrationFlagScriptContents: () => string;
      getHydrationFlagScriptAsString: () => string;
    };

    expect(html.getHydrationFlagScriptContents()).toBe(HYDRATION_FLAG_SCRIPT);
    expect(inlineScripts(html.getHydrationFlagScriptAsString())).toEqual([
      HYDRATION_FLAG_SCRIPT,
    ]);
  });

  it("no acepta un script del tema con interpolaciones: el hash no sería el emitido", () => {
    expect(() =>
      extractThemeBootScript("const THEME_BOOT_SCRIPT = `a${b}c`;"),
    ).toThrow("literal");
    expect(() => extractThemeBootScript("const OTRO = `x`;")).toThrow(
      "THEME_BOOT_SCRIPT",
    );
  });
});

describe("cspHash / cspProblems", () => {
  it("es el sha256 en base64 del texto exacto, entre comillas simples", () => {
    const expected = createHash("sha256").update("a();").digest("base64");

    expect(cspHash("a();")).toBe(`'sha256-${expected}'`);
    expect(cspHash("a(); ")).not.toBe(cspHash("a();"));
  });

  it("señala el hash que falta, el que sobra y lo inseguro", () => {
    const expected = [{ name: "x", content: "x()", hash: cspHash("x()") }];

    expect(
      cspProblems(
        `script-src 'self' 'unsafe-inline' ${cspHash("viejo()")}`,
        expected,
      ),
    ).toEqual([
      "script-src no puede llevar 'unsafe-inline'",
      expect.stringContaining("falta"),
      expect.stringContaining("sobra"),
    ]);
    expect(cspProblems(undefined, expected)).toEqual([
      expect.stringContaining("no manda Content-Security-Policy"),
    ]);
  });
});

describe("inlineScripts / blockedInlineScripts (el export ya construido)", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("solo cuenta los <script> inline ejecutables", () => {
    const html = [
      '<script src="/_expo/static/js/web/entry.js" defer></script>',
      '<script type="module">m()</script>',
      "<script>a()</script>",
      '<script type="application/ld+json">{"a":1}</script>',
    ].join("");

    expect(inlineScripts(html)).toEqual(["m()", "a()"]);
  });

  it("encuentra en cualquier HTML del export el script que la CSP bloquearía", () => {
    dir = mkdtempSync(join(tmpdir(), "csp-export-"));
    mkdirSync(join(dir, "(tabs)"));
    writeFileSync(join(dir, "index.html"), "<script>bien()</script>");
    writeFileSync(join(dir, "(tabs)", "orar.html"), "<script>mal()</script>");

    const blocked = blockedInlineScripts(
      dir,
      `script-src 'self' ${cspHash("bien()")}`,
    );

    expect(blocked).toEqual([
      {
        file: join("(tabs)", "orar.html"),
        hash: cspHash("mal()"),
        preview: "mal()",
      },
    ]);
    expect(dirname(blocked[0].file)).toBe("(tabs)");
  });
});
