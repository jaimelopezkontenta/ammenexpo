#!/usr/bin/env node
/**
 * `npm run e2e:static` — el e2e local contra el MISMO servidor que CI.
 *
 * En local la suite corre contra Metro (dev), y Metro tiene otra cadencia de
 * eventos: hay presses que solo se pierden ahí (el «clic real» de
 * public-contract falló consistente en local y verde en CI el 2026-08-28,
 * con el mismo código). CI corre contra el export estático servido por
 * `scripts/e2eWebServer.mjs`; este script activa esa misma rama en local vía
 * `E2E_STATIC=1` (ver `playwright.config.ts`).
 *
 * Es un script y no un prefijo de variable porque en Windows/PowerShell no
 * existe `VAR=x cmd`, y el repo no carga `cross-env` para esto solo.
 *
 * Los argumentos extra se reenvían a Playwright:
 *   npm run e2e:static                        → --project=chromium
 *   npm run e2e:static -- -g "clic real"      → filtro
 *   npm run e2e:visual                        → proyectos visual (claro y oscuro)
 */

import { spawnSync } from "node:child_process";
import { connect } from "node:net";

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

// El export estático se sirve en el 8081 — el MISMO puerto de Metro. Si Metro
// está vivo, `e2eWebServer.mjs` muere con EADDRINUSE dentro del webServer de
// Playwright (que lo enseña como un timeout mudo), o peor: Playwright ve el
// puerto responder y testea Metro creyendo que testea el estático. Se aborta
// aquí, con la frase entera.
const portBusy = await new Promise((resolve) => {
  const socket = connect({ host: "127.0.0.1", port: 8081 });
  const done = (value) => {
    socket.destroy();
    resolve(value);
  };
  socket.once("connect", () => done(true));
  socket.once("error", () => done(false));
  setTimeout(() => done(false), 1_500);
});

if (portBusy) {
  console.error(
    "[e2e:static] El puerto 8081 ya está ocupado (¿Metro con `npm run web`?).\n" +
      "  Este modo exporta la app y la sirve él mismo en ese puerto, como CI.\n" +
      "  Para el servidor de dev y vuelve a lanzar. (El export tarda unos minutos.)",
  );
  process.exit(1);
}

console.log(
  "[e2e:static] exportando y sirviendo la app estática (como CI); el export " +
    "tarda unos minutos la primera vez…",
);

const extraArgs = process.argv.slice(2);
// Sin `--project` explícito, el árbitro funcional (chromium). `e2e:visual` lo
// pasa con los suyos: la red visual también corre contra el export estático,
// donde no existe el botón ⚡ de desarrollo de Expo que Metro pinta a ratos
// abajo a la izquierda y que hacía fallar capturas sin que cambiara la app.
const hasProject = extraArgs.some((arg) => arg.startsWith("--project"));
const args = [
  "playwright",
  "test",
  ...(hasProject ? [] : ["--project=chromium"]),
  ...extraArgs,
];

// Con `shell: true` (Windows) Node une los argumentos con espacios y sin
// comillas: un filtro como `-g "hoy movil"` llegaba a Playwright partido en dos.
// Se citan los que lo necesitan.
const quoteForWindowsShell = (arg) =>
  /[\s"&|<>^()]/u.test(arg) ? `"${arg.replace(/"/gu, '\\"')}"` : arg;

const result = spawnSync(
  NPX,
  process.platform === "win32" ? args.map(quoteForWindowsShell) : args,
  {
    stdio: "inherit",
    env: { ...process.env, E2E_STATIC: "1" },
    // En Windows `npx.cmd` es un batch: Node moderno exige shell para
    // ejecutarlo (EINVAL sin ella).
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
