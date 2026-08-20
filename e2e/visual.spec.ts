import { expect, test, type Page } from "@playwright/test";

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
];

const SNAPSHOT_OPTS = { maxDiffPixelRatio: 0.02, fullPage: false } as const;

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
      await page.goto("/entrar");
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
      // Las fuentes remotas de Google llegan un frame después que el layout.
      await page.waitForTimeout(1_000);
      await expect(page).toHaveScreenshot(
        `entrar-${viewport.name}.png`,
        SNAPSHOT_OPTS,
      );
    });

    test(`las pantallas con sesión se ven como la referencia (${viewport.name})`, async ({
      page,
    }) => {
      await login(page);
      for (const screen of SCREENS) {
        await page.goto(screen.path);
        // networkidle en vez de un selector por pantalla: lo que se captura
        // es la pantalla asentada, sin spinners de React Query a medias.
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(
          `${screen.name}-${viewport.name}.png`,
          SNAPSHOT_OPTS,
        );
      }
    });
  });
}
