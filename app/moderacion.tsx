import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ChoiceChips } from "@/components/ChoiceChips";
import { CrisisQueue } from "@/components/moderacion/CrisisQueue";
import { HeldQueue } from "@/components/moderacion/HeldQueue";
import { ReportsQueue } from "@/components/moderacion/ReportsQueue";
import { ScreenScaffold } from "@/components/ScreenScaffold";

type ModerationMode = "reports" | "held" | "crisis";

/**
 * La cola de moderación.
 *
 * Tres colas distintas, a propósito nunca mezcladas en una sola lista:
 *
 * 1. **Reportes** — alguien lo señaló a mano.
 * 2. **Retenidos** (B1a) — el filtro lo retuvo solo; nadie lo reportó y su
 *    autor sigue creyendo que lo publicó, con una nota. Reclamar, liberar o
 *    retirar quedan auditados desde `content_holds`.
 * 3. **Crisis** (B1b) — nunca comparte cola con lo anterior. No es "contenido
 *    por revisar", es un registro de guardia: acusar recibo, no moderar.
 *
 * Cada cola es su propio componente en components/moderacion/.
 */
export default function Moderation() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ModerationMode>("reports");

  return (
    <ScreenScaffold title={t("moderation.queueTitle")}>
      <ChoiceChips
        options={[
          { value: "reports", label: t("moderation.mode.reports") },
          { value: "held", label: t("moderation.mode.held") },
          { value: "crisis", label: t("moderation.mode.crisis") },
        ]}
        selected={[mode]}
        onToggle={(value) => setMode(value as ModerationMode)}
      />

      {mode === "reports" ? <ReportsQueue /> : null}
      {mode === "held" ? <HeldQueue /> : null}
      {mode === "crisis" ? <CrisisQueue /> : null}
    </ScreenScaffold>
  );
}
