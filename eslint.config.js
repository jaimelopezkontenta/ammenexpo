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
      // El export que sirve `npm run e2e:static` (y CI): bundle generado.
      "dist-e2e/*",
      ".expo/*",
      "supabase/.temp/*",
      "supabase/.branches/*",
      // Generado por `npm run db:types`; CI lo compara con lo que escupe el CLI.
      "types/supabase.ts",
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
  // El contrato de AGENTS.md, en lint: lo que antes solo vigilaba una revisión
  // (o el test de adopción de Txt) falla ahora al escribirlo.
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "core/**/*.{ts,tsx}",
      "theme/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: [
                "Pressable",
                "TouchableOpacity",
                "TouchableHighlight",
                "TouchableWithoutFeedback",
              ],
              message:
                "Todo lo tocable pasa por Tap (components/ui/Tap.tsx) o Button — AGENTS.md.",
            },
            {
              name: "react-native",
              importNames: ["Text"],
              message:
                "Todo texto pasa por Txt (components/ui/Text.tsx) — AGENTS.md.",
            },
            {
              name: "@/theme",
              importNames: ["colors"],
              message:
                "Los colores de tema salen de useThemeColors(); el `colors` estático no voltea en oscuro — AGENTS.md «El anochecer».",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='router'][callee.property.name='back']",
          message:
            "router.back() sin historial deja atrapado a quien entró en frío: usa goBackOr(destino) de core/nav/safeBack.ts — AGENTS.md.",
        },
      ],
    },
  },
  // Las excepciones del contrato, cada una con su porqué.
  {
    files: [
      // Las primitivas que envuelven lo que el resto no puede usar.
      "components/ui/Tap.tsx",
      "components/ui/Text.tsx",
      // Los scrims de los sheets: un Pressable oculto a la accesibilidad, no
      // un control (el control anunciado es «Cerrar»).
      "components/PlanOptionsSheet.tsx",
      "components/ui/ActionMenu.tsx",
      "components/ui/Sheet.tsx",
      // Marca fija, a propósito igual en los dos temas (AGENTS.md).
      "app/+html.tsx",
      "components/Avatar.tsx",
      "components/VerseCard.tsx",
      "components/VerseStory.tsx",
      "components/Wordmark.tsx",
    ],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // La única que puede llamar a router.back(): es la que comprueba el historial.
    files: ["core/nav/safeBack.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
]);
