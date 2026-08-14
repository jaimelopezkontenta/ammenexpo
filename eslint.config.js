const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Generated output: Expo's route types, the Supabase CLI scratch dir and
    // web exports are not ours to lint.
    ignores: [
      "dist/*",
      "dist-test/*",
      ".expo/*",
      "supabase/.temp/*",
      "supabase/.branches/*",
      // Deno, not React Native: different runtime, different module resolution.
      // The Deno toolchain validates these when the functions are served.
      "supabase/functions/*",
      // RDY-07/verificación: artefactos de una corrida de Playwright — HTML,
      // JSON de resultados, capturas, vídeos, trazas. Un E2E que falla los
      // genera con más detalle todavía (screenshots, `.zip` de traza), y
      // ninguno de ellos es código nuestro. Sin este ignore explícito, un
      // `test-results/.last-run.json` que Playwright no formatea como
      // Prettier tumbaba `npm run lint` — y por tanto `npm run verify` — por
      // un E2E que ni siquiera tiene que ver con el código fuente.
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
      "playwright/.cache/**",
      ".tmp/**",
    ],
  },
  {
    rules: {
      "react/display-name": "off",
    },
  },
]);
