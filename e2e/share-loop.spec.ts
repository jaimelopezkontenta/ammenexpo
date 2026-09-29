import { expect, test } from "@playwright/test";

import {
  runSql,
  runSqlScalar,
  SEED_A,
  SEED_A_ID,
  SEED_B,
  SEED_B_ID,
} from "./helpers/sql";

/**
 * RDY-08 — el share loop entero, por la UI real, hasta la intercesión.
 *
 * A (prueba) crea un enlace con un clic de verdad; B (zoe) lo abre en un
 * context aislado **sin sesión** — la prueba de que el preview es anónimo —,
 * se autentica desde el propio preview («Ya tengo cuenta»), el token que
 * quedó guardado se canjea al iniciar sesión, y B aterriza con el plan en
 * Orar. Ahí pulsa «Oré por ti» dos veces y el efecto se comprueba por SQL:
 * exactamente una intercesión (idempotente, nunca dos) y exactamente un
 * aviso. No se simula push físico: ni se inserta un dispositivo, ni se toca
 * `push_outbox`, ni se afirma nada sobre la entrega.
 *
 * **Por qué la segunda pulsación es un doble toque (`clickCount: 2`).**
 * El botón se desmonta tras la primera entrega — pasa a «Gracias…» y navega
 * atrás a los 1,4 s —, así que la única forma real de pulsarlo dos veces es
 * un doble toque. La idempotencia tiene dos capas: el botón queda
 * deshabilitado mientras `loading` (la segunda pulsación no llega a la red) y,
 * como respaldo, el `unique (plan_day_id, intercessor_id)` de `intercessions`
 * más la dedupe key de `notifications`. La aserción es `toBe(1)`, no
 * «al menos una»: si un doble toque llegara a escribir dos filas, este test
 * cae. El caso de dos inserts concurrentes que chocan contra el constraint
 * lo cubre ya `supabase/tests/rls.sql`; aquí se prueba el bucle observable.
 */

const PLAN_ID = "e2e10000-0000-0000-0000-000000000001";
const DAY_ID = "e2e10000-0000-0000-0000-000000000002";
const PLAN_TITLE = "Plan share-loop E2E";
const DAY_TITLE = "Día del share-loop E2E";
const SCRIPTURE_TEXT = "Versículo E2E, solo para el share-loop.";

