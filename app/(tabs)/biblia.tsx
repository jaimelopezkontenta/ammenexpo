import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { TabHeader } from "@/components/TabHeader";
import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { TextField } from "@/components/TextField";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { VerseOfTheDay } from "@/components/VerseOfTheDay";
import { EmptyState } from "@/components/ui/EmptyState";
import { Glass } from "@/components/Glass";
import { useSession } from "@/core/auth/SessionProvider";
import {
  MIN_SEARCH_LENGTH,
  useBibleBooks,
  useBibleSearch,
  useReadingPosition,
  useReferenceJump,
} from "@/core/bible/queries";
import { splitHighlights } from "@/core/bible/highlight";
import { bookName, type BibleBook } from "@/core/bible/navigation";

import { useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

const openChapter = (bookId: number, chapter: number, verse?: number) =>
  router.push({
    pathname: "/libro/[book]/[chapter]",
    params: {
      book: String(bookId),
      chapter: String(chapter),
      ...(verse ? { verse: String(verse) } : {}),
    },
  });

const BookRow = ({ book }: { book: BibleBook }) => {
  const { t } = useTranslation();

  return (
    <Tap
      accessibilityRole="button"
      className="flex-row items-center justify-between py-3.5"
      onPress={() =>
        router.push({
          pathname: "/libro/[book]",
          params: { book: String(book.id) },
        })
      }
    >
      <Txt variant="body">{book.modern_name}</Txt>
      <Txt variant="caption">
        {t("bible.chapters", { count: book.chapter_count })}
      </Txt>
    </Tap>
  );
};

// Si esta pestaña revienta, las demás y la barra siguen en pie.
export { AppErrorBoundary as ErrorBoundary } from "@/components/AppErrorBoundary";

export default function Bible() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [query, setQuery] = useState("");
  const colors = useThemeColors();

  const { data: books, isLoading, isError, error, refetch } = useBibleBooks();
  const { data: position } = useReadingPosition(userId);
  const { data: results, isFetching } = useBibleSearch(query);
  const { data: jump } = useReferenceJump(query);

  if (isLoading) {
    return <LoadingState skeleton="list" />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const all = books ?? [];
  const searching = query.trim().length > 0;
  const tooShort = query.trim().length < MIN_SEARCH_LENGTH;

  const resume =
    position?.last_read_book_id && position.last_read_chapter
      ? {
          bookId: position.last_read_book_id,
          chapter: position.last_read_chapter,
          verse: position.last_read_verse ?? 1,
        }
      : null;

  return (
    <DawnBackground>
      <TabHeader title={t("tabs.bible")} />
      <ScrollView
        contentContainerClassName="gap-6 px-7 py-8 md:w-full md:max-w-read md:self-center"
        keyboardShouldPersistTaps="handled"
      >
        {/* El título ya lo dice TabHeader; repetirlo aquí eran dos "Biblia"
          apiladas empujando el buscador hacia abajo. Queda la edición. */}
        <Txt variant="body" tone="secondary">
          {t("bible.subtitle")}
        </Txt>

        <TextField
          label={t("bible.searchLabel")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("bible.searchPlaceholder")}
          autoCorrect={false}
        />

        {/* A reference beats a word search: typing "Juan 3" means go there. */}
        {jump ? (
          <Tap
            accessibilityRole="button"
            className="rounded-card"
            onPress={() => openChapter(jump.book_id, jump.chapter, jump.verse)}
          >
            {/* Vidrio del sistema, no el oscuro: era la única tarjeta nocturna
              de toda la app y se leía como de otra familia. El acento naranja
              legible ya dice "esto es un salto". */}
            <Glass flat readable className="rounded-card px-5 py-4 shadow-soft">
              <Txt variant="subheading" tone="accent">
                {t("bible.goTo", {
                  reference: `${bookName(all, jump.book_id)} ${jump.chapter}`,
                })}
              </Txt>
            </Glass>
          </Tap>
        ) : null}

        {/* Solo cuando no se está buscando: quien escribió algo en la caja quiere
          resultados, no un versículo que no ha pedido empujando la lista hacia
          abajo. */}
        {searching ? null : <VerseOfTheDay />}

        {searching ? (
          tooShort ? (
            <Txt variant="caption">{t("bible.searchHint")}</Txt>
          ) : isFetching && !results ? (
            <ActivityIndicator
              color={colors.plum.DEFAULT}
              accessibilityLabel={t("common.loading")}
            />
          ) : (results ?? []).length === 0 ? (
            // Saying "nothing found" underneath "Go to Juan 3" is noise: the
            // reference is what they were asking for.
            jump ? null : (
              <EmptyState
                title={t("bible.noResults")}
                body={t("bible.noResultsHint")}
              />
            )
          ) : (
            <View className="gap-4">
              <Txt variant="caption">
                {t("bible.results", { count: results![0].total_count })}
              </Txt>

              {results!.map((hit) => (
                <Tap
                  key={`${hit.book_id}-${hit.chapter}-${hit.verse}`}
                  accessibilityRole="button"
                  className="gap-1"
                  onPress={() =>
                    openChapter(hit.book_id, hit.chapter, hit.verse)
                  }
                >
                  <Txt variant="editorial" className="text-base">
                    {hit.book_name} {hit.chapter}:{hit.verse}
                  </Txt>
                  <Txt variant="bodySerifReading">
                    {splitHighlights(hit.text, query).map((part, index) => (
                      <Txt
                        key={index}
                        variant="bodySerifReading"
                        className={
                          part.match ? "bg-ember-pale font-serif-bold" : ""
                        }
                      >
                        {part.text}
                      </Txt>
                    ))}
                  </Txt>
                </Tap>
              ))}
            </View>
          )
        ) : (
          <>
            {resume ? (
              <Tap
                accessibilityRole="button"
                onPress={() =>
                  openChapter(resume.bookId, resume.chapter, resume.verse)
                }
              >
                <Card label={t("bible.continueReading")}>
                  <Txt variant="subheadingLg">
                    {bookName(all, resume.bookId)} {resume.chapter}
                  </Txt>
                </Card>
              </Tap>
            ) : null}

            {[false, true].map((testament) => (
              <View key={String(testament)} className="gap-1">
                <Txt variant="editorial">
                  {testament
                    ? t("bible.newTestament")
                    : t("bible.oldTestament")}
                </Txt>
                {/* Los libros van sobre vidrio y no sueltos sobre el degradado:
                  son sesenta y seis filas seguidas, y sin una superficie
                  debajo la lista se lee como texto flotando. */}
                <Card className="mt-1 px-5 py-1">
                  {all
                    .filter((book) => book.new_testament === testament)
                    .map((book) => (
                      <BookRow key={book.id} book={book} />
                    ))}
                </Card>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </DawnBackground>
  );
}
