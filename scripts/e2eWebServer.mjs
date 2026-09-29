#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createHeaderResolver, loadHostingHeaderRules } from "./webHeaders.mjs";

/**
 * Metro en el runner de GitHub o no abre 8081 a tiempo, o se queda sin heap.
 * El e2e de CI sirve el mismo export web que staging (`expo export`) y un
 * estático con fallback SPA, en 127.0.0.1 para no pelear con IPv6.
 *
 * Con las cabeceras de `firebase.json` (Oleada 4d), CSP incluida: el e2e corre
 * bajo la misma política que producción, así que lo que staging bloquearía
 * aquí también se bloquea. Lo único que cambia es que `connect-src` e
 * `img-src` admiten además el Supabase local del build, y un `report-uri`
 * que deja cada violación en el log (y en GET /__csp-report).
 */

const OUT_DIR = path.resolve("dist-e2e");
const HOST = "127.0.0.1";
const PORT = 8081;
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const CSP_REPORT_PATH = "/__csp-report";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Antes del export (tarda minutos): sin la URL de Supabase que lleva el build,
// la CSP bloquearía cada petición y todos los tests fallarían sin decir por qué.
// Playwright la pone en `webServer.env` (playwright.config.ts).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.error(
    "[e2e-web] Falta EXPO_PUBLIC_SUPABASE_URL: la CSP de firebase.json se amplía con ese origen para el e2e.",
  );
  process.exit(1);
}

const headersFor = createHeaderResolver(
  loadHostingHeaderRules(
    fileURLToPath(new URL("../firebase.json", import.meta.url)),
  ),
  { supabaseUrl, reportUri: CSP_REPORT_PATH },
);

const exported = spawnSync(
  NPX,
  ["expo", "export", "--platform", "web", "--output-dir", "dist-e2e"],
  {
    stdio: "inherit",
    env: { ...process.env, E2E_WEB_OUTPUT: "single" },
    // En Windows `npx.cmd` es un batch y Node moderno exige shell (EINVAL sin
    // ella). En CI (Linux) no cambia nada. Desde `npm run e2e:static` este
    // script también corre en local.
    shell: process.platform === "win32",
  },
);

if (exported.status !== 0) {
  process.exit(exported.status ?? 1);
}

const rootPrefix = OUT_DIR + path.sep;
const cspViolations = [];

const sendFile = (res, filePath, requestPath) => {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    // Las cabeceras van por la ruta PEDIDA, no por el fichero servido: igual
    // que Firebase, que las aplica antes del rewrite a /index.html.
    ...headersFor(requestPath),
    "content-type": MIME[ext] ?? "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(res);
};

// El navegador manda aquí cada violación (report-uri). Se deja en el log del
// webServer de Playwright y se puede leer con GET para que un test la afirme.
const handleCspReport = (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(200, { "content-type": MIME[".json"] });
    res.end(JSON.stringify(cspViolations));
    return;
  }
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    if (body.length < 64 * 1024) body += chunk;
  });
  req.on("end", () => {
    try {
      const parsed = JSON.parse(body);
      const report = parsed["csp-report"] ?? parsed;
      cspViolations.push(report);
      console.error(
        `[e2e-web] CSP bloqueó ${report["effective-directive"] ?? report["violated-directive"]}: ${report["blocked-uri"] || "(inline)"} en ${report["document-uri"]}`,
      );
    } catch {
      console.error("[e2e-web] informe CSP ilegible");
    }
    res.writeHead(204);
    res.end();
  });
};

const server = http.createServer((req, res) => {
  const requestPath = (req.url ?? "/").split("?")[0] || "/";

  if (requestPath === CSP_REPORT_PATH) {
    handleCspReport(req, res);
    return;
  }

  const urlPath = decodeURIComponent(requestPath);
  const resolved = path.resolve(OUT_DIR, `.${urlPath}`);

  if (resolved !== OUT_DIR && !resolved.startsWith(rootPrefix)) {
    res.writeHead(403);
    res.end();
    return;
  }

  const serveIndex = () =>
    sendFile(res, path.join(OUT_DIR, "index.html"), requestPath);

  const tryPath = (candidate) => {
    fs.stat(candidate, (err, st) => {
      if (!err && st.isFile()) {
        sendFile(res, candidate, requestPath);
        return;
      }
      if (!err && st.isDirectory()) {
        tryPath(path.join(candidate, "index.html"));
        return;
      }
      serveIndex();
    });
  };

  tryPath(resolved);
});

server.listen(PORT, HOST, () => {
  console.log(`[e2e-web] estático en http://${HOST}:${PORT}`);
});
