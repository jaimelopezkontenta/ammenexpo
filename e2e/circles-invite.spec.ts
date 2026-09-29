import { expect, test } from "@playwright/test";

import { runSql, runSqlScalar, SEED_A, SEED_B } from "./helpers/sql";

/**
 * RDY-07/08 — círculo privado por la UI: A crea, B entra anónimo por `/c/…`,
 * se autentica y queda en el censo.
 *
 * La acción es el alta y el join (UI). El SQL solo afirma el efecto
 * (`group_members` = 2) y limpia el grupo que este test creó. No se usa el
 * círculo Familia del seed: ya tiene dos personas y no probaría el alta.
 */

const memberCount = (groupId: string) =>
  Number(
    runSqlScalar(`
      select count(*)
      from public.group_members
      where group_id = '${groupId}'
    `),
  );

test.describe("círculos — invitación privada, dos contexts", () => {
  test("A crea un privado, B abre /c anónimo, entra y queda en el censo", async ({
    browser,
  }) => {
    const circleName = `e2e-privado-${Date.now()}`;
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
      await ownerPage.getByRole("button", { name: "Crear círculo" }).click();

      await expect(ownerPage).toHaveURL(/\/circulo\/[0-9a-f-]{36}/i, {
        timeout: 15_000,
      });
      groupId = ownerPage.url().match(/\/circulo\/([0-9a-f-]{36})/i)?.[1] ?? "";
      expect(groupId).toBeTruthy();

      const linkLocator = ownerPage.getByText(
        /^http:\/\/127\.0\.0\.1:8081\/c\//,
      );
      await linkLocator.scrollIntoViewIfNeeded();
      await expect(linkLocator).toBeVisible({ timeout: 15_000 });
      const inviteUrl = (await linkLocator.textContent())?.trim();
      expect(inviteUrl).toBeTruthy();

      const guestPage = await guestContext.newPage();
      await guestPage.goto(inviteUrl!);

      await expect(
        guestPage.getByText(`Te invitan a "${circleName}"`),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        guestPage.getByRole("link", { name: "Ya tengo cuenta" }),
      ).toBeVisible();

      await guestPage.getByRole("link", { name: "Ya tengo cuenta" }).click();
      await expect(guestPage.getByLabel("Correo electrónico")).toBeVisible();
      await guestPage.getByLabel("Correo electrónico").fill(SEED_B.email);
      await guestPage.getByLabel("Contraseña").fill(SEED_B.password);
      await guestPage.getByRole("button", { name: "Entrar" }).click();

      // El canje al entrar (`redeem_share_token`, scope círculo) mete a B sin
      // otro toque y le lleva AL CÍRCULO. Antes aterrizaba en Hoy, a una
      // pestaña del sitio al que le invitaron (Oleada 2a, U6).
      await expect(guestPage).toHaveURL(new RegExp(`/circulo/${groupId}`), {
        timeout: 15_000,
      });
      await expect
        .poll(() => memberCount(groupId), { timeout: 10_000 })
        .toBe(2);

      // Y si vuelve a abrir la invitación ya siendo miembro, no se le ofrece
      // «Unirme» otra vez: el canje al cargar le lleva a su círculo, o, si
      // no llegara a canjearse, la pantalla le ofrece abrirlo.
      await guestPage.goto(inviteUrl!);
      await expect
        .poll(
          async () =>
            new RegExp(`/circulo/${groupId}`).test(guestPage.url()) ||
            (await guestPage
              .getByRole("button", { name: "Abrir el círculo" })
              .count()) > 0,
          { timeout: 10_000 },
        )
        .toBe(true);
      await expect(
        guestPage.getByRole("button", { name: "Unirme" }),
      ).toHaveCount(0);
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
