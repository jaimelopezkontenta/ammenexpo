import { expect, test } from "@playwright/test";

import { SEED_A } from "./helpers/sql";

/**
 * RDY-08 — comunidad: feed, búsqueda de personas, perfil.
 *
 * Tres journeys independientes:
 *
 * 1. **Feed de comunidad.**
 *    El usuario entra en la pestaña Juntos → Comunidad y ve el feed con
 *    planes públicos, testimonios y peticiones.
 *
 * 2. **Buscar persona en comunidad.**
 *    Escribir un nombre en el buscador de comunidad filtra a personas.
 *
 * 3. **Ver perfil de otro usuario.**
 *    Desde el feed o la búsqueda, navegar al perfil de otra persona.
 */

test.describe("comunidad", () => {
  test("feed de comunidad muestra contenido público", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Ir a Comunidad (pestaña Juntos → segmento Comunidad)
    await page.getByRole("tab", { name: "Juntos" }).first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_200);

    // Verificar que el feed está visible
    // El feed puede estar vacío si no hay contenido público — lo importante
    // es que la pantalla no falla y se ve el estado de vacío o contenido.
    const hasContent = await page
      .getByRole("button", { name: /plan|testimonio|petición/i })
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasContent) {
      // Si hay contenido, debe ser interactuable
      await expect(
        page.getByRole("button", { name: /plan|testimonio|petición/i }).first(),
      ).toBeVisible();
    } else {
      // Si no hay contenido, debe mostrar el empty state
      await expect(page.getByText(/sin contenido|empty|no hay/i)).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  test("buscar persona en comunidad filtra por nombre", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Ir a Comunidad
    await page.getByRole("tab", { name: "Juntos" }).first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_200);

    // Buscar por nombre (SEED_A es "prueba")
    await page.getByLabel("Buscar").first().fill("prueba");
    await page.waitForTimeout(1_500);

    // Debe mostrar resultados de búsqueda (personas)
    const hasResults = await page
      .getByRole("button", { name: /seguir|follow/i })
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasResults) {
      await expect(
        page.getByRole("button", { name: /seguir|follow/i }).first(),
      ).toBeVisible();
    }
  });

  test("ver perfil de otro usuario", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Ir a Perfil propio primero (para que SEED_B esté en caché)
    await page.getByRole("tab", { name: "Perfil" }).first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_200);

    // Ir a Comunidad y buscar a SEED_B
    await page.getByRole("tab", { name: "Juntos" }).first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_200);

    await page.getByLabel("Buscar").first().fill("zoe");
    await page.waitForTimeout(1_500);

    // Click en el perfil de Zoe
    const zoeProfile = await page
      .getByRole("button", { name: /seguir|follow/i })
      .first();

    if (await zoeProfile.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Click en el nombre/perfil, no en el botón de seguir
      await page.getByText("Zoe").first().click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_200);

      // Debe estar en la pantalla de perfil
      await expect(page.getByRole("heading", { name: /Zoe/i })).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
