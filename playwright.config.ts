import { defineConfig, devices } from "@playwright/test";

/**
 * RDY-07: harness web con dos contexts, contra Supabase local.
 *
 * En local, `npm run web` (Metro/Expo web) — nunca `npm run dev`. En CI el
 * runner no aguanta Metro a tiempo; `scripts/e2eWebServer.mjs` exporta y
 * sirve el estático en 127.0.0.1:8081.
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
  webServer: process.env.CI
    ? {
        command: "node scripts/e2eWebServer.mjs",
        url: "http://127.0.0.1:8081",
        reuseExistingServer: false,
        timeout: 360_000,
        env: {
          EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54421",
          NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=4096"]
            .filter(Boolean)
            .join(" "),
        },
      }
    : {
        command: "npm run web",
        url: "http://127.0.0.1:8081",
        reuseExistingServer: true,
        timeout: 180_000,
        // `.env.local` puede apuntar Supabase a `10.0.2.2` (el alias del
        // emulador Android), que desde un navegador de escritorio no existe.
        // Las variables de proceso ganan a los .env de Expo.
        env: {
          EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54421",
        },
      },
});
