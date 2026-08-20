import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useBibleBooks } from "@/core/bible/queries";

import { useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";

export default function BookChapters() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { scrollBottom } = useScreenPadding();
  const { book } = useLocalSearchParams<{ book: string }>();
  const bookId = Number(book);

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
          <Text className="text-center font-sans text-base text-mist-ink">
            {t("common.notFoundTitle")}
          </Text>
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
          <Text className="font-editorial text-lg text-ember-ink">
            {t("bible.chapters", { count: entry.chapter_count })}
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {chapters.map((chapter) => (
              <Tap
                key={chapter}
                accessibilityRole="button"
                accessibilityLabel={t("bible.chapter", { number: chapter })}
                className="h-14 w-14 items-center justify-center rounded-input border border-glassedge/60 bg-glass/60 shadow-soft"
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
                <Text className="font-sans-medium text-base text-plum">
                  {chapter}
                </Text>
              </Tap>
            ))}
          </View>
        </ScrollView>
      </DawnBackground>
    </>
  );
}
