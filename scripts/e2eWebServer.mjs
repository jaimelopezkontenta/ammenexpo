#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

/**
 * Metro en el runner de GitHub o no abre 8081 a tiempo, o se queda sin heap.
 * El e2e de CI sirve el mismo export web que staging (`expo export`) y un
 * estático con fallback SPA, en 127.0.0.1 para no pelear con IPv6.
 */

const OUT_DIR = path.resolve("dist-e2e");
const HOST = "127.0.0.1";
const PORT = 8081;
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

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

const exported = spawnSync(
  NPX,
  ["expo", "export", "--platform", "web", "--output-dir", "dist-e2e"],
  {
    stdio: "inherit",
    env: { ...process.env, E2E_WEB_OUTPUT: "single" },
  },
);

if (exported.status !== 0) {
  process.exit(exported.status ?? 1);
}

const rootPrefix = OUT_DIR + path.sep;

const sendFile = (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "content-type": MIME[ext] ?? "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(res);
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] || "/");
  const resolved = path.resolve(OUT_DIR, `.${urlPath}`);

  if (resolved !== OUT_DIR && !resolved.startsWith(rootPrefix)) {
    res.writeHead(403);
    res.end();
    return;
  }

  const serveIndex = () => sendFile(res, path.join(OUT_DIR, "index.html"));

  const tryPath = (candidate) => {
    fs.stat(candidate, (err, st) => {
      if (!err && st.isFile()) {
        sendFile(res, candidate);
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
