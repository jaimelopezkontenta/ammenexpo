import { expect, test } from "@playwright/test";

import { runSql, SEED_A, SEED_A_ID, SEED_B, SEED_B_ID } from "./helpers/sql";

/**
 * RDY-08 / journey F de la sección 5 del plan — el contrato B2, de verdad
 * probado por la UI y no solo por SQL.
 *
 * **Por qué existe este archivo.** `docs/evidencias/b2-public-orar-antes.md`
 * citaba `e2e/public-contract.spec.ts` como parte del "después" — y ese
 * archivo no existía. Verificador lógico REJECT, punto 3. Esto es la
 * corrección: el spec real, ejecutado, no solo prometido.
 *
 * **Qué es precondición y qué es lo que se prueba.** Crear el plan público
 * (sin `plan_shares`) es un dato de partida — se hace por SQL controlado,
 * igual que cualquier fixture de `supabase/tests/`, nunca sustituye la
 * acción que se afirma probar. Lo que SÍ pasa por la UI real, en el
 * navegador: que Orar lo excluya, que `/orar/[planId]` lo rechace, que
 * Comunidad lo siga abriendo para leer, y que compartir un enlace desde la
 * propia pantalla de compartir (creado con un clic real, no con una fila
 * insertada a mano) lo haga aparecer en Orar para quien lo canjea.
 */

const PLAN_ID = "e2eb2000-0000-0000-0000-000000000001";
const DAY_ID = "e2eb2000-0000-0000-0000-000000000002";
const PLAN_TITLE = "Plan publico E2E sin compartir";
const DAY_TITLE = "Dia del contrato B2";
const SCRIPTURE_TEXT = "Version E2E del versiculo, solo para este contrato.";

const seedPublicPlanWithoutShare = () => {
  runSql(`
    begin;

    delete from public.prayer_plans where id = '${PLAN_ID}';

    insert into public.prayer_plans
      (id, owner_id, title, duration_days, start_date, visibility, status)
    values
      ('${PLAN_ID}', '${SEED_A_ID}', '${PLAN_TITLE}', 3, current_date, 'public', 'active');

    insert into public.prayer_plan_days
      (id, plan_id, day_number, title, scripture_text, prayer_body, unlock_date)
    values
      ('${DAY_ID}', '${PLAN_ID}', 1, '${DAY_TITLE}', '${SCRIPTURE_TEXT}',
       'Privado, nunca en el E2E.', current_date);

    commit;
  `);
};

const cleanup = () => {
  runSql(`
    begin;
    delete from public.prayer_plans where id = '${PLAN_ID}';
    commit;
  `);
};

