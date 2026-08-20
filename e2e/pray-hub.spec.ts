import { expect, test } from "@playwright/test";

import { SEED_A } from "./helpers/sql";

/**
 * IA de Orar — el hub de oración, reorganizado en tres momentos (Mis planes,
 * Mi lista, Por otros) dentro de una sola tab.
 *
 * El criterio que protege este test es que la tab Orar nunca es una pared
 * vacía sin salida: con o sin planes ajenos compartidos, quien entra ve la
 * acción de crear un plan («Nuevo plan», `pray.newPlan`) y el acceso a su
 * lista de oración («Orar mi lista» / «Mi lista de oración»). Antes de la
 * reorganización, quien no tenía a nadie compartido se encontraba sola la
 * pared «Todavía nadie ha compartido su plan contigo.» — esta aserción cae
 * si la tab vuelve a ser solo eso, sin los CTAs propios.
 *
 * Se entra con el seed A (`prueba@ammen.local`), que ya tiene onboarding y
 * términos aceptados, igual que `baseline.spec.ts`. No se crea un usuario sin
 * shares: el criterio «empty no vacía la tab» lo cubre el propio código — aquí
 * solo se comprueba que las dos acciones propias están siempre presentes.
 */

test.describe("Orar — hub con acciones propias siempre visibles", () => {
  test("tras login, la tab Orar muestra «Nuevo plan» y el acceso a la lista, no solo la pared vacía", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Orar" }).first().click();

    // La acción de crear un plan, sea cual sea el estado de «Por otros».
    await expect(page.getByText("Nuevo plan").first()).toBeVisible({
      timeout: 10_000,
    });

    // El acceso a la lista propia: el botón «Orar mi lista» (`pray.openList`)
    // o el título «Mi lista de oración» (`list.title`), según lo que muestre
    // la sección en cada estado.
    await expect(
      page.getByText(/Orar mi lista|Mi lista de oración/).first(),
    ).toBeVisible();
  });
});
