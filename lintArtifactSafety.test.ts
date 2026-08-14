import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Segundo ciclo de corrección, punto 2 — "un E2E fallido no puede envenenar
 * lint/verify". La reproducción real (correr un spec que falla a propósito,
 * ver los artefactos que Playwright deja, y confirmar que `npm run lint`
 * sigue en verde) se documenta en el log del plan porque genera archivos
 * binarios (`.webm`, `.zip`, capturas) que no tiene sentido dejar en el
 * repositorio de forma permanente.
 *
 * Esta prueba es la mitad que sí puede quedarse: una regresión automatizada
 * y reproducible que falla en el momento en que alguien quite el ignore de
 * `eslint.config.js` o de `.prettierignore` — antes de que haga falta volver
 * a fallar un E2E de verdad para descubrirlo. Vive en la raíz, no en `e2e/`:
 * `vitest.config.ts` excluye ese directorio entero porque es territorio de
 * Playwright.
 */

const root = path.resolve(__dirname);

describe("lint/verify no se envenena con artefactos de Playwright", () => {
  it("eslint.config.js ignora los directorios de artefactos de Playwright", () => {
    // `require`, no `import`: eslint.config.js es CommonJS a propósito
    // (mismo motivo que el resto del repo), y Vitest interopera con eso sin
    // problema.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(path.join(root, "eslint.config.js"));

    // La config es un array plano de entradas; `eslint-config-expo/flat`
    // aporta las suyas propias con su propio `ignores` (por ejemplo
    // `android/app/build`), así que la comprobación real es sobre la unión
    // de todos los `ignores` del array, no sobre "la primera entrada que
    // tenga uno" — que resultó ser la de Expo, no la nuestra.
    const allIgnores: string[] = config
      .filter((entry: { ignores?: string[] }) => Array.isArray(entry.ignores))
      .flatMap((entry: { ignores: string[] }) => entry.ignores);

    for (const pattern of [
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
    ]) {
      expect(allIgnores).toContain(pattern);
    }
  });

  it(".prettierignore ignora los mismos directorios — el check de formato pasa por un glob distinto al de eslint", () => {
    const content = readFileSync(path.join(root, ".prettierignore"), "utf8");

    for (const pattern of [
      "playwright-report/",
      "test-results/",
      "blob-report/",
    ]) {
      expect(content).toContain(pattern);
    }
  });

  it(".gitignore también los excluye — nunca deberían llegar a un commit", () => {
    const content = readFileSync(path.join(root, ".gitignore"), "utf8");

    for (const pattern of ["/test-results/", "/playwright-report/"]) {
      expect(content).toContain(pattern);
    }
  });
});
