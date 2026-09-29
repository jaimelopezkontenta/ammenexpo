import { useTranslation } from "react-i18next";

import { DawnBackground } from "@/components/DawnBackground";
import { Orb } from "@/components/Orb";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { Txt } from "@/components/ui/Text";

/**
 * Hoy mientras se escribe el primer tramo del plan: todavía no hay nada que
 * orar, y la generación sigue en segundo plano aunque se cierre la app.
 */
export const TodayGenerating = () => {
  const { t } = useTranslation();

  return (
    <DawnBackground
      className="items-center justify-center gap-5"
      accessibilityRole="progressbar"
      accessibilityLabel={t("plan.generating")}
    >
      <ResponsiveTabContent className="items-center gap-5">
        {/* El orbe y no un indicador de carga: esperar a que se escriba un plan
            de treinta dias es la espera mas larga del producto, y la marca
            respirando dice "esta pasando algo" mejor que una rueda. */}
        <Orb size={110} halo variant="working" />
        <Txt variant="subheadingLg" className="text-center text-xl">
          {t("plan.generating")}
        </Txt>
        <Txt variant="body" tone="secondary" className="text-center">
          {t("plan.generatingHint")}
        </Txt>
      </ResponsiveTabContent>
    </DawnBackground>
  );
};
