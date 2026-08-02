import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

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
  NOTE_MAX,
  useChapterMarks,
  useSaveNote,
  useToggleHighlight,
} from "@/core/bible/marks";
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

  // Lo que has dejado marcado aquí. Una sola lectura por capítulo: Salmos 119
  // tiene 176 versículos y una consulta por cada uno sería una forma cara de
  // subrayar.
  const { data: marks } = useChapterMarks(userId, bookId, chapterNumber);
  const toggleHighlight = useToggleHighlight(userId, bookId, chapterNumber);
  const saveNote = useSaveNote(userId, bookId, chapterNumber);

  // Qué versículo tiene los controles abiertos. Uno cada vez: una fila de
  // acciones bajo cada versículo convertiría el capítulo en un formulario.
  const [openVerse, setOpenVerse] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [markError, setMarkError] = useState<string | null>(null);

  const openMarks = (verseNumber: number) => {
    setMarkError(null);
    setOpenVerse((current) => (current === verseNumber ? null : verseNumber));
    setNoteDraft(marks?.notes[verseNumber] ?? "");
  };

  const runMark = async (action: () => Promise<unknown>) => {
    setMarkError(null);

    try {
      await action();
    } catch {
      setMarkError(t("common.errorGeneric"));
    }
  };

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
          const linked = row.verse === targetVerse;
          const isHighlighted = marks?.highlighted.includes(row.verse) ?? false;
          const note = marks?.notes[row.verse];
          const isOpen = openVerse === row.verse;

          return (
            <View key={row.verse} className="gap-2">
              {/* El versículo entero es el control. Un icono al margen sería
                  más pequeño que el dedo que lo busca, y aquí el gesto natural
                  es tocar la frase que te ha parado. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("bible.markVerse", { verse: row.verse })}
                accessibilityState={{ expanded: isOpen }}
                onPress={() => openMarks(row.verse)}
                className={`flex-row gap-3 rounded-xl px-2 py-1 ${
                  linked
                    ? "bg-clay-soft"
                    : isHighlighted
                      ? "bg-paper-sunken"
                      : ""
                }`}
                // Measured only for the verse we were sent to. Collecting all
                // 176 layouts of Salmos 119 to use one would be waste.
                onLayout={
                  linked
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
              </Pressable>

              {/* La nota se ve sin abrir nada: escribir algo al margen y que
                  luego haya que ir a buscarlo es la forma de no volver a
                  escribir ninguna. */}
              {note && !isOpen ? (
                <Text className="px-2 text-sm leading-6 text-ink-muted">
                  {note}
                </Text>
              ) : null}

              {isOpen ? (
                <View className="gap-3 rounded-xl bg-paper-sunken p-4">
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      void runMark(() =>
                        toggleHighlight.mutateAsync({
                          verse: row.verse,
                          on: !isHighlighted,
                        }),
                      )
                    }
                  >
                    <Text className="text-sm font-medium text-clay">
                      {isHighlighted
                        ? t("bible.unhighlight")
                        : t("bible.highlight")}
                    </Text>
                  </Pressable>

                  <TextInput
                    className="w-full rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-base text-ink"
                    accessibilityLabel={t("bible.notePlaceholder")}
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    placeholder={t("bible.notePlaceholder")}
                    placeholderTextColor="#726A62"
                    maxLength={NOTE_MAX}
                    multiline
                  />

                  <View className="flex-row gap-4">
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void runMark(() =>
                          saveNote
                            .mutateAsync({
                              verse: row.verse,
                              body: noteDraft,
                            })
                            .then(() => setOpenVerse(null)),
                        )
                      }
                    >
                      {/* Guardar vacío borra la nota, y lo dice: un botón de
                          guardar que borra sin avisar es una trampa. */}
                      <Text className="text-sm font-medium text-ink">
                        {!noteDraft.trim() && note
                          ? t("bible.noteDelete")
                          : t("common.save")}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setOpenVerse(null)}
                    >
                      <Text className="text-sm text-ink-soft underline">
                        {t("common.cancel")}
                      </Text>
                    </Pressable>
                  </View>

                  {markError ? (
                    <Text
                      className="text-sm text-red-500"
                      accessibilityRole="alert"
                    >
                      {markError}
                    </Text>
                  ) : null}
                </View>
              ) : null}
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
