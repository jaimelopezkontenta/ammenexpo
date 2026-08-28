import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * El contrato de `Txt`, ejecutable (pareja de `contrast.test.ts`).
 *
 * AGENTS.md manda que todo texto pase por `Txt` (`components/ui/Text.tsx`):
 * nada de `<Text>` crudo de React Native con la tripleta `font-* text-*` a
 * mano. Este guard nació como allowlist shrink-only sobre el censo de la
 * migración (2026-08-28, 400 usos en 67 ficheros) y hoy, con la lista vacía,
 * es el ban permanente: cero `<Text>` crudos en app/, components/ y core/.
 *
 * Si este test te ha parado: usa `Txt` con su `variant`/`tone`; el
 * `className` de `Txt` existe para afinar (centrado, márgenes), no para
 * reconstruir variantes.
 */

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "components", "core"];

/** `<Text ` / `<Text>` / `<Text/>` — el componente crudo de React Native. */
const RAW_TEXT = /<Text[\s/>]/g;

/**
 * VACÍA desde el cierre de la migración (2026-08-28): esto ya es el ban
 * permanente. La campaña fue en 5 olas el mismo día — componentes+core,
 * pantallas con red visual, onboarding, pantallas sin red, cierre — y ningún
 * fichero puede volver a entrar aquí.
 */
const ALLOWLIST: Record<string, number> = {};

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });

const census = new Map<string, number>();
for (const dir of SCAN_DIRS) {
  for (const file of tsxFiles(join(ROOT, dir))) {
    const count = (readFileSync(file, "utf8").match(RAW_TEXT) ?? []).length;
    if (count > 0) {
      census.set(relative(ROOT, file).replaceAll("\\", "/"), count);
    }
  }
}

describe("adopción de Txt (allowlist shrink-only)", () => {
  it("ningún fichero estrena <Text> crudo ni crece sobre su censo", () => {
    const offenders = [...census.entries()]
      .filter(([file, count]) => count > (ALLOWLIST[file] ?? 0))
      .map(
        ([file, count]) =>
          `${file}: ${count} <Text> (permitidos ${ALLOWLIST[file] ?? 0}) — usa Txt (components/ui/Text.tsx)`,
      );
    expect(offenders).toEqual([]);
  });

  it("la allowlist encoge con cada ola: fuera entradas ya migradas", () => {
    const stale = Object.keys(ALLOWLIST).filter((file) => !census.has(file));
    expect(
      stale,
      "estos ficheros ya no tienen <Text> crudo: borra su entrada de la allowlist",
    ).toEqual([]);
  });
});
