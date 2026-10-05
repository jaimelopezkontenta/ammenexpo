import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { FONT_STEPS, type ReaderFontStep } from "@/core/bible/readerPrefs";
import type { BibleVersion } from "@/core/bible/versions";

import { BibleVersionPicker } from "@/components/BibleVersionPicker";
import { GlassIconButton } from "@/components/ui/GlassIconButton";
import { Txt } from "@/components/ui/Text";

/**
 * Las herramientas de lectura: la versión a la izquierda y el tamaño de letra a
 * la derecha. Una fila discreta sobre el panel, no una barra: aquí manda el
 * capítulo. El selector de versión es el compartido (`BibleVersionPicker`).
 */
export const ReaderToolbar = ({
  step,
  onStep,
  version,
  onVersion,
}: {
  step: ReaderFontStep;
  onStep: (next: ReaderFontStep) => void;
  version: BibleVersion;
  onVersion: (next: BibleVersion) => void;
}) => {
  const { t } = useTranslation();
  const index = FONT_STEPS.indexOf(step);

  const control = (
    label: string,
    accessibilityLabel: string,
    next: ReaderFontStep | null,
    textClass: string,
  ) => (
    <GlassIconButton
      accessibilityLabel={accessibilityLabel}
      disabled={next === null}
      onPress={() => next && onStep(next)}
    >
      {/* La A de muestra: serif del sistema con el tamaño del control
          (la clase de tamaño del caller gana a la escala de `title`). */}
      <Txt variant="title" className={textClass}>
        {label}
      </Txt>
    </GlassIconButton>
  );

  return (
    <View className="flex-row items-center justify-between gap-3 px-5 pb-3 md:px-0">
      <BibleVersionPicker version={version} onVersion={onVersion} />
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
