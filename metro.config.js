// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
// La ruta `private/` es la única que exporta el package.json de metro-config,
// y el módulo es ESM transpilado: la función viene en `.default`.
const exclusionList =
  require("metro-config/private/defaults/exclusionList").default;

const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Playwright crea y borra `test-results/.playwright-artifacts-*` en mitad de
// cada run; el watcher de Metro (FallbackWatcher en Windows) intentaba vigilar
// esas carpetas y moría con ENOENT cuando desaparecían — tumbando el dev
// server justo mientras corrían los e2e. Lo mismo hace `.tmp/` (el lock de la
// base y los directorios efímeros de `dbLock.test`, que vitest crea y borra en
// cada run). Ni artefactos, ni reportes ni locks son código de la app: fuera
// del grafo y fuera del watcher.
// Patrones en estilo posix a propósito: `exclusionList` traduce cada `\/` al
// separador de la plataforma (en Windows, backslash) — un `[\\/]` manual rompe
// esa traducción.
config.resolver.blockList = exclusionList([
  /test-results\/.*/,
  /playwright-report\/.*/,
  /\.tmp\/.*/,
]);

module.exports = withNativeWind(config, { input: "./global.css" });