test.describe("B2 — contrato public/Orar, por la UI", () => {
  test.beforeAll(() => {
    seedPublicPlanWithoutShare();
  });

  test.afterAll(() => {
    cleanup();
  });

  test("un plan público sin share no aparece en Orar, y /orar/[planId] lo rechaza servidor-side", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_B.email);
    await page.getByLabel("Contraseña").fill(SEED_B.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: "Orar" }).first().click();
    await expect(page.getByText(DAY_TITLE)).toHaveCount(0);

    // El rechazo es del servidor, no de la ausencia en una lista de cliente:
    // entrar directo por la URL, sin pasar por la pestaña, tiene que fallar
    // igual. Esa es exactamente la mitad del contrato que el comentario de
    // la migración B2 promete y que solo un test de UI puede cerrar.
    await page.goto(`/orar/${PLAN_ID}`);
    await expect(
      page.getByText("Ya no tienes acceso a este plan."),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("el mismo plan sigue siendo descubrible y legible desde Comunidad", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_B.email);
    await page.getByLabel("Contraseña").fill(SEED_B.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/comunidad");
    await expect(page.getByText(PLAN_TITLE).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("link", { name: "Ver el plan" }).first().click();

    // Esta pantalla no repite el título del día (solo el del plan y el
    // versículo): se comprueba con el versículo, que sí es contenido propio
    // de esta lectura y no del plan en general.
    await expect(page.getByText(SCRIPTURE_TEXT)).toBeVisible({
      timeout: 10_000,
    });
    // Lectura, no oración: esta pantalla nunca ofrece el botón de orar — eso
    // sigue exigiendo el share explícito que el primer test comprobó que no
    // existe.
    await expect(page.getByRole("button", { name: "Oré por ti" })).toHaveCount(
      0,
    );
  });

  test("desde la pantalla de persona, el plan público abre la lectura pública y no ofrece orar", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_B.email);
    await page.getByLabel("Contraseña").fill(SEED_B.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // La pantalla de persona lista solo planes `public` (`person_plans` los
    // filtra así), así que su enlace debe llevar a /plan-publico/[planId] — la
    // lectura pública — y nunca a /orar/[planId], que sin share explícito
    // rechaza servidor-side (DEF-01 del plan).
    await page.goto(`/persona/${SEED_A_ID}`);
    const planLink = page.getByRole("link", { name: new RegExp(PLAN_TITLE) });
    await expect(planLink).toBeVisible({ timeout: 10_000 });

    await planLink.click();

    // Termina en la lectura pública: la URL lo dice, el versículo (contenido
    // propio de esa lectura) aparece, y no hay botón de orar — orar sigue
    // exigiendo el share explícito que este plan no tiene.
    await expect(page).toHaveURL(/\/plan-publico\//, { timeout: 10_000 });
    await expect(page.getByText(SCRIPTURE_TEXT)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Oré por ti" })).toHaveCount(
      0,
    );
  });

  test("compartir un enlace de verdad (clic real) hace que Orar lo acepte para quien lo canjea", async ({
    browser,
  }) => {
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

      await ownerPage.goto(`/plan/${PLAN_ID}/compartir`);
      const createLink = ownerPage.getByRole("button", {
        name: "Crear enlace",
      });
      // El texto es `selectable` en la pantalla real, no un dato inventado
      // por el test: el mismo `<Text>` que alguien copiaría a mano.
      const linkLocator = ownerPage.getByText(
        /^http:\/\/127\.0\.0\.1:8081\/p\//,
      );
      // La pantalla carga en dos tiempos: primero el plan, luego el estado del
      // enlace. `isVisible()` no espera, así que mirarlo nada más navegar daba
      // «no está» en un runner lento y NO se creaba el enlace (falló en CI el
      // 2026-09-29). Se espera a que aparezca una de las dos cosas y solo entonces
      // se decide: si una corrida anterior dejó el enlace vivo, ya no hay
      // «Crear enlace» que pulsar.
      await expect(createLink.or(linkLocator)).toBeVisible({ timeout: 15_000 });
      if (await createLink.isVisible()) {
        await createLink.click({ timeout: 15_000 });
      }
      await expect(linkLocator).toBeVisible({ timeout: 10_000 });
      const shareUrl = (await linkLocator.textContent())?.trim();
      expect(shareUrl).toBeTruthy();

      const guestPage = await guestContext.newPage();

      // Mismo journey que share-loop: B abre el enlace anónimo, se autentica
      // y el canje al entrar aterriza en `/orar/[id]`. Entrar primero y luego
      // abrir `/p/…` dispara un remount de SessionProvider que canjea y
      // navega antes de que exista el botón «Ver el plan».
      await guestPage.goto(shareUrl!);
      await expect(
        guestPage.getByRole("link", { name: "Ya tengo cuenta" }),
      ).toBeVisible({ timeout: 10_000 });
      await guestPage.getByRole("link", { name: "Ya tengo cuenta" }).click();
      await expect(guestPage.getByLabel("Correo electrónico")).toBeVisible();
      await guestPage.getByLabel("Correo electrónico").fill(SEED_B.email);
      await guestPage.getByLabel("Contraseña").fill(SEED_B.password);
      await guestPage.getByRole("button", { name: "Entrar" }).click();

      // El canje navega a `/orar/[planId]` — el contrato dice que un share
      // explícito abre el día que toca orar, no Hoy. Por si aterriza en tabs,
      // el camino viejo (tab Orar → título) sigue valiendo.
      const prayButton = guestPage.getByRole("button", {
        name: "Oré por ti",
      });

      const landedOnDay = await prayButton
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true)
        .catch(() => false);

      if (!landedOnDay) {
        await guestPage.getByRole("tab", { name: "Orar" }).first().click();
        await expect(guestPage.getByText(DAY_TITLE)).toBeVisible({
          timeout: 10_000,
        });
        await guestPage.getByText(DAY_TITLE).click();
      }

      await expect(prayButton).toBeVisible({ timeout: 10_000 });
    } finally {
      // El share que este test crea de verdad (link + redención) se limpia
      // aparte del `afterAll`: revocar la fila no es responsabilidad del
      // plan en sí.
      runSql(`
        begin;
        delete from public.plan_shares
         where plan_id = '${PLAN_ID}' and shared_with_user_id = '${SEED_B_ID}';
        delete from public.share_links where plan_id = '${PLAN_ID}';
        commit;
      `);

      await ownerContext.close();
      await guestContext.close();
    }
  });
});
