import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0f172a" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-base text-slate-500">
          {t("common.notFoundTitle")}
        </Text>
      </View>
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
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 px-7 py-8"
      >
        <Text className="text-sm text-slate-400">
          {t("bible.chapters", { count: entry.chapter_count })}
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {chapters.map((chapter) => (
            <Pressable
              key={chapter}
              accessibilityRole="button"
              accessibilityLabel={t("bible.chapter", { number: chapter })}
              className="h-14 w-14 items-center justify-center rounded-2xl border border-slate-200"
              onPress={() =>
                router.push({
                  pathname: "/libro/[book]/[chapter]",
                  params: { book: String(entry.id), chapter: String(chapter) },
                })
              }
            >
              <Text className="text-base text-slate-800">{chapter}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
