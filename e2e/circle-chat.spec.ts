import { expect, test } from "@playwright/test";

import { runSql, runSqlScalar, SEED_A, SEED_B } from "./helpers/sql";

/**
 * RDY-08 — chat de círculos: enviar mensaje, recibir, y acceso restringido.
 *
 * Tres journeys independientes:
 *
 * 1. **Enviar mensaje en chat.**
 *    A entra a un círculo público, abre el chat, escribe y envía un mensaje.
 *    Se verifica que aparece en la lista.
 *
 * 2. **Mensaje aparece para otro miembro.**
 *    A envía un mensaje; B (otro contexto) lo ve en el chat del mismo círculo.
 *
 * 3. **Chat no accesible desde fuera del círculo.**
 *    Un usuario anónimo (no logueado) intenta acceder al chat de un círculo
 *    y es redirigido a login.
 */

test.describe("chat — círculos", () => {
  test("A envía un mensaje en el chat de su círculo", async ({ browser }) => {
    const circleName = `e2e-chat-${Date.now()}`;
    const ownerContext = await browser.newContext();
    const page = await ownerContext.newPage();
    let groupId = "";

    try {
      // Login
      await page.goto("/entrar");
      await page.getByLabel("Correo electrónico").fill(SEED_A.email);
      await page.getByLabel("Contraseña").fill(SEED_A.password);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
        timeout: 15_000,
      });

      // Crear círculo público
      await page.goto("/circulos");
      await page.getByRole("button", { name: "Crear círculo" }).click();
      await expect(page.getByLabel("Nombre")).toBeVisible({
        timeout: 10_000,
      });
      await page.getByLabel("Nombre").fill(circleName);
      await page
        .getByRole("radio", { name: "Cualquiera puede encontrarlo" })
        .click();
      await page.getByRole("button", { name: "Crear círculo" }).click();
      await expect(page).toHaveURL(/\/circulo\/[0-9a-f-]{36}/i, {
        timeout: 15_000,
      });
      groupId = page.url().match(/\/circulo\/([0-9a-f-]{36})/i)?.[1] ?? "";
      expect(groupId).toBeTruthy();

      // Abrir el chat (es un link, no un botón)
      await page.getByRole("link", { name: "Abrir el chat" }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_200);

      // Escribir y enviar mensaje
      const testMessage = `e2e-chat-msg-${Date.now()}`;
      await page
        .getByRole("textbox", { name: /escribir|mensaje|composer/i })
        .first()
        .fill(testMessage);
      await page
        .getByRole("button", { name: /enviar|send/i })
        .first()
        .click();

      // Verificar que el mensaje aparece en la lista
      await expect(page.getByText(testMessage)).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      if (groupId) {
        // Cleanup SQL
        const { runSql } = await import("./helpers/sql");
        runSql(`delete from public.groups where id = '${groupId}';`);
      }
      await ownerContext.close();
    }
  });

  test("B ve el mensaje de A en el chat del mismo círculo", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const guestContext = await browser.newContext();

    let circleId = "";

    try {
      // A: crear círculo público
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
      const circleName = `e2e-chat-${Date.now()}`;
      await ownerPage.getByLabel("Nombre").fill(circleName);
      await ownerPage
        .getByRole("radio", { name: "Cualquiera puede encontrarlo" })
        .click();
      await ownerPage.getByRole("button", { name: "Crear círculo" }).click();
      await expect(ownerPage).toHaveURL(/\/circulo\/[0-9a-f-]{36}/i, {
        timeout: 15_000,
      });

      const circleId =
        ownerPage.url().match(/\/circulo\/([0-9a-f-]{36})/i)?.[1] ?? "";
      expect(circleId).toBeTruthy();

      // A: abrir chat y enviar mensaje
      await ownerPage.getByRole("link", { name: "Abrir el chat" }).click();
      await ownerPage.waitForLoadState("networkidle");
      await ownerPage.waitForTimeout(1_200);

      const testMessage = `e2e-chat-msg-${Date.now()}`;
      await ownerPage
        .getByRole("textbox", { name: /escribir|mensaje|composer/i })
        .first()
        .fill(testMessage);
      await ownerPage
        .getByRole("button", { name: /enviar|send/i })
        .first()
        .click();
      await expect(ownerPage.getByText(testMessage)).toBeVisible({
        timeout: 10_000,
      });

      const circleIdFromDb = runSqlScalar(`
        select group_id
        from public.conversations
        limit 1
      `);
      expect(circleIdFromDb).toBeTruthy();

      // B: login y ver mensaje
      const guestPage = await guestContext.newPage();
      await guestPage.goto("/entrar");
      await guestPage.getByLabel("Correo electrónico").fill(SEED_B.email);
      await guestPage.getByLabel("Contraseña").fill(SEED_B.password);
      await guestPage.getByRole("button", { name: "Entrar" }).click();
      await expect(
        guestPage.getByRole("tab", { name: "Hoy" }).first(),
      ).toBeVisible({ timeout: 15_000 });
      // B: ir al círculo y abrir chat
      // B: ir a buscar el círculo y unirse
      await guestPage.goto("/circulo/buscar");
      await guestPage.getByLabel("Busca por nombre").fill(circleName);
      await expect(guestPage.getByText(circleName)).toBeVisible({
        timeout: 10_000,
      });
      await guestPage.getByRole("button", { name: "Unirme" }).first().click();
      // Ir al chat del círculo
      await guestPage.goto(`/circulo/${circleId}/chat`);

      // B: debe ver el mensaje de A
      await expect(guestPage.getByText(testMessage)).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      if (circleId) {
        runSql(`delete from public.groups where id = '${circleId}';`);
      }
      await ownerContext.close();
      await guestContext.close();
    }
  });

  test("anónimo no accede al chat — redirige a login", async ({ browser }) => {
    const guestContext = await browser.newContext();

    try {
      const guestPage = await guestContext.newPage();

      // Intentar acceder al chat de un círculo sin estar logueado
      await guestPage.goto("/circulo/1/chat");

      // Debe redirigir a login
      await expect(
        guestPage.getByRole("button", { name: "Entrar" }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await guestContext.close();
    }
  });
});
