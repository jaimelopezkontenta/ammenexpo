import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useVerseOfTheDay } from "@/core/bible/queries";

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
    <View className="gap-2 rounded-2xl bg-paper-sunken p-5">
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {t("bible.verseOfTheDay")}
      </Text>

      <Text className="font-serif text-lg leading-reading text-ink">
        {data.text}
      </Text>

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
          <Pressable accessibilityRole="link">
            <Text className="text-sm text-clay underline">
              {data.reference}
            </Text>
          </Pressable>
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
          <Pressable accessibilityRole="link">
            <Text className="text-sm text-ink-soft underline">
              {t("bible.shareVerse")}
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
};
