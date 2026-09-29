#!/usr/bin/env node
/**
 * Los hashes de los `<script>` inline que la CSP de `firebase.json` deja correr.
 *
 * `script-src` no lleva `'unsafe-inline'`: un script inline solo corre si su
 * hash está en la lista. El export estático (`output: "static"`, staging y
 * producción) emite dos en cada HTML:
 *
 * 1. El del tema, `THEME_BOOT_SCRIPT` de `app/+html.tsx`: se lee de la fuente,
 *    que React emite tal cual con `dangerouslySetInnerHTML`.
 * 2. La bandera de hidratación que Expo Router añade antes de `</head>`
 *    (`serializeHtml` de `@expo/cli`). No es nuestra: el test la compara con
 *    la de la versión instalada de Expo para enterarse cuando cambie.
 *
 * El export `single` del e2e no lleva ninguno de los dos (usa la plantilla
 * por defecto de Expo), así que el e2e no puede vigilar estos hashes: lo hacen
 * este script y su test.
 *
 *   npm run csp:hashes           los hashes esperados y si firebase.json casa
 *   npm run csp:check            además, cada script inline de cada HTML de
 *                                `dist` (el build de staging) antes de desplegar
 *   node scripts/cspHashes.mjs --html <dir>   lo mismo con otro export
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  headersForPath,
  headerValue,
  hostingHeaderRules,
  parseCsp,
  parseFirebaseJson,
} from "./webHeaders.mjs";

export const HYDRATION_FLAG_SCRIPT = "globalThis.__EXPO_ROUTER_HYDRATE__=true;";

export const cspHash = (content) =>
  `'sha256-${createHash("sha256").update(content, "utf8").digest("base64")}'`;

export const extractThemeBootScript = (htmlTsxSource) => {
  const match = /const THEME_BOOT_SCRIPT\s*=\s*`([^`]*)`/u.exec(htmlTsxSource);
  if (!match) {
    throw new Error(
      "app/+html.tsx: no se encuentra `const THEME_BOOT_SCRIPT = `…``; el hash de la CSP se calcula sobre esa constante",
    );
  }
  const content = match[1];
  // Con una interpolación o un escape, el texto del fichero ya no es el que se
  // emite y el hash saldría de otra cosa.
  if (content.includes("${") || content.includes("\\")) {
    throw new Error(
      "THEME_BOOT_SCRIPT tiene que ser texto literal, sin `${…}` ni escapes",
    );
  }
  return content;
};

export const expectedInlineScripts = (htmlTsxSource) =>
  [
    {
      name: "tema (app/+html.tsx)",
      content: extractThemeBootScript(htmlTsxSource),
    },
    { name: "hidratación de Expo Router", content: HYDRATION_FLAG_SCRIPT },
  ].map((script) => ({ ...script, hash: cspHash(script.content) }));

/** La CSP que recibe un documento HTML según `firebase.json`. */
export const documentCsp = (firebaseConfig) =>
  headerValue(
    headersForPath(hostingHeaderRules(firebaseConfig), "/index.html"),
    "Content-Security-Policy",
  );

const HASH_SOURCE = /^'sha(?:256|384|512)-[A-Za-z0-9+/=]+'$/u;

/**
 * Lo que tiene que cumplir la CSP de `firebase.json`: existe, `script-src` no
 * se abre a inline ni a eval, y sus hashes son exactamente los esperados (uno
 * que sobra es un script viejo que aún podría correr).
 */
export const cspProblems = (policy, expected) => {
  if (!policy) return ["firebase.json no manda Content-Security-Policy"];

  const directives = parseCsp(policy);
  const scriptSrc = directives.find((d) => d.name === "script-src");
  if (!scriptSrc) return ["la CSP no tiene script-src"];

  const problems = [];
  for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", "*", "data:"]) {
    if (scriptSrc.sources.includes(unsafe)) {
      problems.push(`script-src no puede llevar ${unsafe}`);
    }
  }

  const actual = scriptSrc.sources.filter((s) => HASH_SOURCE.test(s));
  for (const script of expected) {
    if (!actual.includes(script.hash)) {
      problems.push(`falta ${script.hash} (${script.name}) en script-src`);
    }
  }
  for (const hash of actual) {
    if (!expected.some((s) => s.hash === hash)) {
      problems.push(
        `sobra ${hash} en script-src: no es de ningún script actual`,
      );
    }
  }
  return problems;
};

const EXECUTABLE_TYPES = new Set([
  "",
  "module",
  "text/javascript",
  "application/javascript",
]);

/** El contenido de cada `<script>` inline ejecutable de un HTML. */
export const inlineScripts = (html) => {
  const scripts = [];
  for (const match of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu,
  )) {
    const attributes = match[1];
    if (/\bsrc\s*=/iu.test(attributes)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]*)/iu.exec(attributes)?.[1] ?? "";
    // Un JSON (`application/json`, `ld+json`) no se ejecuta y la CSP no lo mira.
    if (!EXECUTABLE_TYPES.has(type.toLowerCase())) continue;
    scripts.push(match[2]);
  }
  return scripts;
};

const htmlFiles = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();

/** Los scripts inline de un export que la CSP bloquearía, fichero a fichero. */
export const blockedInlineScripts = (exportDir, policy) => {
  const allowed = new Set(
    (
      parseCsp(policy).find((d) => d.name === "script-src")?.sources ?? []
    ).filter((s) => HASH_SOURCE.test(s)),
  );
  const blocked = [];
  for (const file of htmlFiles(exportDir)) {
    for (const content of inlineScripts(fs.readFileSync(file, "utf8"))) {
      const hash = cspHash(content);
      if (!allowed.has(hash)) {
        blocked.push({
          file: path.relative(exportDir, file),
          hash,
          preview: content.slice(0, 80),
        });
      }
    }
  }
  return blocked;
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const policy = documentCsp(
    parseFirebaseJson(
      fs.readFileSync(path.join(root, "firebase.json"), "utf8"),
    ),
  );
  const expected = expectedInlineScripts(
    fs.readFileSync(path.join(root, "app", "+html.tsx"), "utf8"),
  );

  console.log("Scripts inline del export estático y su hash para script-src:");
  for (const script of expected)
    console.log(`  ${script.hash}  ${script.name}`);

  const problems = cspProblems(policy, expected);

  const htmlFlag = process.argv.indexOf("--html");
  if (htmlFlag !== -1) {
    const exportDir = path.resolve(root, process.argv[htmlFlag + 1] ?? "dist");
    if (!fs.existsSync(exportDir)) {
      problems.push(
        `no existe ${exportDir}: exporta antes (npm run build:web:staging)`,
      );
    } else if (policy) {
      const files = htmlFiles(exportDir).length;
      if (files === 0) problems.push(`${exportDir} no tiene ningún .html`);
      for (const { file, hash, preview } of blockedInlineScripts(
        exportDir,
        policy,
      )) {
        problems.push(
          `${file}: script inline ${hash} bloqueado por la CSP («${preview}»)`,
        );
      }
      console.log(`Revisados ${files} HTML de ${exportDir}.`);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    console.error(
      "Copia los hashes de arriba en script-src de firebase.json (Content-Security-Policy).",
    );
    process.exitCode = 1;
  } else {
    console.log("✓ firebase.json permite exactamente estos scripts inline.");
  }
}
