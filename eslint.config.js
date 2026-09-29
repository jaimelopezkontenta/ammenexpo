const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// El color de un `Txt` va SIEMPRE por `tone`. En web NativeWind emite CSS y
// gana la clase que va después en la hoja: un `text-cta-ink` por className
// perdía contra el `text-plum` del tono y el CTA de Hoy salía casi blanco en
// oscuro (2026-09-29). En nativo gana la última, así que el bug solo se ve en
// web: por eso se veta aquí y no se deja a la revisión.
//
// Una clase de color de texto es `text-` + un color de la paleta
// (`theme/tokens.js`), con o sin prefijos de variante (`dark:`, `web:`…), `!` y
// opacidad (`/60`). Los tamaños (`text-sm`), la alineación (`text-center`) y el
// ajuste (`text-balance`) no son colores y quedan libres. La expresión no lleva
// `/` dentro: el parser de selectores de esquery no las admite en un regex.
const TEXT_COLOR_NAMES = [
  // La paleta de Amanecer.
  "plum(?:-chip)?",
  "mist(?:-ink)?",
  "ember(?:-pale|-accent|-ink)?",
  "dawn-[a-z-]+",
  "glass(?:edge)?",
  "cta-ink",
  "surface",
  "danger",
  // Lo genérico de Tailwind, que también compite con el tono.
  "white|black|transparent|current|inherit",
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}",
  "\\[(?:#|rgb|hsl)[^\\]]*\\]",
].join("|");
const TEXT_COLOR_CLASS = `(?:^|\\s)(?:[\\w-]+:)*!?text-(?:${TEXT_COLOR_NAMES})(?![\\w-])`;

// El literal de cadena (`className="text-plum"`, `{cond ? "text-plum" : ""}`) y
// la plantilla (`{`text-plum ${x}`}`) son dos nodos distintos. `Button` entra
// porque su label es un `Txt` con tono propio: recolorearlo es el mismo error.
const TXT_COLOR_SELECTORS = [
  `Literal[value=/${TEXT_COLOR_CLASS}/]`,
  `TemplateElement[value.raw=/${TEXT_COLOR_CLASS}/]`,
].map((node) => ({
  selector: `JSXOpeningElement[name.name=/^(?:Txt|Button)$/] > JSXAttribute[name.name='className'] ${node}`,
  message:
    "El color de un Txt va por `tone` (primary, secondary, accent, danger, onDark, onCta), no por className: en web la clase pierde contra el tono según el orden del CSS — AGENTS.md «Tacto y texto».",
}));

const ROUTER_BACK_SELECTOR = {
  selector:
    "CallExpression[callee.object.name='router'][callee.property.name='back']",
  message:
    "router.back() sin historial deja atrapado a quien entró en frío: usa goBackOr(destino) de core/nav/safeBack.ts — AGENTS.md.",
};

// Las claves de React Query salen de `qk` (core/query/keys.ts). Una clave escrita a
// mano en un `invalidateQueries` y otra distinta en el `useQuery` que debía
// refrescar fallan en silencio: había 184 sueltas y dos invalidaciones que no
// refrescaban nada porque ninguna query las usaba.
const QUERY_KEY_MESSAGE =
  "Las claves de React Query salen de `qk` (core/query/keys.ts), no de un array a mano: una clave distinta en la query y en su invalidación falla en silencio.";
const QUERY_KEY_SELECTORS = [
  "Property[key.name='queryKey'] > ArrayExpression",
  "CallExpression[callee.property.name=/^(?:setQueryData|getQueryData|setQueriesData|getQueriesData|ensureQueryData|prefetchQuery|fetchQuery)$/] > ArrayExpression:first-child",
].map((selector) => ({ selector, message: QUERY_KEY_MESSAGE }));

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
        ROUTER_BACK_SELECTOR,
        ...TXT_COLOR_SELECTORS,
        ...QUERY_KEY_SELECTORS,
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
