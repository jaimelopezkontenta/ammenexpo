import { expect, test } from "@playwright/test";

import { SEED_A } from "./helpers/sql";

/**
 * Contenido en inglés (EN-1..3) — el recorrido mínimo de quien usa Ammen en inglés.
 *
 * La app abre en español y solo cambia si la persona elige otro idioma, que se
 * recuerda en `ammen.language.v1` (core/i18n/languageDetector.ts): el test parte de
 * esa preferencia ya guardada, como un segundo arranque, sin pasar por Perfil. Con
 * la interfaz en inglés el lector debe abrirse en la World English Bible y
 * poder cambiar a la Reina-Valera 1909 sin recargar; la elección se recuerda.
 *
 * Lo que prueba y no probaba nada más: que la migración de datos de la WEB llegó a
 * la base (`bible_verses.version`), que el lector filtra por versión (sin filtro
 * salían las dos superpuestas: cada versículo dos veces) y que la interfaz sigue
 * el idioma guardado.
 */

const LANGUAGE_KEY = "ammen.language.v1";

test.describe("Inglés — interfaz y Biblia", () => {
  test.beforeEach(async ({ page }) => {
    // Cada test tiene su contexto de navegador (localStorage vacío): sin elección
    // explícita de versión, la de por defecto sigue al idioma. Solo se fija el idioma,
    // y no se toca la versión para que la elección del test sobreviva a un `goto`.
    await page.addInitScript((languageKey) => {
      window.localStorage.setItem(languageKey, "en");
    }, LANGUAGE_KEY);
  });

  test("con la interfaz en inglés, el lector abre en la WEB y se puede pasar a la RVR", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Email").fill(SEED_A.email);
    await page.getByLabel("Password").fill(SEED_A.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("tab", { name: "Today" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Juan 3 (libro 43). En inglés la referencia y el texto son los de la WEB.
    await page.goto("/libro/43/3");
    await expect(
      page.getByText(/For God so loved the world/).first(),
    ).toBeVisible({ timeout: 15_000 });
    // Un capítulo con las dos Biblias superpuestas repetiría cada versículo.
    await expect(page.getByText(/For God so loved the world/)).toHaveCount(1);
    await expect(page.getByText(/Porque de tal manera amó Dios/)).toHaveCount(
      0,
    );

    const web = page.getByRole("radio", { name: "World English Bible" });
    const rvr = page.getByRole("radio", { name: "Reina-Valera 1909" });
    await expect(web).toBeVisible();

    // Cambiar de versión no recarga la página y trae el mismo capítulo en español.
    await rvr.click();
    await expect(
      page.getByText(/Porque de tal manera amó Dios/).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/For God so loved the world/)).toHaveCount(0);

    // La elección se recuerda: al volver, sigue en la RVR aunque la interfaz sea inglesa.
    await page.goto("/libro/43/3");
    await expect(
      page.getByText(/Porque de tal manera amó Dios/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("la búsqueda de la Biblia usa la versión que se lee", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Email").fill(SEED_A.email);
    await page.getByLabel("Password").fill(SEED_A.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("tab", { name: "Today" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Bible" }).first().click();
    const search = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/Search/i));
    await search.first().fill("loved the world");
    // «love» no existe en la RVR: si el resultado sale, la búsqueda usó la WEB.
    await expect(page.getByText(/John 3:16/).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
