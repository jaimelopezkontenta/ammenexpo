import { defineConfig, devices } from "@playwright/test";

/**
 * RDY-07: harness web con dos contexts, contra Supabase local.
 *
 * `npm run web` (Metro/Expo web), nunca `npm run dev`, que no existe — la
 * misma regla que el resto del plan. `webServer` lo arranca y espera al
 * puerto antes de correr nada, y lo reutiliza si ya estaba arriba (`npm run
 * web` puede quedarse abierto en una terminal mientras se itera).
 *
 * Solo Chromium por ahora (regla del plan: "Playwright Chromium viable").
 * Webkit/Firefox no se han probado contra este stack y añadirlos sin
 * evidencia sería otra promesa vacía.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // RDY-07: "una corrida repetida pasa desde reset" — sin reintentos que
  // escondan un fallo real detrás de un segundo intento silencioso.
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["html", { open: "never" }], ["list"]],
  // Segundo ciclo de corrección, punto 4: precondición reproducible antes de
  // cualquier test — lock exclusivo contra `npm run db:test`, healthcheck de
  // Supabase local, reset y verificación real del seed. Ver
  // `e2e/globalSetup.ts` para el porqué de cada paso.
  globalSetup: "./e2e/globalSetup.ts",
  use: {
    baseURL: "http://127.0.0.1:8081",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      // Las capturas de referencia (@visual) no corren en el suite normal:
      // son deliberadas — `npm run e2e:visual` — porque cada fase de UI las
      // regenera a propósito y un run funcional no debe caerse por un pixel.
      grepInvert: /@visual/,
    },
    {
      name: "visual",
      use: {
        ...devices["Desktop Chrome"],
        // Con las animaciones quietas: una captura a mitad de un fade no es
        // reproducible, y lo que se protege aquí es el layout y el color.
        contextOptions: { reducedMotion: "reduce" },
      },
      grep: /@visual/,
    },
  ],
  webServer: {
    command: "npm run web",
    url: "http://127.0.0.1:8081",
    reuseExistingServer: true,
    timeout: 120_000,
    // `.env.local` puede apuntar Supabase a `10.0.2.2` (el alias del emulador
    // Android), que desde un navegador de escritorio no existe: si Playwright
    // levantaba el server con ese valor, TODOS los tests morían en el login
    // sin decir por qué. Las variables de proceso ganan a los .env de Expo,
    // así que aquí se fija la URL que los e2e siempre usan: el Kong local.
    env: {
      EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54421",
    },
  },
});
