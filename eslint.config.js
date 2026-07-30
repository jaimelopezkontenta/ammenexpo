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
    ],
  },
  {
    rules: {
      "react/display-name": "off",
    },
  },
]);
