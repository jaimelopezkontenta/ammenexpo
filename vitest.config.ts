import { defineConfig } from "vitest/config";

/**
 * Vitest, sin más config de la necesaria — casi todo el repo no la
 * necesitaba en absoluto. Lo único que hace falta decir explícitamente es
 * que `e2e/` es territorio de Playwright (RDY-07): ambos frameworks usan por
 * defecto el mismo patrón `*.spec.ts`, así que sin este `exclude` Vitest
 * intentaba cargar los specs de Playwright como si fueran suyos y
 * `test.describe()` fallaba con "did not expect test.describe() to be
 * called here" — un error de framework, no del código bajo prueba.
 */
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
