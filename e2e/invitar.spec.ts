import { expect, test } from "@playwright/test";

import { runSql, runSqlScalar, SEED_A, SEED_A_ID } from "./helpers/sql";

/**
 * RDY-07/08 — invitación a la app: A genera el enlace en `/invitar`, B lo
 * abre anónimo en `/i/{code}`, se registra y el canje deja un follow.
 *
 * El alta es por la UI (como `fresh-account.spec.ts`). El SQL afirma el
 * `follows` y borra la cuenta `e2e-*` al terminar.
 */

const followCount = (followerEmail: string) =>
  Number(
    runSqlScalar(`
      select count(*)
      from public.follows f
      join auth.users u on u.id = f.follower_id
      where u.email = '${followerEmail}'
        and f.followee_id = '${SEED_A_ID}'
    `),
  );

test.describe("invitar — enlace de app, alta y canje de follow", () => {
  test("A crea el enlace, B lo abre anónimo, se registra y sigue a A", async ({
    browser,
  }) => {
    const email = `e2e-invitar-${Date.now()}@ammen.local`;
    const password = "ammen1234";
    const ownerContext = await browser.newContext();
    const guestContext = await browser.newContext();

    try {
      const ownerPage = await ownerContext.newPage();

      await ownerPage.goto("/entrar");
      await ownerPage.getByLabel("Correo electrónico").fill(SEED_A.email);
      await ownerPage.getByLabel("Contraseña").fill(SEED_A.password);
      await ownerPage.getByRole("button", { name: "Entrar" }).click();
      await expect(
        ownerPage.getByRole("tab", { name: "Hoy" }).first(),
      ).toBeVisible({ timeout: 15_000 });

      await ownerPage.goto("/invitar");
      await expect(
        ownerPage.getByRole("button", { name: "Invitar amigos" }),
      ).toBeVisible({ timeout: 10_000 });
      await ownerPage.getByRole("button", { name: "Invitar amigos" }).click();

      const linkLocator = ownerPage.getByText(
        /^http:\/\/127\.0\.0\.1:8081\/i\//,
      );
      await expect(linkLocator).toBeVisible({ timeout: 10_000 });
      const inviteUrl = (await linkLocator.textContent())?.trim();
      expect(inviteUrl).toBeTruthy();

      const guestPage = await guestContext.newPage();
      await guestPage.goto(inviteUrl!);

      await expect(
        guestPage.getByText("Jaime te invita a orar en Ammen"),
      ).toBeVisible({ timeout: 10_000 });
      await guestPage.getByRole("link", { name: "Crear mi cuenta" }).click();

      await expect(guestPage.getByLabel("Correo electrónico")).toBeVisible();
      await guestPage.getByLabel("Correo electrónico").fill(email);
      await guestPage.getByLabel("Contraseña").fill(password);
      await guestPage.getByRole("button", { name: "Crear cuenta" }).click();

      await expect(
        guestPage.getByRole("button", { name: "Acepto" }),
      ).toBeVisible({ timeout: 15_000 });
      await guestPage.getByRole("button", { name: "Acepto" }).click();

      await expect(
        guestPage.getByLabel("¿Cómo quieres que te llamemos?"),
      ).toBeVisible({ timeout: 10_000 });
      await guestPage
        .getByLabel("¿Cómo quieres que te llamemos?")
        .fill("Invitada E2E");
      await guestPage.getByRole("radio", { name: "En neutro" }).click();
      await guestPage.getByRole("button", { name: "Siguiente" }).click();
      await guestPage.getByRole("checkbox", { name: "Trabajo" }).click();
      await guestPage.getByRole("button", { name: "Siguiente" }).click();
      await guestPage.getByRole("checkbox", { name: "Paz" }).click();
      await guestPage.getByRole("button", { name: "Siguiente" }).click();
      await guestPage.getByRole("button", { name: "Crear mi plan" }).click();

      await expect(
        guestPage.getByRole("tab", { name: "Hoy" }).first(),
      ).toBeVisible({ timeout: 90_000 });

      await expect.poll(() => followCount(email), { timeout: 10_000 }).toBe(1);
    } finally {
      runSql(`delete from auth.users where email = '${email}';`);
      runSql(`delete from auth.users where email like 'e2e-%@ammen.local';`);
      await ownerContext.close();
      await guestContext.close();
    }
  });
});
