import { Check } from "@/components/ui/icons";
import { useTranslation } from "react-i18next";
import Animated from "react-native-reanimated";

import { Orb } from "@/components/Orb";
import { Txt } from "@/components/ui/Text";
import { icon, useThemeColors } from "@/theme";
import { enterCelebrate } from "@/theme/motion";

/**
 * El orbe con la marca, como en el montaje. Es el único momento del día en
 * que la app dice "hecho", y decirlo con una línea de texto centrada era
 * desaprovecharlo. Entra con un pequeño estallido de muelle — la celebración,
 * junto con la háptica de éxito. Sin confetti: no es el tono de esta app.
 */
export const PrayedDone = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Animated.View entering={enterCelebrate} className="items-center gap-3">
      <Orb size={92} halo variant="burst">
        <Check
          size={icon.lg}
          color={colors.plum.DEFAULT}
          strokeWidth={icon.strokeWidth}
        />
      </Orb>
      <Txt variant="bodyMedium" className="text-center">
        {t("plan.markedDone")}
      </Txt>
      <Txt variant="caption" className="text-center">
        {t("plan.seeYouTomorrow")}
      </Txt>
    </Animated.View>
  );
};
