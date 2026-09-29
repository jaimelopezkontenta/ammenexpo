import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { DayView } from "@/components/DayView";
import { Pill } from "@/components/ui/Pill";
import type { BibleBook } from "@/core/bible/navigation";
import type { PlanDay } from "@/core/plans/queries";
import { enterFade } from "@/theme/motion";

// Los tres pasos del journey diario. La Palabra no está aquí: no es un paso,
// es la puerta, y por eso se queda siempre encima de la parte elegida.
export const JOURNEY_STEPS = [
  { key: "meaning", labelKey: "plan.stepReflect" },
  { key: "action", labelKey: "plan.stepApply" },
  { key: "prayer", labelKey: "plan.stepPray" },
] as const;

export type JourneyStep = (typeof JOURNEY_STEPS)[number]["key"];

/**
 * Los tres pasos del journey y el día en el paso elegido. El paso vive en la
 * pantalla y no aquí: sobrevive a que Hoy pase un momento por «cargando»
 * (al cambiar de plan, por ejemplo), como siempre hizo.
 */
export const JourneySteps = ({
  step,
  onStepChange,
  day,
  books,
}: {
  step: JourneyStep;
  onStepChange: (step: JourneyStep) => void;
  day: PlanDay;
  books: BibleBook[];
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Los tres pasos del journey, con la misma píldora que usa el
          switcher: la elegida oscura, las otras de vidrio. */}
      <View accessibilityRole="tablist" className="flex-row gap-2">
        {JOURNEY_STEPS.map((journeyStep) => {
          const selected = step === journeyStep.key;

          return (
            <Pill
              key={journeyStep.key}
              label={t(journeyStep.labelKey)}
              selected={selected}
              role="tab"
              onPress={() => onStepChange(journeyStep.key)}
            />
          );
        })}
      </View>

      {/* El `key` remonta el contenido al cambiar de chip: el paso
          elegido entra con un fade en vez de aparecer de golpe. */}
      <Animated.View key={step} entering={enterFade}>
        <DayView day={day} books={books} focus={step} />
      </Animated.View>
    </>
  );
};
