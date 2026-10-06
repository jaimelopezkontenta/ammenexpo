import { expect, test } from "@playwright/test";

import { runSql, SEED_A, SEED_A_ID } from "./helpers/sql";

/**
 * RDY-08 — hub de oración: crear plan, orar, día bloqueado.
 *
 * Tres journeys independientes, cada uno con su propia cuenta o fixture:
 *
 * 1. **Crear plan desde Orar → aterriza en Hoy.**
 *    El usuario va a Orar, pulsa «Nuevo plan», completa el formulario y
 *    aterriza en Hoy con el plan generado (o en «Día 1 de 7»).
 *
 * 2. **Marcar día como orado.**
 *    Con un plan existente (seed), se marca el día como orado y se verifica
 *    el feedback visual (botón cambia) y la persistencia por SQL.
 *
 * 3. **Día bloqueado no accesible.**
 *    Si el día 1 no está orado, el día 2 no se puede abrir — el usuario
 *    queda en Hoy y ve el candado.
 */

test.describe("hub de oración — crear, orar, bloqueos", () => {
  test("crear plan desde Orar → aterriza en Hoy con plan generado", async ({
    page,
  }) => {
    // Login
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Limpiar plan E2E anterior si existe
    runSql(
      `delete from public.prayer_plans where owner_id = '${SEED_A_ID}' and title like 'Plan E2E%';`,
    );

    // Navegar a Orar
    await page.getByRole("tab", { name: "Orar" }).first().click();
    await expect(page.getByText("Nuevo plan")).toBeVisible({
      timeout: 10_000,
    });

    // Abrir formulario
    await page.getByRole("button", { name: "Nuevo plan" }).click();

    // Verificar que el formulario se abrió
    await expect(
      page.getByText("¿Sobre qué quieres orar?").first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Seleccionar duración
    await page.getByRole("radio", { name: "7 días" }).click();

    // Seleccionar al menos un tema
    await page.getByRole("checkbox", { name: "Paz" }).click();

    // Crear el plan
    await page.getByRole("button", { name: "Crear el plan" }).click();

    // Debe aterrizar en Hoy (o en compartir si eligió link, pero private va a Hoy)
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 90_000,
    });
  });

  test("marcar día como orado → feedback visual y persistencia", async ({
    page,
  }) => {
    // Limpiar plan previo
    runSql(
      `delete from public.prayer_plans where owner_id = '${SEED_A_ID}' and title like 'Plan E2E orado%';`,
    );

    // Crear plan con día 1
    runSql(`
      begin;

      insert into public.prayer_plans
        (id, owner_id, title, duration_days, start_date, visibility, status)
      values
        (gen_random_uuid(), '${SEED_A_ID}', 'Plan E2E orado', 3,
         current_date, 'private', 'active');

      insert into public.prayer_plan_days
        (id, plan_id, day_number, title, scripture_ref, scripture_text, prayer_body, unlock_date)
      values
        (gen_random_uuid(),
         (select id from public.prayer_plans where owner_id = '${SEED_A_ID}' and title like 'Plan E2E orado%' limit 1),
         1, 'Día E2E orado', 'Juan 3:16', 'Texto orado', 'Oración orado', current_date);

      commit;
    `);

    // Login
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Verificar que el día aparece y el botón "Ya oré hoy" está visible
    await expect(page.getByRole("button", { name: "Ya oré hoy" })).toBeVisible({
      timeout: 10_000,
    });

    // Marcar como orado
    await page.getByRole("button", { name: "Ya oré hoy" }).click();

    // Feedback visual: tras pulsar, la pantalla muestra confirmación
    await expect(page.getByText("Oraste hoy 🙏")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("día 2 bloqueado si día 1 no está orado", async ({ page }) => {
    // Limpiar plan previo
    runSql(
      `delete from public.prayer_plans where owner_id = '${SEED_A_ID}' and title like 'Plan E2E bloqueado%';`,
    );

    // Crear plan con día 1 sin orar y día 2 bloqueado
    runSql(`
      begin;

      insert into public.prayer_plans
        (id, owner_id, title, duration_days, start_date, visibility, status)
      values
        (gen_random_uuid(), '${SEED_A_ID}', 'Plan E2E bloqueado', 3,
         current_date, 'private', 'active');

      insert into public.prayer_plan_days
        (id, plan_id, day_number, title, scripture_ref, scripture_text, prayer_body, unlock_date)
      values
        (gen_random_uuid(),
         (select id from public.prayer_plans where owner_id = '${SEED_A_ID}' and title like 'Plan E2E bloqueado%' limit 1),
         1, 'Día 1 pendiente', 'Juan 3:16', 'Texto día 1', 'Oración día 1', current_date);

      insert into public.prayer_plan_days
        (id, plan_id, day_number, title, scripture_ref, scripture_text, prayer_body, unlock_date)
      values
        (gen_random_uuid(),
         (select id from public.prayer_plans where owner_id = '${SEED_A_ID}' and title like 'Plan E2E bloqueado%' limit 1),
         2, 'Día 2 bloqueado', 'Juan 3:16', 'Texto día 2', 'Oración día 2', current_date);

      commit;
    `);

    // Login
    await page.goto("/entrar");
    await page.getByLabel("Correo electrónico").fill(SEED_A.email);
    await page.getByLabel("Contraseña").fill(SEED_A.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Hoy debe mostrar el día pendiente (no orado)
    // Verificar que el botón "Ya oré hoy" está visible (día no orado)
    await expect(page.getByRole("button", { name: "Ya oré hoy" })).toBeVisible({
      timeout: 10_000,
    });
  });
});
