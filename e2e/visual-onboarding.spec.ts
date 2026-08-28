import { expect, test } from "@playwright/test";

import { runSql } from "./helpers/sql";

/**
 * @visual — la puerta legal y el asistente de bienvenida, con red por fin.
 *
 * El recorrido de `visual.spec.ts` entra con la cuenta del seed, que ya está
 * onboardeada: el gate redirige `/aceptar` y `/bienvenida` a Hoy, así que esas
 * pantallas nunca aparecían en la red visual. Este spec crea una cuenta
 * desechable por la UI (el mismo camino que `fresh-account.spec.ts`) y captura
 * la puerta legal y los 4 pasos del asistente — que viven todos en la misma
 * URL, así que se navega por clicks y se captura por estado.
 *
 * Deliberadamente NO se pulsa «Crear mi plan»: el final del asistente llama a
 * `generate-prayer-plan`, y esta suite no debe depender del provider de IA.
 * Ese happy path completo ya lo cubre `fresh-account.spec.ts` en funcional.
 *
 * **Precondición vs. acción.** Sin precondición SQL: la cuenta nace por la UI
 * y la limpieza final (`delete from auth.users`, cascada a perfil y ajustes)
 * retira exactamente lo que el test creó. Email único por corrida y viewport.
 */

const VIEWPORTS = [
  { name: "movil", width: 390, height: 844 },
  { name: "escritorio", width: 1280, height: 800 },
] as const;

const SNAPSHOT_OPTS = { maxDiffPixelRatio: 0.02, fullPage: false } as const;

for (const viewport of VIEWPORTS) {
  test.describe(`@visual onboarding ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`la puerta legal y el asistente se ven como la referencia (${viewport.name})`, async ({
      page,
    }) => {
      // Alta + 5 capturas con sus esperas: el timeout global de 120 s va justo.
      test.setTimeout(180_000);
      // El email único se calcula ANTES de fijar el reloj: con la hora
      // congelada, `Date.now()` devolvería lo mismo en cada corrida y dos
      // corridas seguidas chocarían en el alta.
      const email = `e2e-visual-${Date.now()}-${viewport.name}@ammen.local`;
      const password = "ammen1234";
      // Hora fija del día real, como en visual.spec: aquí no hay saludo,
      // pero deja el spec inmune a cualquier copy dependiente de la hora.
      const fixed = new Date();
      fixed.setHours(10, 0, 0, 0);
      await page.clock.setFixedTime(fixed);

      try {
        await page.goto("/crear-cuenta");
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByLabel("Contraseña").fill(password);
        await page.getByRole("button", { name: "Crear cuenta" }).click();

        // Puerta legal. Las fuentes remotas llegan un frame después del layout.
        await expect(page.getByRole("button", { name: "Acepto" })).toBeVisible({
          timeout: 15_000,
        });
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(
          `aceptar-${viewport.name}.png`,
          SNAPSHOT_OPTS,
        );
        await page.getByRole("button", { name: "Acepto" }).click();

        // Paso 1 — nombre y género. Se captura con el paso ya respondido:
        // el contenido determinista antes que el caret (Playwright lo oculta).
        await expect(
          page.getByLabel("¿Cómo quieres que te llamemos?"),
        ).toBeVisible({ timeout: 10_000 });
        await page
          .getByLabel("¿Cómo quieres que te llamemos?")
          .fill("Visual E2E");
        await page.getByRole("radio", { name: "En neutro" }).click();
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(
          `onboarding-paso1-${viewport.name}.png`,
          SNAPSHOT_OPTS,
        );
        await page.getByRole("button", { name: "Siguiente" }).click();

        // Paso 2 — qué estás viviendo.
        await expect(
          page.getByRole("checkbox", { name: "Trabajo" }),
        ).toBeVisible();
        await page.getByRole("checkbox", { name: "Trabajo" }).click();
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(
          `onboarding-paso2-${viewport.name}.png`,
          SNAPSHOT_OPTS,
        );
        await page.getByRole("button", { name: "Siguiente" }).click();

        // Paso 3 — por qué orar.
        await expect(page.getByRole("checkbox", { name: "Paz" })).toBeVisible();
        await page.getByRole("checkbox", { name: "Paz" }).click();
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(
          `onboarding-paso3-${viewport.name}.png`,
          SNAPSHOT_OPTS,
        );
        await page.getByRole("button", { name: "Siguiente" }).click();

        // Paso 4 — la hora, con «por la mañana» preseleccionada. Se captura
        // el estado listo para terminar, sin pulsar «Crear mi plan».
        await expect(
          page.getByRole("button", { name: "Crear mi plan" }),
        ).toBeVisible();
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(
          `onboarding-paso4-${viewport.name}.png`,
          SNAPSHOT_OPTS,
        );
      } finally {
        runSql(`delete from auth.users where email = '${email}';`);
      }
    });
  });
}
