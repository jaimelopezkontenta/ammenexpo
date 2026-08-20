import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Glass } from "@/components/Glass";
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

import { Tap } from "@/components/ui/Tap";
import { icon, useThemeColors } from "@/theme";

/** Long enough that flicking through chapters writes only where you stop. */
const SAVE_AFTER_MS = 2000;

/**
 * Survives remounts — a tab switch or a fast refresh should not re-send a
 * position we already stored.
 */
let lastWritten: string | null = null;

export default function ChapterReader() {
  const { scrollBottom } = useScreenPadding();
  const { t } = useTranslation();
  const colors = useThemeColors();
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
      <DawnBackground>
        <ScrollView
          ref={scrollRef}
          contentContainerClassName="px-5 py-6 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
          onContentSizeChange={scrollToTarget}
        >
          {/*
            El capítulo entero va sobre un panel, y el panel es `flat`: sin
            desenfoque. Un capítulo como Salmos 119 son 176 versículos de
            scroll continuo, y desenfocar el fondo detrás de una superficie de
            ese alto se recompone en cada fotograma. La translucidez sola
            mantiene el aspecto y no el coste. Aquí se lee: manda la letra.
          */}
          <Glass readable flat className="rounded-card px-6 py-7 shadow-card">
            <View className="gap-4">
              {(verses ?? []).map((row) => {
                const linked = row.verse === targetVerse;
                const isHighlighted =
                  marks?.highlighted.includes(row.verse) ?? false;
                const note = marks?.notes[row.verse];
                const isOpen = openVerse === row.verse;

                return (
                  <View key={row.verse} className="gap-2">
                    {/* El versículo entero es el control. Un icono al margen sería
                  más pequeño que el dedo que lo busca, y aquí el gesto natural
                  es tocar la frase que te ha parado. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("bible.markVerse", {
                        verse: row.verse,
                      })}
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() => openMarks(row.verse)}
                      className={`flex-row gap-3 rounded-xl px-2 py-1 ${
                        linked
                          ? "bg-ember-pale"
                          : isHighlighted
                            ? "bg-dawn-peach-mid"
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
                      <Text className="pt-1 font-sans-semibold text-xs text-ember-ink">
                        {row.verse}
                      </Text>
                      <Text className="flex-1 font-serif text-lg leading-reading text-plum">
                        {row.text}
                      </Text>
                    </Pressable>

                    {/* La nota se ve sin abrir nada: escribir algo al margen y que
                  luego haya que ir a buscarlo es la forma de no volver a
                  escribir ninguna. */}
                    {note && !isOpen ? (
                      <Text className="px-2 font-sans text-sm leading-6 text-mist-ink">
                        {note}
                      </Text>
                    ) : null}

                    {isOpen ? (
                      <View className="gap-3 rounded-input bg-dawn-cream p-4">
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
                          <Text className="font-sans-medium text-sm text-ember-ink">
                            {isHighlighted
                              ? t("bible.unhighlight")
                              : t("bible.highlight")}
                          </Text>
                        </Pressable>

                        <TextInput
                          className="w-full rounded-input border border-glassedge/70 bg-surface px-3 py-2.5 font-sans text-base text-plum"
                          accessibilityLabel={t("bible.notePlaceholder")}
                          value={noteDraft}
                          onChangeText={setNoteDraft}
                          placeholder={t("bible.notePlaceholder")}
                          placeholderTextColor={colors.mist.ink}
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
                            <Text className="font-sans-semibold text-sm text-plum">
                              {!noteDraft.trim() && note
                                ? t("bible.noteDelete")
                                : t("common.save")}
                            </Text>
                          </Pressable>

                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setOpenVerse(null)}
                          >
                            <Text className="font-sans text-sm text-mist-ink underline">
                              {t("common.cancel")}
                            </Text>
                          </Pressable>
                        </View>

                        {/* Compartirlo como imagen vive aquí y no en un icono aparte:
                      ya has tocado el versículo que te ha parado, que es
                      exactamente el momento en que a alguien le apetece
                      mandárselo a otra persona. */}
                        <Link
                          href={{
                            pathname: "/versiculo",
                            params: {
                              book: String(bookId),
                              chapter: String(chapterNumber),
                              verse: String(row.verse),
                            },
                          }}
                          asChild
                        >
                          <Pressable accessibilityRole="link">
                            <Text className="font-sans-medium text-sm text-ember-ink underline">
                              {t("bible.shareVerse")}
                            </Text>
                          </Pressable>
                        </Link>

                        {markError ? (
                          <Text
                            className="font-sans text-sm text-danger"
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
            </View>
          </Glass>

          {/* Una fila, no dos botones apilados a lo ancho: atrás a la
            izquierda y adelante a la derecha, como pasa una página. */}
          <View className="flex-row items-center justify-between gap-3 pb-6 pt-6">
            {previous ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`${t("bible.previous")} · ${chapterLabel(all, previous)}`}
                onPress={() => go(previous)}
                className="min-h-11 max-w-[48%] flex-row items-center gap-1 rounded-cta border border-glassedge/60 bg-glass/60 py-2 pl-2 pr-4"
              >
                <ChevronLeft
                  size={icon.sm}
                  color={colors.plum.DEFAULT}
                  strokeWidth={icon.strokeWidth}
                />
                <Text
                  numberOfLines={1}
                  className="shrink font-sans-medium text-sm text-plum"
                >
                  {chapterLabel(all, previous)}
                </Text>
              </Tap>
            ) : (
              <View />
            )}
            {following ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`${t("bible.next")} · ${chapterLabel(all, following)}`}
                onPress={() => go(following)}
                className="min-h-11 max-w-[48%] flex-row items-center gap-1 rounded-cta border border-glassedge/60 bg-glass/60 py-2 pl-4 pr-2"
              >
                <Text
                  numberOfLines={1}
                  className="shrink font-sans-medium text-sm text-plum"
                >
                  {chapterLabel(all, following)}
                </Text>
                <ChevronRight
                  size={icon.sm}
                  color={colors.plum.DEFAULT}
                  strokeWidth={icon.strokeWidth}
                />
              </Tap>
            ) : (
              <View />
            )}
          </View>
        </ScrollView>
      </DawnBackground>
    </>
  );
}
