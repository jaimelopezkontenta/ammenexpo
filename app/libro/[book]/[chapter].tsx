import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import {
  chapterLabel,
  nextChapter,
  previousChapter,
  type ChapterRef,
} from "@/core/bible/navigation";
import {
  useBibleBooks,
  useChapter,
  useSaveReadingPosition,
} from "@/core/bible/queries";

/** Long enough that flicking through chapters writes only where you stop. */
const SAVE_AFTER_MS = 2000;

/**
 * Survives remounts — a tab switch or a fast refresh should not re-send a
 * position we already stored.
 */
let lastWritten: string | null = null;

export default function ChapterReader() {
  const { t } = useTranslation();
  const { book, chapter, verse } = useLocalSearchParams<{
    book: string;
    chapter: string;
    verse?: string;
  }>();

  const { session } = useSession();
  const userId = session?.user.id;

  const bookId = Number(book);
  const chapterNumber = Number(chapter);
  const targetVerse = verse ? Number(verse) : null;

  const { data: books } = useBibleBooks();
  const {
    data: verses,
    isLoading,
    isError,
    refetch,
  } = useChapter(bookId, chapterNumber);

  // A malformed deep link gives NaN, which disables the query — and a disabled
  // query reports isLoading false, so the screen used to sail past the spinner
  // straight into a blank page with working prev/next buttons to nowhere.
  const validParams =
    Number.isInteger(bookId) &&
    Number.isInteger(chapterNumber) &&
    chapterNumber > 0;
  const { mutate: savePosition } = useSaveReadingPosition(userId);

  const scrollRef = useRef<ScrollView>(null);

  // Where the linked verse sits, once it has been laid out.
  const targetY = useRef<number | null>(null);
  // Scrolling straight from onLayout does not work: the verse is measured
  // before the verses below it have any height, so the ScrollView clamps the
  // jump to whatever content exists at that instant — which in a long chapter
  // like Salmos 119 leaves the reader at the top. So the scroll is retried as
  // the content grows, and stops once layout has settled.
  const settled = useRef(false);

  const scrollToTarget = () => {
    if (settled.current || targetY.current === null) {
      return;
    }

    scrollRef.current?.scrollTo({
      y: Math.max(targetY.current - 80, 0),
      animated: false,
    });
  };

  useEffect(() => {
    targetY.current = null;
    settled.current = false;

    const stop = setTimeout(() => {
      settled.current = true;
    }, 1000);

    return () => clearTimeout(stop);
  }, [bookId, chapterNumber, targetVerse]);

  // One write per chapter actually settled on, not per verse scrolled past.
  // Someone who leaves within two seconds did not read it, and losing that
  // write is the right outcome.
  useEffect(() => {
    if (!userId || !bookId || !chapterNumber) {
      return;
    }

    const key = `${userId}:${bookId}:${chapterNumber}`;

    if (lastWritten === key) {
      return;
    }

    const timer = setTimeout(() => {
      lastWritten = key;
      savePosition({
        bookId,
        chapter: chapterNumber,
        verse: targetVerse ?? 1,
      });
    }, SAVE_AFTER_MS);

    return () => clearTimeout(timer);
  }, [userId, bookId, chapterNumber, targetVerse, savePosition]);

  const all = books ?? [];
  const current: ChapterRef = { bookId, chapter: chapterNumber };
  const previous = previousChapter(all, current);
  const following = nextChapter(all, current);

  const go = (ref: ChapterRef) =>
    router.replace({
      pathname: "/libro/[book]/[chapter]",
      params: { book: String(ref.bookId), chapter: String(ref.chapter) },
    });

  if (!validParams) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("common.notFoundTitle"), headerShown: true }}
        />
        <ErrorState message={t("bible.chapterNotFound")} />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("bible.title"), headerShown: true }}
        />
        <LoadingState />
      </>
    );
  }

  // An error and an empty chapter look the same from here, and both used to
  // render nothing at all — with an empty title, since chapterLabel returns ""
  // for a book the list does not have.
  if (isError || (verses ?? []).length === 0) {
    return (
      <>
        <Stack.Screen
          options={{
            title: chapterLabel(all, current) || t("bible.title"),
            headerShown: true,
          }}
        />
        <ErrorState
          onRetry={isError ? () => void refetch() : undefined}
          message={isError ? undefined : t("bible.chapterNotFound")}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: chapterLabel(all, current), headerShown: true }}
      />
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-paper"
        contentContainerClassName="gap-4 px-7 py-8"
        onContentSizeChange={scrollToTarget}
      >
        {(verses ?? []).map((row) => {
          const highlighted = row.verse === targetVerse;

          return (
            <View
              key={row.verse}
              className={`flex-row gap-3 rounded-xl px-2 py-1 ${
                highlighted ? "bg-clay-soft" : ""
              }`}
              // Measured only for the verse we were sent to. Collecting all 176
              // layouts of Salmos 119 to use one would be waste.
              onLayout={
                highlighted
                  ? (event) => {
                      targetY.current = event.nativeEvent.layout.y;
                      scrollToTarget();
                    }
                  : undefined
              }
            >
              <Text className="pt-1 text-xs font-semibold text-ink-muted">
                {row.verse}
              </Text>
              <Text className="flex-1 font-serif text-lg leading-reading text-ink">
                {row.text}
              </Text>
            </View>
          );
        })}

        <View className="gap-3 pb-6 pt-6">
          {previous ? (
            <Button
              title={`${t("bible.previous")} · ${chapterLabel(all, previous)}`}
              variant="secondary"
              onPress={() => go(previous)}
            />
          ) : null}
          {following ? (
            <Button
              title={`${t("bible.next")} · ${chapterLabel(all, following)}`}
              variant="secondary"
              onPress={() => go(following)}
            />
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
