import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * El contrato de `Txt`, ejecutable (pareja de `contrast.test.ts`).
 *
 * AGENTS.md manda que todo texto pase por `Txt` (`components/ui/Text.tsx`):
 * nada de `<Text>` crudo de React Native con la tripleta `font-* text-*` a
 * mano. Este guard es la migración convertida en barrera: la allowlist es la
 * foto del censo al arrancar la adopción (2026-08-28, 400 usos en 67
 * ficheros) y **solo puede encoger** — cada ola que migra un fichero borra su
 * entrada, un fichero fuera de la lista no puede estrenar `<Text>`, y cuando
 * la lista quede vacía esto se convierte en el ban permanente.
 *
 * Si este test te ha parado: usa `Txt` con su `variant`/`tone`; el
 * `className` de `Txt` existe para afinar (centrado, márgenes), no para
 * reconstruir variantes.
 */

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "components", "core"];

/** `<Text ` / `<Text>` / `<Text/>` — el componente crudo de React Native. */
const RAW_TEXT = /<Text[\s/>]/g;

/** Censo al arrancar la adopción. Solo se borra o se reduce, nunca crece. */
const ALLOWLIST: Record<string, number> = {
  "app/(onboarding)/bienvenida.tsx": 13,
  "app/(public)/c/[token].tsx": 5,
  "app/(public)/i/[code].tsx": 2,
  "app/(public)/p/[token].tsx": 13,
  "app/aceptar.tsx": 5,
  "app/acerca.tsx": 9,
  "app/bloqueados.tsx": 4,
  "app/circulo/[id]/index.tsx": 14,
  "app/circulo/buscar.tsx": 6,
  "app/invitar.tsx": 2,
  "app/legal/[doc].tsx": 2,
  "app/lista/orar.tsx": 6,
  "app/moderacion.tsx": 29,
  "app/orar/[planId].tsx": 7,
  "app/peticiones/[id].tsx": 8,
  "app/peticiones/nueva.tsx": 4,
  "app/plan-publico/[planId].tsx": 4,
  "app/plan/[id]/compartir.tsx": 13,
  "app/plan/[id]/dia/[numero].tsx": 3,
  "app/plan/nuevo.tsx": 11,
  "app/testimonios/index.tsx": 10,
  "app/testimonios/nuevo.tsx": 5,
  "app/versiculo.tsx": 3,
  // Ola 1 (2026-08-28): components/** y core/** migrados enteros a Txt.
  // Ola 2 (2026-08-28): las 14 pantallas con red visual, a cero.
};

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
