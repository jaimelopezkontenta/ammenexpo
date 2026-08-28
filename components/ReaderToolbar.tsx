import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { FONT_STEPS, type ReaderFontStep } from "@/core/bible/readerPrefs";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

/**
 * Las herramientas de lectura: la versión a la izquierda (informativa — hoy
 * solo hay una) y el tamaño de letra a la derecha. Una fila discreta sobre el
 * panel, no una barra: aquí manda el capítulo.
 */
export const ReaderToolbar = ({
  step,
  onStep,
}: {
  step: ReaderFontStep;
  onStep: (next: ReaderFontStep) => void;
}) => {
  const { t } = useTranslation();
  const index = FONT_STEPS.indexOf(step);

  const control = (
    label: string,
    accessibilityLabel: string,
    next: ReaderFontStep | null,
    textClass: string,
  ) => (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={next === null}
      onPress={() => next && onStep(next)}
      className={`h-11 w-11 items-center justify-center rounded-full border border-glassedge/60 bg-glass/60 ${
        next === null ? "opacity-40" : ""
      }`}
    >
      {/* La A de muestra: serif del sistema con el tamaño del control
          (la clase de tamaño del caller gana a la escala de `title`). */}
      <Txt variant="title" className={textClass}>
        {label}
      </Txt>
    </Tap>
  );

  return (
    <View className="flex-row items-center justify-between gap-3 px-5 pb-3 md:px-0">
      <Txt variant="editorial" className="text-base">
        {t("bible.subtitle")}
      </Txt>
      <View className="flex-row gap-2">
        {control(
          "A",
          t("bible.textSmaller"),
          index > 0 ? FONT_STEPS[index - 1] : null,
          "text-sm",
        )}
        {control(
          "A",
          t("bible.textLarger"),
          index < FONT_STEPS.length - 1 ? FONT_STEPS[index + 1] : null,
          "text-xl",
        )}
      </View>
    </View>
  );
};
