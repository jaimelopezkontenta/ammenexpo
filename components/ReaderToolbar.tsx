import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { FONT_STEPS, type ReaderFontStep } from "@/core/bible/readerPrefs";
import { BIBLE_VERSIONS, type BibleVersion } from "@/core/bible/versions";

import { GlassIconButton } from "@/components/ui/GlassIconButton";
import { Pill } from "@/components/ui/Pill";
import { Txt } from "@/components/ui/Text";

/**
 * Las herramientas de lectura: la versión a la izquierda y el tamaño de letra a
 * la derecha. Una fila discreta sobre el panel, no una barra: aquí manda el
 * capítulo.
 *
 * La versión es un solo grupo de radio con su nombre («Versión de la Biblia»):
 * cada opción se anuncia por su nombre entero y marcada o no. En pantalla van
 * las siglas porque «Reina-Valera 1909» y «World English Bible» enteros no
 * caben junto a los dos botones de letra en un teléfono.
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
      <View
        className="flex-row gap-2"
        accessibilityRole="radiogroup"
        accessibilityLabel={t("bible.versionPicker")}
      >
        {BIBLE_VERSIONS.map((option) => (
          <Pill
            key={option}
            label={t(`bible.versionShort.${option}`)}
            accessibilityLabel={t(`bible.versionName.${option}`)}
            selected={option === version}
            role="radio"
            // Tocar la que ya se lee no hace nada: si contara como elección,
            // quien solo la tocó dejaría de seguir al idioma de la app sin
            // haber elegido nada.
            onPress={() => {
              if (option !== version) onVersion(option);
            }}
          />
        ))}
      </View>
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
