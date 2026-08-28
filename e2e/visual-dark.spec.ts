import { expect, test, type Page } from "@playwright/test";

/**
 * @dark — la red del anochecer.
 *
 * (El tag es `@dark` y NO `@visual-dark`: el regex /@visual/ del proyecto
 * claro matchearía `@visual-dark` por substring y correría este spec en
 * claro. El `colorScheme: "dark"` lo pone el proyecto `visual-dark` de la
 * config.)
 *
 * No duplica las 48 baselines claras: es un subset curado que cubre cada
 * primitivo CIEGO al volteo de variables CSS — lo que solo puede romperse en
 * oscuro sin que la red clara se entere:
 *
 * - el vidrio y su canto (Glass/tab bar, tint del BlurView en web) → hoy, perfil
 * - el anillo del orbe en la barra (0.18 en oscuro) → cualquier tab
 * - los gemelos JS de los degradados (dawnDark, dayActionDark) → hoy
 * - la marca clara dentro de la app oscura (VerseCard, CTA melocotón) → hoy, entrar
 * - la lectura larga (Lora sobre violeta, subrayado ámbar) → capitulo
 * - las burbujas del chat (plum.chip con blanco) → chat
 * - las tarjetas sociales (autores, meta en mist.ink) → comunidad
 * - los estados vacío/perdido → lista, notfound
 *
 * Capitulo va en los dos viewports porque la medida de lectura cambia de
 * layout en escritorio; hoy también, por la cabecera ancha. El resto, en
 * móvil: el volteo de color es el mismo a cualquier ancho.
 */

const SEED = { email: "prueba@ammen.local", password: "ammen1234" };

const MOVIL = { width: 390, height: 844 } as const;
const ESCRITORIO = { width: 1280, height: 800 } as const;

const SCREENS: {
  name: string;
  path: string;
  viewports: readonly ("movil" | "escritorio")[];
}[] = [
  { name: "hoy", path: "/", viewports: ["movil", "escritorio"] },
  { name: "capitulo", path: "/libro/43/3", viewports: ["movil", "escritorio"] },
  {
    name: "chat",
    path: "/circulo/5eed0000-0000-0000-0000-0000000000b1/chat",
    viewports: ["movil"],
  },
  { name: "comunidad", path: "/comunidad", viewports: ["movil"] },
  { name: "perfil", path: "/perfil", viewports: ["movil"] },
  { name: "lista", path: "/lista", viewports: ["movil"] },
  { name: "notfound", path: "/ruta-inexistente", viewports: ["movil"] },
];

const SNAPSHOT_OPTS = { maxDiffPixelRatio: 0.02, fullPage: false } as const;

// Mismas dos fuentes de caducidad que en visual.spec.ts: el saludo por hora y
// el versículo por fecha de servidor. Misma cura.
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

for (const viewport of [
  { name: "movil", ...MOVIL },
  { name: "escritorio", ...ESCRITORIO },
] as const) {
  const screens = SCREENS.filter((s) => s.viewports.includes(viewport.name));

  test.describe(`@dark ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    if (viewport.name === "movil") {
      test(`entrar en oscuro se ve como la referencia`, async ({ page }) => {
        await stabilize(page);
        await page.goto("/entrar");
        await expect(
          page.getByRole("button", { name: "Entrar" }),
        ).toBeVisible();
        await page.waitForTimeout(1_000);
        await expect(page).toHaveScreenshot(
          `dark-entrar-movil.png`,
          SNAPSHOT_OPTS,
        );
      });
    }

    test(`las pantallas con sesión en oscuro se ven como la referencia (${viewport.name})`, async ({
      page,
    }) => {
      test.setTimeout(600_000);
      await stabilize(page);
      await login(page);
      for (const screen of screens) {
        await page.goto(screen.path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(
          `dark-${screen.name}-${viewport.name}.png`,
          SNAPSHOT_OPTS,
        );
      }
    });
  });
}
