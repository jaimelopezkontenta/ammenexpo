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
// server justo mientras corrían los e2e. Ni los artefactos ni el reporte son
// código de la app: fuera del grafo y fuera del watcher.
config.resolver.blockList = exclusionList([
  /test-results\/.*/,
  /playwright-report\/.*/,
]);

module.exports = withNativeWind(config, { input: "./global.css" });
