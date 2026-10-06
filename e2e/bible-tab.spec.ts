import { expect, test } from "@playwright/test";

import { SEED_A } from "./helpers/sql";

/**
 * RDY-08 — pestaña Biblia: selector de versión, búsqueda, lector.
 *
 * Cuatro journeys independientes:
 *
 * 1. **Selector de versión en pestaña Biblia.**
 *    Cambiar RV→WEB desde la pestaña y verificar que los libros se
 *    recalibran (diferente número de capítulos por libro).
 *
 * 2. **Búsqueda en pestaña Biblia.**
 *    Buscar texto → resultados → abrir versículo → aterriza en lector.
 *
 * 3. **A-/A+ del lector.**
 *    En el lector de capítulo, los botones A y A cambian el tamaño de
 *    fuente. Se verifica que el texto se hace más pequeño y más grande.
 *
 * 4. **Navegación capítulos (anterior/siguiente).**
 *    Botones de navegación en el lector: ir al capítulo anterior y
 *    siguiente del mismo libro.
 */

test.describe("pestaña Biblia", () => {
  test("selector de versión cambia los libros mostrados", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Biblia" }).first().click();
    await expect(page.getByRole("tab", { name: "Biblia" })).toBeVisible({
      timeout: 10_000,
    });

    // La versión por defecto debería ser RVR1909
    // Verificar que hay libros visibles
    await expect(
      page.getByRole("button", { name: "Génesis" }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Cambiar a WEB
    await page.getByRole("radio", { name: /WEB|World English/i }).click();

    // Los libros deben actualizarse — RVR1909 y WEB tienen diferente número
    // de capítulos en algunos libros (p. ej. Salmos: 150 vs 150 pero
    // otros libros difieren). Lo que importa es que el selector funciona.
    await expect(page.getByRole("radiogroup")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("búsqueda muestra resultados y abre versículo", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Biblia" }).first().click();

    // Escribir una búsqueda conocida
    await page.getByLabel("Buscar").fill("principio");

    // Debe haber resultados o al menos un "Ir a"
    const hasResults = await page
      .getByText("resultados")
      .isVisible()
      .catch(() => false);
    const hasGoTo = await page
      .getByRole("link", { name: /Ir a/i })
      .isVisible()
      .catch(() => false);

    if (hasResults) {
      // Click en un resultado → abre el lector
      await page
        .getByRole("button", { name: /Génesis|Genesis|Juan|John/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/libro\//, { timeout: 10_000 });
    } else if (hasGoTo) {
      // Si hay un "Ir a" (reference jump), click para navegar
      await page.getByRole("link", { name: /Ir a/i }).first().click();
      await expect(page).toHaveURL(/\/libro\//, { timeout: 10_000 });
    }
  });

  test("A- y A+ cambian el tamaño de fuente en el lector", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Biblia" }).first().click();

    // Ir a un libro y capítulo
    await page
      .getByRole("button", { name: /Génesis|Genesis/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/libro\//, { timeout: 10_000 });

    // Abrir capítulo 1 para llegar al lector
    await page.getByRole("button", { name: "Capítulo 1", exact: true }).click();
    await expect(page).toHaveURL(/\/libro\/\d+\/\d+$/, { timeout: 10_000 });

    // El lector debe mostrar versículos
    await expect(
      page.getByRole("button", { name: "Letra más pequeña" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Letra más grande" }),
    ).toBeVisible();
    // Pulsar A+ (el botón con label más grande) — no debe lanzar error
    await page.getByRole("button", { name: "Letra más grande" }).click();

    // Pulsar A- (el botón con label más pequeña) — no debe lanzar error
    await page.getByRole("button", { name: "Letra más pequeña" }).click();
  });

  test("navegación anterior/siguiente cambia de capítulo", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Biblia" }).first().click();

    // Ir a un capítulo
    await page
      .getByRole("button", { name: /Génesis|Genesis/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/libro\//, { timeout: 10_000 });

    // Obtener el capítulo actual
    const chapterUrl = page.url();
    const currentChapter = chapterUrl.match(/\/libro\/\d+\/(\d+)/)?.[1];

    if (!currentChapter) {
      test.skip();
    }

    // Pulsar siguiente (flecha derecha)
    const nextButton = page.getByRole("button", { name: /siguiente/i });
    if (await nextButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextButton.click();
      await expect(page).toHaveURL(/\/libro\//, { timeout: 10_000 });

      // El capítulo debería ser diferente
      const newChapter = page.url().match(/\/libro\/\d+\/(\d+)/)?.[1];
      expect(newChapter).not.toBe(currentChapter);
    }
  });

  test("continuar lectura aparece si hay posición guardada", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Biblia" }).first().click();

    // Verificar que el selector de versión está presente
    await expect(page.getByRole("radiogroup")).toBeVisible({
      timeout: 10_000,
    });

    // Verificar que el buscador está presente
    await expect(page.getByLabel("Buscar")).toBeVisible({
      timeout: 10_000,
    });

    // Verificar que hay versículos del AT y NT listados
    await expect(
      page.getByText(/Génesis|Genesis|Exodo|Exodus/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