/**
 * Precondición, no acción: un plan de A con un día desbloqueado, para que el
 * enlace que A crea por UI apunte a algo real. Mismo patrón que
 * `public-contract.spec.ts`.
 */
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
      ('${DAY_ID}', '${PLAN_ID}', 1, '${DAY_TITLE}', '${SCRIPTURE_TEXT}',
       'Oración privada, nunca en el E2E.', current_date);

    commit;
  `);
};

const cleanup = () => {
  runSql(`
    begin;

    delete from public.notifications
     where user_id = '${SEED_A_ID}'
       and type = 'intercession'
       and payload->>'plan_day_id' = '${DAY_ID}';

    delete from public.plan_shares where plan_id = '${PLAN_ID}';
    delete from public.share_links where plan_id = '${PLAN_ID}';
    delete from public.prayer_plans where id = '${PLAN_ID}';

    commit;
  `);
};

const intercessionCount = () =>
  Number(
    runSqlScalar(`
      select count(*)
      from public.intercessions
      where plan_day_id = '${DAY_ID}'
        and intercessor_id = '${SEED_B_ID}'
    `),
  );

const notificationCount = () =>
  Number(
    runSqlScalar(`
      select count(*)
      from public.notifications
      where user_id = '${SEED_A_ID}'
        and type = 'intercession'
        and payload->>'plan_day_id' = '${DAY_ID}'
    `),
  );

test.describe("share-loop — del enlace a la intercesión, idempotente", () => {
  test.beforeAll(() => {
    seedPlan();

    // Precondición, no acción. El seed ya trae una intercesión zoe → prueba
    // (plan `5eed…a1`, día 4) que consume la dedupe key de `notifications`
    // (`intercession:{zoe}:{hoy}`). Sin liberarla, la intercesión de ESTE
    // test no crearía aviso — `on conflict do nothing` — y la aserción de
    // abajo pasaría por una fila que no escribió este test. Se borra solo el
    // aviso (la intercesión del seed queda, porque es de otro día y no
    // interfiere), y el siguiente `db reset` lo regenera.
    runSql(`
      delete from public.notifications
      where user_id = '${SEED_A_ID}'
        and type = 'intercession'
        and payload->>'intercessor_id' = '${SEED_B_ID}';
    `);
  });

  test.afterAll(() => {
    cleanup();
  });

  test("A crea el enlace, B lo abre anónimo, se autentica, canjea y ora dos veces → una intercesión y un aviso", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const guestContext = await browser.newContext();

    try {
      // --- A crea el enlace con un clic real ---
      const ownerPage = await ownerContext.newPage();

      await ownerPage.goto("/entrar");
      await ownerPage.getByLabel("Correo electrónico").fill(SEED_A.email);
      await ownerPage.getByLabel("Contraseña").fill(SEED_A.password);
      await ownerPage.getByRole("button", { name: "Entrar" }).click();
      await expect(
        ownerPage.getByRole("tab", { name: "Hoy" }).first(),
      ).toBeVisible({ timeout: 15_000 });

      await ownerPage.goto(`/plan/${PLAN_ID}/compartir`);
      await ownerPage.getByRole("button", { name: "Crear enlace" }).click();

      // El enlace es el mismo `<Text selectable>` que alguien copiaría a mano,
      // no un dato inventado por el test.
      const linkLocator = ownerPage.getByText(
        /^http:\/\/127\.0\.0\.1:8081\/p\//,
      );
      await expect(linkLocator).toBeVisible({ timeout: 10_000 });
      const shareUrl = (await linkLocator.textContent())?.trim();
      expect(shareUrl).toBeTruthy();

      // --- B abre el preview ANÓNIMO (context aislado, sin sesión) ---
      const guestPage = await guestContext.newPage();

      await guestPage.goto(shareUrl!);

      // Sin sesión, el preview enseña el contenido público y el CTA de alta,
      // no «Ver el plan»: esto es lo que prueba que B sigue siendo anónimo.
      // Los CTA del preview van envueltos en `<Link asChild>`, así que en el
      // DOM salen con role `link`, no `button`.
      await expect(guestPage.getByText(DAY_TITLE)).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        guestPage.getByRole("link", { name: "Ya tengo cuenta" }),
      ).toBeVisible({ timeout: 10_000 });

      // --- B se autentica y canjea ---
      // El token se quedó guardado al abrir el preview (`rememberShareToken`);
      // al entrar, `redeemPendingTokens` lo canjea y B aterriza directo en el
      // día recién canjeado (`/orar/[planId]`), no en Hoy.
      await guestPage.getByRole("link", { name: "Ya tengo cuenta" }).click();
      await expect(guestPage.getByLabel("Correo electrónico")).toBeVisible();
      await guestPage.getByLabel("Correo electrónico").fill(SEED_B.email);
      await guestPage.getByLabel("Contraseña").fill(SEED_B.password);
      await guestPage.getByRole("button", { name: "Entrar" }).click();

      // --- B ora en el plan recién canjeado ---
      // El canje navega a `/orar/[planId]` (sin tabs). Por si una carrera con
      // el redirect de AuthGate lo deja en tabs, se espera «Oré por ti» con
      // timeout largo y, si no aparece, se intenta el camino viejo: tab Orar →
      // título del día. No se exige «Hoy» como señal: ya no es donde aterriza
      // un canje.
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

      // --- B pulsa «Oré por ti» dos veces ---
      await prayButton.click({ clickCount: 2 });

      // --- una intercesión idempotente y un aviso, por SQL ---
      // `expect.poll` y no un sleep: el efecto se confirma cuando la base lo
      // dice, y el doble toque nunca puede dejar dos filas.
      await expect.poll(intercessionCount, { timeout: 10_000 }).toBe(1);
      await expect.poll(notificationCount, { timeout: 10_000 }).toBe(1);

      // --- y sale: tras un canje no hay historia, y `router.back()` le dejaba
      // atrapado en el día que acababa de orar ---
      await expect(guestPage).not.toHaveURL(new RegExp(`/orar/${PLAN_ID}`), {
        timeout: 10_000,
      });

      // --- un deep link en frío también tiene salida, antes de orar o después.
      // Adónde da igual: con `initialRouteName: "(tabs)"` la pila trae Hoy
      // debajo; lo que no puede pasar es quedarse en el día ---
      const coldPage = await guestContext.newPage();
      await coldPage.goto(`/orar/${PLAN_ID}`);
      await coldPage.getByRole("button", { name: "Atrás" }).click();
      await expect(coldPage).not.toHaveURL(new RegExp(`/orar/${PLAN_ID}`), {
        timeout: 10_000,
      });
    } finally {
      // El share que este test crea de verdad (link + redención) se limpia
      // aparte del `afterAll`: la fila del enlace no pertenece al plan en sí.
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
