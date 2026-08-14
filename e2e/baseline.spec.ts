import { expect, test } from "@playwright/test";

/**
 * RDY-00 — Gate 0: baseline reproducible, en Chromium contra Supabase local.
 *
 * Cubre el criterio (b) del ticket: "ambos seeds hacen login y aterrizan en
 * Hoy/Orar sin repetir términos/onboarding" — con dos browser contexts
 * aislados, la regla de RDY-07 para cuando el guion necesite dos personas a
 * la vez (todavía no aquí: cada seed entra por su cuenta, pero en contexts
 * que no comparten storage, así que una sesión no puede filtrarse a la otra
 * por accidente).
 *
 * Precondición real, no supuesta: `supabase/seed.sql` siembra
 * `prueba@ammen.local` y `zoe@ammen.local` con onboarding hecho y términos
 * aceptados — por eso el criterio es "sin repetir términos/onboarding" y no
 * "completa el onboarding", que es un guion distinto (RDY-08/journey H de la
 * sección 5 del plan).
 */

const SEEDS = [
  { email: "prueba@ammen.local", password: "ammen1234" },
  { email: "zoe@ammen.local", password: "ammen1234" },
];

test.describe("Gate 0 — smoke de los dos seeds locales", () => {
  for (const seed of SEEDS) {
    test(`${seed.email} entra y aterriza en Hoy sin pasar por onboarding`, async ({
      page,
    }) => {
      await page.goto("/entrar");

      await page.getByLabel("Correo electrónico").fill(seed.email);
      await page.getByLabel("Contraseña").fill(seed.password);
      await page.getByRole("button", { name: "Entrar" }).click();

      // El listener de sesión navega solo, sin recargar: no hay una URL nueva
      // que esperar con `waitForURL` hasta que la pestaña "Hoy" existe.
      await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
        timeout: 15_000,
      });

      // La pestaña Orar, también en la barra: si el login hubiera aterrizado
      // en una pantalla de onboarding o de aceptación legal en vez de dentro
      // de la app, esta barra no existiría todavía.
      await expect(
        page.getByRole("tab", { name: "Orar" }).first(),
      ).toBeVisible();

      // Nunca la pantalla de login ni la de aceptación de términos.
      await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
    });
  }

  test("dos seeds en dos contexts no comparten sesión", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      await pageA.goto("/entrar");
      await pageA.getByLabel("Correo electrónico").fill(SEEDS[0].email);
      await pageA.getByLabel("Contraseña").fill(SEEDS[0].password);
      await pageA.getByRole("button", { name: "Entrar" }).click();
      await expect(pageA.getByRole("tab", { name: "Hoy" }).first()).toBeVisible(
        { timeout: 15_000 },
      );

      // B, en su propio context aislado, sigue sin sesión: si compartieran
      // storage, esto ya estaría dentro de la app en vez de en el login.
      await pageB.goto("/entrar");
      await expect(pageB.getByLabel("Correo electrónico")).toBeVisible();

      await pageB.getByLabel("Correo electrónico").fill(SEEDS[1].email);
      await pageB.getByLabel("Contraseña").fill(SEEDS[1].password);
      await pageB.getByRole("button", { name: "Entrar" }).click();
      await expect(pageB.getByRole("tab", { name: "Hoy" }).first()).toBeVisible(
        { timeout: 15_000 },
      );
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
