import { expect, test } from "@playwright/test";

import { runSql, SEED_A } from "./helpers/sql";

/**
 * RDY-07/08 — publicar una petición por la UI y verla en el muro.
 *
 * Independiente del spec de círculos: el muro abierto (`/peticiones/nueva`
 * sin `?circulo=`) es el camino que cualquiera puede recorrer sin un grupo
 * previo. El cuerpo es único por corrida para no confundirlo con otra fila.
 */

test.describe("peticiones — publicar y ver en el muro", () => {
  test("A escribe en /peticiones/nueva y el muro muestra el cuerpo", async ({
    page,
  }) => {
    const body = `E2E peticion ${Date.now()} por quien empieza el muro.`;

    try {
      await page.goto("/entrar");
      await page.getByLabel("Correo electrónico").fill(SEED_A.email);
      await page.getByLabel("Contraseña").fill(SEED_A.password);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
        timeout: 15_000,
      });

      await page.goto("/peticiones/nueva");
      await expect(page.getByLabel("¿Por qué quieres que oren?")).toBeVisible({
        timeout: 10_000,
      });
      await page.getByLabel("¿Por qué quieres que oren?").fill(body);
      await page.getByRole("button", { name: "Pedir oración" }).click();

      await expect(page.getByText(body)).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/peticiones/);
    } finally {
      runSql(
        `delete from public.posts where body = '${body.replace(/'/g, "''")}';`,
      );
      runSql(`delete from auth.users where email like 'e2e-%@ammen.local';`);
    }
  });
});
