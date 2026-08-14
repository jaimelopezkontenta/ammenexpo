import { expect, test } from "@playwright/test";

import { runSql, SEED_A, SEED_A_ID } from "./helpers/sql";

/**
 * Derechos de privacidad por la UI: exportar datos y revocar un enlace.
 *
 * No borra la cuenta de un seed. El delete de cuenta es destructivo para
 * `prueba`/`zoe` y no se cubre aquí.
 */

const PLAN_ID = "e2e50000-0000-0000-0000-000000000001";
const DAY_ID = "e2e50000-0000-0000-0000-000000000002";
const PLAN_TITLE = "Plan privacidad E2E";
const DAY_TITLE = "Dia privacidad E2E";

const seedPlan = () => {
  runSql(`
    begin;

    delete from public.prayer_plans where id = '${PLAN_ID}';

    insert into public.prayer_plans
      (id, owner_id, title, duration_days, start_date, visibility, status)
    values
      ('${PLAN_ID}', '${SEED_A_ID}', '${PLAN_TITLE}', 3, current_date, 'private', 'active');

    insert into public.prayer_plan_days
      (id, plan_id, day_number, title, scripture_text, prayer_body, unlock_date)
    values
      ('${DAY_ID}', '${PLAN_ID}', 1, '${DAY_TITLE}', 'Versiculo E2E privacidad.',
       'Cuerpo privado, nunca en el log.', current_date);

    commit;
  `);
};

const cleanup = () => {
  runSql(`
    begin;
    delete from public.plan_shares where plan_id = '${PLAN_ID}';
    delete from public.share_links where plan_id = '${PLAN_ID}';
    delete from public.prayer_plans where id = '${PLAN_ID}';
    commit;
  `);
};

const signInAsOwner = async (page: import("@playwright/test").Page) => {
  await page.goto("/entrar");
  await page.getByLabel("Correo electrónico").fill(SEED_A.email);
  await page.getByLabel("Contraseña").fill(SEED_A.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
    timeout: 15_000,
  });
};

test.describe("privacidad — exportar y revocar enlace", () => {
  test.beforeAll(() => {
    seedPlan();
  });

  test.afterAll(() => {
    cleanup();
  });

  test("exportar desde /acerca no crashea y deja notice o descarga", async ({
    page,
  }) => {
    await signInAsOwner(page);
    await page.goto("/acerca");

    const exportButton = page.getByRole("button", {
      name: "Descargar mis datos",
    });
    await expect(exportButton).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page
      .waitForEvent("download", { timeout: 10_000 })
      .catch(() => null);

    await exportButton.click();

    const download = await downloadPromise;
    const notice = page.getByText(/Descargado\.|Listo\./);
    const error = page.getByText("Algo salió mal. Vuelve a intentarlo.");

    await expect
      .poll(async () => (await notice.count()) > 0 || download !== null, {
        timeout: 10_000,
      })
      .toBe(true);

    await expect(error).toHaveCount(0);
    await expect(exportButton).toBeVisible();
  });

  test("revocar el enlace deja el token en estado revocado, no en error de red", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const guestContext = await browser.newContext();

    try {
      const ownerPage = await ownerContext.newPage();
      await signInAsOwner(ownerPage);

      await ownerPage.goto(`/plan/${PLAN_ID}/compartir`);
      await ownerPage.getByRole("button", { name: "Crear enlace" }).click();

      const linkLocator = ownerPage.getByText(
        /^http:\/\/127\.0\.0\.1:8081\/p\//,
      );
      await expect(linkLocator).toBeVisible({ timeout: 10_000 });
      const shareUrl = (await linkLocator.textContent())?.trim();
      expect(shareUrl).toBeTruthy();

      await ownerPage
        .getByRole("button", { name: "Desactivar enlace" })
        .click();
      await expect(ownerPage.getByText("Enlace desactivado")).toBeVisible({
        timeout: 10_000,
      });

      const guestPage = await guestContext.newPage();
      await guestPage.goto(shareUrl!);

      await expect(
        guestPage.getByText("Este enlace ya no está disponible."),
      ).toBeVisible({ timeout: 10_000 });

      await expect(guestPage.getByText("Algo no ha ido bien")).toHaveCount(0);
      await expect(
        guestPage.getByRole("button", { name: "Reintentar" }),
      ).toHaveCount(0);
    } finally {
      runSql(`
        begin;
        delete from public.plan_shares where plan_id = '${PLAN_ID}';
        delete from public.share_links where plan_id = '${PLAN_ID}';
        commit;
      `);

      await ownerContext.close();
      await guestContext.close();
    }
  });
});
