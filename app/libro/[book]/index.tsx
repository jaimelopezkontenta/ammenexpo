import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useBibleBooks, useReadingPosition } from "@/core/bible/queries";
import { useSession } from "@/core/auth/SessionProvider";

import { useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";

export default function BookChapters() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { scrollBottom } = useScreenPadding();
  const { book } = useLocalSearchParams<{ book: string }>();
  const bookId = Number(book);
  const { session } = useSession();
  // Por dónde vas: el capítulo de la posición guardada se marca en la
  // rejilla, para que «continuar» no dependa de recordar un número.
  const { data: position } = useReadingPosition(session?.user.id);
  const currentChapter =
    position?.last_read_book_id === bookId
      ? (position?.last_read_chapter ?? null)
      : null;

  // No query of its own: chapter_count travels with the books list, which is
  // already cached from the Biblia tab.
  const { data: books, isLoading } = useBibleBooks();
  const entry = (books ?? []).find((candidate) => candidate.id === bookId);

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("bible.title"), headerShown: true }}
        />
        <DawnBackground className="items-center justify-center">
          <ActivityIndicator color={colors.plum.DEFAULT} />
        </DawnBackground>
      </>
    );
  }

  // The worst of the headerless branches: a bad book id rendered one line of
  // grey text with no header, no button and no link. The whole plan and bible
  // trees hang off the root Stack, whose screenOptions are `headerShown: false`,
  // so every screen has to opt in — and this one only did so on success.
  if (!entry) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("bible.title"), headerShown: true }}
        />
        <DawnBackground className="items-center justify-center gap-4 px-8">
          <Txt variant="body" tone="secondary" className="text-center">
            {t("common.notFoundTitle")}
          </Txt>
          <View className="w-full">
            <Button
              title={t("bible.title")}
              variant="secondary"
              onPress={() => router.replace("/biblia")}
            />
          </View>
        </DawnBackground>
      </>
    );
  }

  const chapters = Array.from(
    { length: entry.chapter_count },
    (_, index) => index + 1,
  );

  return (
    <>
      <Stack.Screen options={{ title: entry.modern_name, headerShown: true }} />
      <DawnBackground>
        <ScrollView
          contentContainerClassName="gap-4 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <Txt variant="editorial">
            {t("bible.chapters", { count: entry.chapter_count })}
          </Txt>

          <View className="flex-row flex-wrap gap-2">
            {chapters.map((chapter) => {
              const isCurrent = chapter === currentChapter;
              return (
                <Tap
                  key={chapter}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isCurrent
                      ? `${t("bible.chapter", { number: chapter })}. ${t("bible.continueReading")}`
                      : t("bible.chapter", { number: chapter })
                  }
                  className={`h-14 w-14 items-center justify-center rounded-input border shadow-soft ${
                    isCurrent
                      ? "border-ember bg-dawn-peach-mid"
                      : "border-glassedge/60 bg-glass/60"
                  }`}
                  onPress={() =>
                    router.push({
                      pathname: "/libro/[book]/[chapter]",
                      params: {
                        book: String(entry.id),
                        chapter: String(chapter),
                      },
                    })
                  }
                >
                  <Txt
                    variant="bodyMedium"
                    className={isCurrent ? "font-sans-semibold" : ""}
                  >
                    {chapter}
                  </Txt>
                </Tap>
              );
            })}
          </View>
        </ScrollView>
      </DawnBackground>
    </>
  );
}
