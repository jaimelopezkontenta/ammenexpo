import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { DaySection } from "@/components/DaySection";
import { Txt } from "@/components/ui/Text";
import { WhoPrayed } from "@/components/WhoPrayed";
import type { Intercession } from "@/core/intercessions/queries";

/**
 * Lo social, que espera al "hecho": primero lo íntimo, después la comunidad.
 * Antes vivía siempre visible en la columna lateral y le quitaba al CTA su
 * momento.
 */
export const AfterPrayed = ({
  planId,
  prayedForMe,
  prayedForMeFailed,
  prayBackPlanId,
  onReport,
  onBlock,
}: {
  planId: string;
  prayedForMe: Intercession[] | undefined;
  prayedForMeFailed: boolean;
  prayBackPlanId: string | null;
  onReport: (intercessionId: string) => void;
  onBlock: (blockedId: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Seeing who showed up for you is the reason to come back
          tomorrow, but it stays visually separate from private prayer. */}
      <DaySection label={t("intercession.whoPrayed")}>
        {prayedForMeFailed ? (
          <Txt variant="body" tone="secondary" accessibilityRole="alert">
            {t("common.errorBody")}
          </Txt>
        ) : (
          <WhoPrayed
            people={prayedForMe ?? []}
            onShare={() =>
              router.push({
                pathname: "/plan/[id]/compartir",
                params: { id: planId },
              })
            }
            onReport={onReport}
            onBlock={onBlock}
          />
        )}
      </DaySection>

      {/* "Pray for their plan" needs a real shared plan to target. */}
      {prayBackPlanId ? (
        <Button
          title={t("intercession.prayBack")}
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/orar/[planId]",
              params: { planId: prayBackPlanId },
            })
          }
        />
      ) : null}
    </>
  );
};
