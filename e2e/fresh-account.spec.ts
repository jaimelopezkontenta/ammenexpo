import { expect, test } from "@playwright/test";

import { runSql } from "./helpers/sql";

/**
 * RDY-00 / RDY-08 — cuenta fresca, de verdad, por la UI: alta → términos →
 * onboarding → Hoy.
 *
 * El seed solo cubre cuentas con onboarding hecho y términos aceptados; este
 * spec cubre la mitad que falta del Gate 0: una cuenta que nace ahora, con la
 * puerta legal y el asistente completos, y que aterriza dentro de la app sin
 * repetir nada. Email único por corrida, así que dos ejecuciones nunca chocan
 * por «ya existe una cuenta con ese correo».
 *
 * **Precondición vs. acción.** No hay precondición SQL: la cuenta se crea por
 * la UI, y la limpieza final (`delete from auth.users`) es solo eso — retirar
 * lo que este test creó, sin usar el service role ni exponer secretos.
 */

test.describe("cuenta fresca — alta, términos, onboarding, a Hoy", () => {
  test("se registra con email único, acepta, completa el onboarding y llega a Hoy", async ({
    page,
  }) => {
    const email = `e2e-fresh-${Date.now()}@ammen.local`;
    const password = "ammen1234";

    try {
      await page.goto("/crear-cuenta");
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("Contraseña").fill(password);
      await page.getByRole("button", { name: "Crear cuenta" }).click();

      // Sin confirmación de email en local (`enable_confirmations = false`),
      // el alta devuelve sesión y el gate lleva a la puerta de términos.
      await expect(page.getByRole("button", { name: "Acepto" })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole("button", { name: "Acepto" }).click();

      // Términos aceptados → onboarding (paso 1: nombre y género).
      await expect(
        page.getByLabel("¿Cómo quieres que te llamemos?"),
      ).toBeVisible({ timeout: 10_000 });
      await page
        .getByLabel("¿Cómo quieres que te llamemos?")
        .fill("Cuenta Fresca E2E");
      await page.getByRole("radio", { name: "En neutro" }).click();
      await page.getByRole("button", { name: "Siguiente" }).click();

      // Paso 2: qué estás viviendo.
      await page.getByRole("checkbox", { name: "Trabajo" }).click();
      await page.getByRole("button", { name: "Siguiente" }).click();

      // Paso 3: por qué te gustaría orar.
      await page.getByRole("checkbox", { name: "Paz" }).click();
      await page.getByRole("button", { name: "Siguiente" }).click();

      // Paso 4: la hora ya viene con «por la mañana» elegida; terminar.
      await page.getByRole("button", { name: "Crear mi plan" }).click();

      // Aterriza en Hoy, dentro de la app: la barra de pestañas existe y la
      // pantalla de login no. Sin plan todavía, Hoy enseña su estado vacío.
      await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByRole("tab", { name: "Orar" }).first(),
      ).toBeVisible();
      await expect(page.getByText("Aún no tienes un plan")).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
    } finally {
      // Limpieza por SQL directo, sin service role: `profiles` referencia
      // `auth.users(id)` con `on delete cascade`, así que perfil, ajustes y
      // todo lo que cuelga de ellos se van en cascada. La contraseña de la
      // cuenta es una de usar y tirar, así que borrar la fila de auth es
      // exactamente lo que deja el estado como estaba.
      runSql(`delete from auth.users where email = '${email}';`);
    }
  });
});
