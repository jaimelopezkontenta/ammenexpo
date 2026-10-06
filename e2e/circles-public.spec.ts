import { expect, test } from "@playwright/test";

import { runSql, runSqlScalar, SEED_A, SEED_B } from "./helpers/sql";

/**
 * RDY-07/08 — círculo público por la UI: A lo crea, B lo encuentra en
 * `/circulo/buscar` y se une. El SQL solo afirma la membresía.
 */

const memberCount = (groupId: string) =>
  Number(
    runSqlScalar(`
      select count(*)
      from public.group_members
      where group_id = '${groupId}'
    `),
  );

test.describe("círculos — directorio público", () => {
  test("A crea un público, B lo busca y se une", async ({ browser }) => {
    const circleName = `e2e-publico-${Date.now()}`;
    const ownerContext = await browser.newContext();
    const guestContext = await browser.newContext();
    let groupId = "";

    try {
      const ownerPage = await ownerContext.newPage();

      await ownerPage.goto("/entrar");
      await ownerPage.getByLabel("Correo electrónico").fill(SEED_A.email);
      await ownerPage.getByLabel("Contraseña").fill(SEED_A.password);
      await ownerPage.getByRole("button", { name: "Entrar" }).click();
      await expect(
        ownerPage.getByRole("tab", { name: "Hoy" }).first(),
      ).toBeVisible({ timeout: 15_000 });

      await ownerPage.goto("/circulos");
      await ownerPage.getByRole("button", { name: "Crear círculo" }).click();
      await expect(ownerPage.getByLabel("Nombre")).toBeVisible({
        timeout: 10_000,
      });
      await ownerPage.getByLabel("Nombre").fill(circleName);
      await ownerPage
        .getByRole("radio", { name: "Cualquiera puede encontrarlo" })
        .click();
      await ownerPage.getByRole("button", { name: "Crear círculo" }).click();

      await expect(ownerPage).toHaveURL(/\/circulo\/[0-9a-f-]{36}/i, {
        timeout: 15_000,
      });
      groupId = ownerPage.url().match(/\/circulo\/([0-9a-f-]{36})/i)?.[1] ?? "";
      expect(groupId).toBeTruthy();
      await expect(
        ownerPage.getByText("Cualquiera puede encontrarlo"),
      ).toBeVisible();

      const guestPage = await guestContext.newPage();
      await guestPage.goto("/entrar");
      await guestPage.getByLabel("Correo electrónico").fill(SEED_B.email);
      await guestPage.getByLabel("Contraseña").fill(SEED_B.password);
      await guestPage.getByRole("button", { name: "Entrar" }).click();
      await expect(
        guestPage.getByRole("tab", { name: "Hoy" }).first(),
      ).toBeVisible({ timeout: 15_000 });

      await guestPage.goto("/circulo/buscar");
      await guestPage.getByLabel("Busca por nombre").fill(circleName);
      await expect(guestPage.getByText(circleName)).toBeVisible({
        timeout: 10_000,
      });
      await guestPage.getByRole("button", { name: "Unirme" }).first().click();

      await expect(guestPage).toHaveURL(new RegExp(`/circulo/${groupId}`), {
        timeout: 15_000,
      });
      await expect
        .poll(() => memberCount(groupId), { timeout: 10_000 })
        .toBe(2);
    } finally {
      if (groupId) {
        runSql(`delete from public.groups where id = '${groupId}';`);
      }
      runSql(`delete from auth.users where email like 'e2e-%@ammen.local';`);
      await ownerContext.close();
      await guestContext.close();
    }
  });
});
