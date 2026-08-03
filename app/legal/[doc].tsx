import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { LegalText } from "@/components/LegalText";
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
    <>
      <Stack.Screen options={{ title: document.title, headerShown: true }} />

      <DawnBackground variant="radial">
        <ScrollView contentContainerClassName="gap-5 px-7 py-8">
          <View className="gap-1">
            <Text className="font-serif-bold text-2xl text-plum">
              {document.title}
            </Text>
            <Text className="font-sans text-sm text-mist-ink">
              {document.updated}
            </Text>
          </View>

          {document.body.map((paragraph, index) => (
            <LegalText key={index} text={paragraph} />
          ))}
        </ScrollView>
      </DawnBackground>
    </>
  );
}
