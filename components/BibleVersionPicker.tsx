import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { BIBLE_VERSIONS, type BibleVersion } from "@/core/bible/versions";

import { Pill } from "@/components/ui/Pill";

/**
 * El selector de versión de la Biblia (RVR1909/WEB): un solo grupo de radio
 * con su nombre («Versión de la Biblia»). Vive en el lector y en la pestaña
 * Biblia; la elección es global (`useBibleVersion`) y las dos pantallas se
 * enteran a la vez.
 *
 * En pantalla van las siglas porque «Reina-Valera 1909» y «World English
 * Bible» enteros no caben en una fila de teléfono; cada opción se anuncia
 * por su nombre entero y marcada o no.
 */
export const BibleVersionPicker = ({
  version,
  onVersion,
}: {
  version: BibleVersion;
  onVersion: (next: BibleVersion) => void;
}) => {
  const { t } = useTranslation();

  return (
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
  );
};
