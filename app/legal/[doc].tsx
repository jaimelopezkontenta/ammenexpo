import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Txt } from "@/components/ui/Text";
import { LegalText } from "@/components/LegalText";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { legalDocument } from "@/core/legal/documents";

/**
 * Los términos y la política de privacidad, dentro de la app.
 *
 * **Dentro** es la palabra importante: la Guideline 1.2 de Apple no acepta un
 * enlace a una web para el acuerdo que prohíbe el contenido objetable, y hasta
 * este commit no había ni una línea legal en todo el repositorio.
 *
 * Una sola ruta para los dos documentos: son la misma pantalla con distinto
 * texto, y dos ficheros idénticos habrían divergido al primer arreglo.
 */
export default function LegalDocument() {
  const { i18n } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();

  const document = legalDocument(
    doc === "privacidad" ? "privacy" : "terms",
    i18n.language,
  );

  return (
    <ScreenScaffold title={document.title}>
      <View className="gap-1">
        <Txt variant="title">{document.title}</Txt>
        <Txt variant="caption">{document.updated}</Txt>
      </View>

      {document.body.map((paragraph, index) => (
        <LegalText key={index} text={paragraph} />
      ))}
    </ScreenScaffold>
  );
}
