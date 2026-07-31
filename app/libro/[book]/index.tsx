import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { useBibleBooks } from "@/core/bible/queries";

export default function BookChapters() {
  const { t } = useTranslation();
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
        <View className="flex-1 items-center justify-center bg-paper">
          <ActivityIndicator color="#1C1917" />
        </View>
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
        <View className="flex-1 items-center justify-center gap-4 bg-paper px-8">
          <Text className="text-center text-base text-ink-muted">
            {t("common.notFoundTitle")}
          </Text>
          <View className="w-full">
            <Button
              title={t("bible.title")}
              variant="secondary"
              onPress={() => router.replace("/biblia")}
            />
          </View>
        </View>
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
      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="gap-4 px-7 py-8"
      >
        <Text className="text-sm text-ink-soft">
          {t("bible.chapters", { count: entry.chapter_count })}
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {chapters.map((chapter) => (
            <Pressable
              key={chapter}
              accessibilityRole="button"
              accessibilityLabel={t("bible.chapter", { number: chapter })}
              className="h-14 w-14 items-center justify-center rounded-2xl border border-ink-line"
              onPress={() =>
                router.push({
                  pathname: "/libro/[book]/[chapter]",
                  params: { book: String(entry.id), chapter: String(chapter) },
                })
              }
            >
              <Text className="text-base text-ink">{chapter}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
