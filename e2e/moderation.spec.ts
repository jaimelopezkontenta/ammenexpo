import { expect, test } from "@playwright/test";

import {
  holdStatusForTarget,
  runSql,
  runSqlScalar,
  SEED_A,
  SEED_A_ID,
  SEED_B_ID,
  setStaff,
} from "./helpers/sql";

/**
 * Cola de retenidos por la UI real.
 *
 * Staff se nombra por SQL (`is_staff`), no por el canal admin. El cuerpo
 * del hold es el corpus de `supabase/tests/circles.sql` (insulto del
 * filtro genérico), nunca una oración ni una crisis. El texto no se
 * imprime en logs.
 */

const RELEASE_POST_ID = "e2e40000-0000-0000-0000-000000000001";
const REMOVE_POST_ID = "e2e40000-0000-0000-0000-000000000002";
const REPORTED_POST_ID = "e2e40000-0000-0000-0000-000000000003";
const REPORT_ID = "e2e40000-0000-0000-0000-0000000000a3";

/** Corpus B1a de circles.sql — insulto, no oración, no crisis. */
const HOLD_CORPUS = "eres un idiota";

const seedHeldPost = (postId: string) => {
  runSql(`
    begin;

    delete from public.content_holds where target_id = '${postId}';
    delete from public.posts where id = '${postId}';

    insert into public.posts (id, author_id, body)
    values ('${postId}', '${SEED_B_ID}', '${HOLD_CORPUS}');

    commit;
  `);
};

const deleteHeldPost = (postId: string) => {
  runSql(`
    begin;
    delete from public.content_holds where target_id = '${postId}';
    delete from public.posts where id = '${postId}';
    commit;
  `);
};

const cleanup = () => {
  runSql(`
    begin;

    delete from public.content_holds
     where target_id in ('${RELEASE_POST_ID}', '${REMOVE_POST_ID}');
    delete from public.reports where id = '${REPORT_ID}';
    delete from public.posts
     where id in ('${RELEASE_POST_ID}', '${REMOVE_POST_ID}', '${REPORTED_POST_ID}');

    update public.profiles
       set is_staff = false
     where id = '${SEED_A_ID}';

    commit;
  `);
};

const signInAsStaff = async (page: import("@playwright/test").Page) => {
  await page.goto("/entrar");
  await page.getByLabel("Correo electrónico").fill(SEED_A.email);
  await page.getByLabel("Contraseña").fill(SEED_A.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
    timeout: 15_000,
  });
};

const openHeldQueue = async (page: import("@playwright/test").Page) => {
  await page.goto("/moderacion");
  await page.getByRole("radio", { name: "Retenidos" }).click();
  await expect(page.getByText("Pendiente").first()).toBeVisible({
    timeout: 10_000,
  });
};

test.describe("moderación — hold por UI, staff por SQL", () => {
  test.beforeAll(() => {
    setStaff(SEED_A_ID, true);
  });

  test.afterAll(() => {
    cleanup();
  });

  test("staff libera un hold con motivo; el SQL pasa a released", async ({
    page,
  }) => {
    seedHeldPost(RELEASE_POST_ID);

    try {
      await signInAsStaff(page);
      await openHeldQueue(page);

      await expect
        .poll(() => holdStatusForTarget(RELEASE_POST_ID))
        .toBe("pending");

      await page.getByLabel("Motivo de la decisión…").fill("e2e release");
      await page
        .getByRole("button", { name: "Liberar (falso positivo)" })
        .click();

      await expect(
        page.getByText("Liberado. Vuelve a ser visible."),
      ).toBeVisible({ timeout: 10_000 });

      await expect
        .poll(() => holdStatusForTarget(RELEASE_POST_ID), { timeout: 10_000 })
        .toBe("released");
    } finally {
      deleteHeldPost(RELEASE_POST_ID);
    }
  });

  test("staff retira un hold con motivo; el SQL pasa a removed", async ({
    page,
  }) => {
    seedHeldPost(REMOVE_POST_ID);

    try {
      await signInAsStaff(page);
      await openHeldQueue(page);

      await expect
        .poll(() => holdStatusForTarget(REMOVE_POST_ID))
        .toBe("pending");

      await page.getByLabel("Motivo de la decisión…").fill("e2e remove");
      await page.getByRole("button", { name: "Retirar (abusivo)" }).click();

      await expect(page.getByText("Retirado. Nadie más lo verá.")).toBeVisible({
        timeout: 10_000,
      });

      await expect
        .poll(() => holdStatusForTarget(REMOVE_POST_ID), { timeout: 10_000 })
        .toBe("removed");
    } finally {
      deleteHeldPost(REMOVE_POST_ID);
    }
  });

  // Un post del muro abierto no tiene círculo ni admin: con `hide_post` el
  // staff no podía ocultarlo. La cola lo oculta ahora desde el reporte.
  test("staff oculta desde un reporte un post del muro abierto", async ({
    page,
  }) => {
    runSql(`
      begin;
      delete from public.reports where id = '${REPORT_ID}';
      delete from public.posts where id = '${REPORTED_POST_ID}';

      insert into public.posts (id, author_id, body)
      values ('${REPORTED_POST_ID}', '${SEED_B_ID}', 'Una petición que alguien reportó');

      insert into public.reports (id, reporter_id, target_type, target_id, reason)
      values ('${REPORT_ID}', '${SEED_A_ID}', 'post', '${REPORTED_POST_ID}', 'spam');
      commit;
    `);

    await signInAsStaff(page);
    await page.goto("/moderacion");
    await expect(
      page.getByText("Una petición que alguien reportó"),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Ocultar para todos" }).click();

    await expect(page.getByText("Oculto para todos.")).toBeVisible({
      timeout: 10_000,
    });

    await expect
      .poll(
        () =>
          runSqlScalar(`
            select hidden_by from public.posts where id = '${REPORTED_POST_ID}'
          `),
        { timeout: 10_000 },
      )
      .toBe(SEED_A_ID);
  });
});
