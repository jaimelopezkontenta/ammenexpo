import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Card } from "@/components/Card";
import { useVerseOfTheDay } from "@/core/bible/queries";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

/**
 * El versículo del día.
 *
 * Va donde hoy no había nada que ofrecer: la pestaña de la Biblia, y sobre todo
 * el Hoy de quien todavía no tiene plan — que era una pantalla con un solo
 * botón y ninguna razón para volver mañana.
 *
 * Si la lectura falla no se pinta nada. Es un adorno diario, no una promesa: un
 * bloque de error aquí ocuparía más sitio y más atención que el propio
 * versículo.
 */
export const VerseOfTheDay = () => {
  const { t } = useTranslation();
  const { data } = useVerseOfTheDay();

  if (!data) return null;

  return (
    <Card label={t("bible.verseOfTheDay")} className="gap-2">
      <Txt variant="reading">{data.text}</Txt>

      <View className="flex-row flex-wrap items-center gap-4">
        {/* Al capítulo entero, que es lo que más valor añadió al lector cuando
            se construyó: leer una frase suelta y poder caer en lo que venía
            antes. */}
        <Link
          href={{
            pathname: "/libro/[book]/[chapter]",
            params: {
              book: String(data.book_id),
              chapter: String(data.chapter),
              verse: String(data.verse),
            },
          }}
          asChild
        >
          <Tap accessibilityRole="link">
            <Txt variant="editorial">{data.reference}</Txt>
          </Tap>
        </Link>

        <Link
          href={{
            pathname: "/versiculo",
            params: {
              book: String(data.book_id),
              chapter: String(data.chapter),
              verse: String(data.verse),
            },
          }}
          asChild
        >
          <Tap accessibilityRole="link">
            <Txt variant="label" underline>
              {t("bible.shareVerse")}
            </Txt>
          </Tap>
        </Link>
      </View>
    </Card>
  );
};
