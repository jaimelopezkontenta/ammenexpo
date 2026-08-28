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
  "app/(auth)/crear-cuenta.tsx": 3,
  "app/(auth)/entrar.tsx": 2,
  "app/(onboarding)/bienvenida.tsx": 13,
  "app/(public)/c/[token].tsx": 5,
  "app/(public)/i/[code].tsx": 2,
  "app/(public)/p/[token].tsx": 13,
  "app/(tabs)/biblia.tsx": 11,
  "app/(tabs)/index.tsx": 16,
  "app/(tabs)/orar.tsx": 8,
  "app/(tabs)/perfil.tsx": 11,
  "app/aceptar.tsx": 5,
  "app/acerca.tsx": 9,
  "app/bloqueados.tsx": 4,
  "app/circulo/[id]/chat.tsx": 9,
  "app/circulo/[id]/index.tsx": 14,
  "app/circulo/buscar.tsx": 6,
  "app/crisis.tsx": 11,
  "app/invitar.tsx": 2,
  "app/legal/[doc].tsx": 2,
  "app/libro/[book]/[chapter].tsx": 11,
  "app/libro/[book]/index.tsx": 3,
  "app/lista/index.tsx": 7,
  "app/lista/orar.tsx": 6,
  "app/moderacion.tsx": 29,
  "app/orar/[planId].tsx": 7,
  "app/persona/[id].tsx": 14,
  "app/peticiones/[id].tsx": 8,
  "app/peticiones/nueva.tsx": 4,
  "app/plan-publico/[planId].tsx": 4,
  "app/plan/[id]/compartir.tsx": 13,
  "app/plan/[id]/dia/[numero].tsx": 3,
  "app/plan/[id]/dias.tsx": 7,
  "app/plan/nuevo.tsx": 11,
  "app/plus.tsx": 10,
  "app/testimonios/index.tsx": 10,
  "app/testimonios/nuevo.tsx": 5,
  "app/versiculo.tsx": 3,
  "components/AuthScreen.tsx": 3,
  "components/Avatar.tsx": 1,
  "components/Button.tsx": 1,
  "components/Card.tsx": 1,
  "components/CirclePlanCard.tsx": 10,
  "components/DaySection.tsx": 1,
  "components/DayView.tsx": 6,
  "components/LanguageSwitcher.tsx": 1,
  "components/LegalText.tsx": 2,
  "components/LoadMore.tsx": 1,
  "components/NavRail.tsx": 2,
  "components/PlanOptionsSheet.tsx": 4,
  "components/PrayForCard.tsx": 5,
  "components/PrayerRequestCard.tsx": 12,
  "components/ReaderToolbar.tsx": 1,
  "components/ScreenState.tsx": 2,
  "components/TabHeader.tsx": 2,
  "components/TextField.tsx": 2,
  "components/VerseCard.tsx": 3,
  "components/VerseOfTheDay.tsx": 3,
  "components/VerseStory.tsx": 3,
  "components/WhoPrayed.tsx": 5,
  "components/Wordmark.tsx": 1,
  "components/panes/CirclesPane.tsx": 5,
  "components/panes/CommunityPane.tsx": 14,
  "components/panes/RequestsPane.tsx": 2,
  "components/ui/Pill.tsx": 1,
  "components/ui/Toast.tsx": 2,
  "core/auth/AuthGate.tsx": 2,
  "core/toast/ToastProvider.tsx": 1,
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
