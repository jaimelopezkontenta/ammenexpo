import { expect, test, type Page } from "@playwright/test";

import {
  notFoundOpts,
  pinReadingPosition,
  snapshotOpts,
} from "./helpers/visual";

/**
 * @visual — la red de seguridad visual de las fases de UI.
 *
 * No corre en `npm run e2e` (el suite funcional no debe caerse por un píxel):
 * corre a propósito con `npm run e2e:visual`, y las referencias se regeneran
 * con `npm run e2e:visual:update` cuando un cambio visual es deliberado.
 *
 * Reglas del harness:
 * - `reducedMotion: "reduce"` viene del proyecto `visual` en la config: una
 *   captura a mitad de un fade no es reproducible.
 * - 2 % de tolerancia: por debajo del ruido de antialiasing entre máquinas,
 *   por encima de cualquier cambio real de layout o color.
 * - Dos viewports: el teléfono (390×844) y el escritorio (1280×800), que es
 *   donde el ancho de lectura se rompía sin que nadie lo viera.
 */

const SEED = { email: "prueba@ammen.local", password: "ammen1234" };

const VIEWPORTS = [
  { name: "movil", width: 390, height: 844 },
  { name: "escritorio", width: 1280, height: 800 },
] as const;

const SCREENS: { name: string; path: string }[] = [
  { name: "hoy", path: "/" },
  { name: "biblia", path: "/biblia" },
  { name: "orar", path: "/orar" },
  { name: "circulos", path: "/circulos" },
  { name: "perfil", path: "/perfil" },
  { name: "capitulo", path: "/libro/43/3" },
  { name: "crisis", path: "/crisis" },
  { name: "lista", path: "/lista" },
  { name: "plus", path: "/plus" },
  { name: "notfound", path: "/ruta-inexistente" },
  // La superficie social, sin red hasta Amanecer 3.0. Los UUID son los del
  // seed (`supabase/seed.sql`), estables entre resets.
  { name: "comunidad", path: "/comunidad" },
  { name: "peticiones", path: "/peticiones" },
  { name: "persona", path: "/persona/5eed0000-0000-0000-0000-000000000002" },
  {
    name: "chat",
    path: "/circulo/5eed0000-0000-0000-0000-0000000000b1/chat",
  },
  { name: "avisos", path: "/avisos" },
  { name: "libro-index", path: "/libro/43" },
  {
    name: "plan-dias",
    path: "/plan/5eed0000-0000-0000-0000-0000000000a1/dias",
  },
];

/**
 * Las dos fuentes de caducidad que mataban baselines solas:
 *
 * - El saludo de Hoy depende de `getHours()`: una referencia capturada por la
 *   mañana moría por la tarde. Hora fija a las 10:00 del día REAL — la fecha
 *   no se congela para no descuadrar los datos del seed, que nacen en el
 *   reset de esta misma corrida. `setFixedTime` y no `install()`: congelar
 *   también los timers colgaría React Query y los `waitForTimeout`.
 * - El Versículo del día lo decide el SERVIDOR por fecha (`local_today()`),
 *   así que rota cada día y arrastraba las capturas de Hoy y Biblia: payload
 *   fijo por intercepción. Juan 3:16, como manda la tradición.
 */
const FIXED_VERSE = [
  {
    book_id: 43,
    book_name: "Juan",
    chapter: 3,
    verse: 16,
    reference: "Juan 3:16",
    text: "Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
  },
];

const stabilize = async (page: Page) => {
  const fixed = new Date();
  fixed.setHours(10, 0, 0, 0);
  await page.clock.setFixedTime(fixed);
  await page.route("**/rest/v1/rpc/verse_of_the_day", (route) =>
    route.fulfill({ json: FIXED_VERSE }),
  );
};

const login = async (page: Page) => {
  await page.goto("/entrar");
  await page.getByLabel("Correo electrónico").fill(SEED.email);
  await page.getByLabel("Contraseña").fill(SEED.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
    timeout: 20_000,
  });
};

for (const viewport of VIEWPORTS) {
  test.describe(`@visual ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`entrar se ve como la referencia (${viewport.name})`, async ({
      page,
    }) => {
      await stabilize(page);
      await page.goto("/entrar");
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
      // Las fuentes remotas de Google llegan un frame después que el layout.
      await page.waitForTimeout(1_000);
      await expect(page).toHaveScreenshot(
        `entrar-${viewport.name}.png`,
        snapshotOpts(page),
      );
    });

    test(`crear cuenta se ve como la referencia (${viewport.name})`, async ({
      page,
    }) => {
      await stabilize(page);
      await page.goto("/crear-cuenta");
      await expect(
        page.getByRole("button", { name: "Crear cuenta" }),
      ).toBeVisible();
      await page.waitForTimeout(1_000);
      await expect(page).toHaveScreenshot(
        `crear-cuenta-${viewport.name}.png`,
        snapshotOpts(page),
      );
    });

    test(`las pantallas con sesión se ven como la referencia (${viewport.name})`, async ({
      page,
    }) => {
      // Dieciocho pantallas en un solo recorrido: el timeout global de 120 s
      // se quedó corto al crecer la lista con Amanecer 3.0, y los 360 s se
      // quedaron justos en cuanto cada goto ronda los 20 s con la máquina
      // cargada (medido 2026-08-28): presupuesto con margen, no al filo.
      test.setTimeout(600_000);
      await stabilize(page);
      await login(page);
      for (const screen of SCREENS) {
        if (screen.name === "biblia" || screen.name === "libro-index") {
          pinReadingPosition();
        }
        await page.goto(screen.path);
        // networkidle en vez de un selector por pantalla: lo que se captura
        // es la pantalla asentada, sin spinners de React Query a medias.
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(
          `${screen.name}-${viewport.name}.png`,
          screen.name === "notfound" ? notFoundOpts(page) : snapshotOpts(page),
        );
      }
    });
  });
}
