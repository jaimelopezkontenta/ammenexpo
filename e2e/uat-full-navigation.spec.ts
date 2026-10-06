import { expect, test, type Page } from "@playwright/test";

/**
 * UAT — navegación completa como usuario real.
 *
 * Dos sesiones independientes (prueba@ammen.local, zoe@ammen.local):
 *  - Entrar, ver que aterriza en Hoy
 *  - Recorrer las 5 tabs: Hoy, Orar, Biblia, Juntos, Perfil
 *  - Probar flujos clave: crear plan, buscar versículo, ver círculo
 *  - Tomar screenshot de cada pantalla para visual QA
 *
 * No usa baselines visuales — es exploratorio, para detectar bugs de UI.
 */

const USERS = [
  { email: "prueba@ammen.local", password: "ammen1234", name: "Jaime" },
  { email: "zoe@ammen.local", password: "ammen1234", name: "Zoe" },
];

const snapshot = async (page: Page, name: string) => {
  await page.screenshot({
    path: `uat-screenshots/${name}.png`,
    fullPage: false,
  });
};

const login = async (page: Page, user: (typeof USERS)[0]) => {
  await page.goto("/entrar");
  await snapshot(page, `${user.name}-entrar`);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("tab", { name: "Hoy" }).first()).toBeVisible({
    timeout: 20_000,
  });
  await snapshot(page, `${user.name}-hoy`);
};

test.describe("UAT — navegación completa con múltiples usuarios", () => {
  for (const user of USERS) {
    test.describe(`Usuario: ${user.name} (${user.email})`, () => {
      test("recorrer todas las tabs y tomar screenshots", async ({ page }) => {
        await login(page, user);

        // Tab Hoy (ya estamos aquí)
        await expect(
          page.getByRole("tab", { name: "Hoy" }).first(),
        ).toBeVisible();

        // Tab Orar
        await page.getByRole("tab", { name: "Orar" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);
        await snapshot(page, `${user.name}-orar`);
        await expect(
          page.getByRole("tab", { name: "Hoy" }).first(),
        ).toBeVisible();
        await expect(
          page.getByRole("tab", { name: "Orar" }).first(),
        ).toBeVisible();

        // Tab Biblia
        await page.getByRole("tab", { name: "Biblia" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);
        await snapshot(page, `${user.name}-biblia`);
        await expect(
          page.getByRole("tab", { name: "Biblia" }).first(),
        ).toBeVisible();

        // Tab Juntos
        await page.getByRole("tab", { name: "Juntos" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);
        await snapshot(page, `${user.name}-juntos`);
        await expect(
          page.getByRole("tab", { name: "Juntos" }).first(),
        ).toBeVisible();

        // Tab Perfil
        await page.getByRole("tab", { name: "Perfil" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);
        await snapshot(page, `${user.name}-perfil`);
        await expect(
          page.getByRole("tab", { name: "Perfil" }).first(),
        ).toBeVisible();
      });

      test("crear plan de oración", async ({ page }) => {
        await login(page, user);

        // Ir a Orar
        await page.getByRole("tab", { name: "Orar" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);

        // Verificar que "Nuevo plan" está visible
        await expect(
          page.getByRole("button", { name: "Nuevo plan" }),
        ).toBeVisible({
          timeout: 10_000,
        });

        // Click en Nuevo plan
        await page.getByRole("button", { name: "Nuevo plan" }).click();
        await page.waitForTimeout(1_200);
        await snapshot(page, `${user.name}-nuevo-plan`);

        // Verificar formulario
        await expect(
          page.getByText("¿Sobre qué quieres orar?").first(),
        ).toBeVisible({
          timeout: 10_000,
        });

        // Seleccionar duración
        await page.getByRole("radio", { name: "7 días" }).click();

        // Seleccionar tema
        await page.getByRole("checkbox", { name: "Paz" }).click();

        // Crear plan
        await page.getByRole("button", { name: "Crear el plan" }).click();

        // Debe aterrizar en Hoy
        await expect(
          page.getByRole("tab", { name: "Hoy" }).first(),
        ).toBeVisible({
          timeout: 90_000,
        });
        await snapshot(page, `${user.name}-plan-creado`);
      });

      test("buscar versículo en Biblia", async ({ page }) => {
        await login(page, user);

        // Ir a Biblia
        await page.getByRole("tab", { name: "Biblia" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);

        // Buscar "paz"
        await page.getByLabel("Buscar").fill("paz");
        await page.waitForTimeout(2_000);
        await snapshot(page, `${user.name}-busqueda-paz`);

        // Verificar que hay resultados
        await expect(
          page.getByRole("button", { name: /paz/i }).first(),
        ).toBeVisible({ timeout: 10_000 });
      });

      test("ver detalle de círculo público", async ({ page }) => {
        await login(page, user);

        // Ir a Juntos
        await page.getByRole("tab", { name: "Juntos" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);

        // Verificar que hay círculos listados
        const circles = await page.getByRole("heading", { level: 2 }).all();
        const circleCount = circles.length;
        console.log(`${user.name} vio ${circleCount} círculos en Juntos`);

        // Si hay círculos, abrir el primero
        if (circleCount > 0) {
          await page.getByRole("heading", { level: 2 }).first().click();
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1_200);
          await snapshot(page, `${user.name}-circulo-detalle`);
        }
      });

      test("cerrar sesión", async ({ page }) => {
        await login(page, user);

        // Ir a Perfil
        await page.getByRole("tab", { name: "Perfil" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);

        // Buscar y click en "Cerrar sesión"
        const logoutBtn = page.getByRole("button", {
          name: /cerrar sesión|logout/i,
        });
        if (await logoutBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await logoutBtn.click();
          await page.waitForTimeout(2_000);
          await snapshot(page, `${user.name}-logout`);

          // Debe volver a la pantalla de entrada
          await expect(
            page.getByRole("button", { name: "Entrar" }),
          ).toBeVisible({
            timeout: 10_000,
          });
        }
      });
    });
  }
});
