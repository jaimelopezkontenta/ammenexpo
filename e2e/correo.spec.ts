import { expect, test } from "@playwright/test";

import { runSqlScalar, SEED_A } from "./helpers/sql";

/**
 * Preferencias de correo: chips, guardado, meta del NavRow en Perfil, y baja
 * pública con token firmado (sin sesión). No llama a Resend.
 */

test.describe("correo — cadencia en Perfil y baja sin sesión", () => {
  test("Perfil muestra la meta, Correo guarda Cada día", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Perfil" }).first().click();
    await expect(page.getByRole("link", { name: /Correo/ })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("link", { name: /Correo/ }).click();
    await expect(page.getByRole("radio", { name: "Entre semana" })).toBeVisible(
      { timeout: 10_000 },
    );

    await page.getByRole("radio", { name: "Entre semana" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado.")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("link", { name: /Atrás/i }).click();
    await expect(
      page.getByRole("link", { name: /Correo\. Entre semana/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("el token público apaga el versículo sin pedir sesión", async ({
    page,
  }) => {
    const token = runSqlScalar(`
      select public.issue_email_prefs_token(
        '5eed0000-0000-0000-0000-000000000001'::uuid
      );
    `);

    await page.goto(`/correo?t=${encodeURIComponent(token)}`);
    await expect(page.getByRole("radio", { name: "Nunca" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("radio", { name: "Nunca" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado.")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
  });
});
