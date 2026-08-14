import { expect, test } from "@playwright/test";

import { SEED_A } from "./helpers/sql";

/**
 * RDY-08, journey E — autenticación por la UI: entrar, fallar con gracia,
 * recuperar la contraseña y cerrar sesión.
 *
 * El seed ya siembra `prueba@ammen.local` (`SEED_A`) con onboarding hecho y
 * términos aceptados, así que aquí no se crea nada: los cuatro tests usan la
 * cuenta tal cual y no dejan estado que limpiar — login y logout no escriben
 * filas, y del enlace de recuperación solo se comprueba la UI del envío, no
 * Inbucket ni el correo real.
 *
 * Todo por rol y label, nunca por testID: las cuatro pantallas comparten los
 * textos traducidos de `translation/es.json`, y es justo lo que un lector de
 * pantalla ve. `retries: 0` y `workers: 1` vienen de `playwright.config.ts`,
 * así que cada test arranca de la base recién reseteada y nada aquí introduce
 * sleeps: la navegación se espera con `toBeVisible`.
 */

test.describe("autenticación — entrar, fallar, recuperar, salir", () => {
  test("login con credenciales válidas llega a Hoy", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();

    // El listener de sesión navega solo, sin recargar: no hay URL nueva que
    // esperar hasta que la pestaña "Hoy" existe.
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // La pantalla de login ya no está: si la barra de pestañas existiera pero
    // el formulario siguiera montado, el gate no habría terminado de enrutar.
    await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
  });

  test("login con contraseña incorrecta muestra error", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill("wrongpass");
    await page.getByRole("button", { name: "Entrar" }).click();

    // `auth.invalidCredentials`, que GoTrue devuelve para la contraseña
    // equivocada. No es un error de ningún campo en concreto, así que se
    // muestra suelto, fuera de ambos.
    await expect(
      page.getByText("Correo o contraseña incorrectos."),
    ).toBeVisible({ timeout: 15_000 });

    // El formulario sigue en pie: el error no se lleva la pantalla de login.
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  });

  test("recuperar contraseña muestra confirmación", async ({ page }) => {
    await page.goto("/recuperar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByRole("button", { name: "Mandarme el enlace" }).click();

    // Misma respuesta exista o no la cuenta — no se revela quién está
    // registrado. Solo se comprueba la UI del envío, no Inbucket.
    await expect(
      page.getByText(
        "Si esa dirección tiene cuenta, el enlace ya va de camino. Revisa tu correo.",
      ),
    ).toBeVisible({ timeout: 15_000 });

    // Y la salida de vuelta al login, que sustituye al formulario. Es un
    // enlace a /entrar (el `Link asChild` del CTA), no un botón: en el árbol
    // de accesibilidad se anuncia como `link`, y es justo lo que hay que
    // verificar — que el camino de vuelta existe.
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  });

  test("cerrar sesión vuelve a la pantalla de entrada", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Perfil" }).first().click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    // El gate, al perder la sesión, devuelve a /entrar: el label del campo de
    // correo es la señal más barata de que estamos fuera de la app.
    await expect(page.getByLabel("Correo electrónico")).toBeVisible({
      timeout: 15_000,
    });

    // Y la sesión nueva entra igual que la primera vez: el logout no deja la
    // app en un estado del que no se puede volver a salir.
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
