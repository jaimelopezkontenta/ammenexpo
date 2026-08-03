import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { TextField } from "@/components/TextField";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { VerseOfTheDay } from "@/components/VerseOfTheDay";
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
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center justify-between py-3.5"
      onPress={() =>
        router.push({
          pathname: "/libro/[book]",
          params: { book: String(book.id) },
        })
      }
    >
      <Text className="font-sans text-base text-plum">{book.modern_name}</Text>
      <Text className="font-sans text-sm text-mist-ink">
        {t("bible.chapters", { count: book.chapter_count })}
      </Text>
    </Pressable>
  );
};

export default function Bible() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [query, setQuery] = useState("");

  const { data: books, isLoading, isError, refetch } = useBibleBooks();
  const { data: position } = useReadingPosition(userId);
  const { data: results, isFetching } = useBibleSearch(query);
  const { data: jump } = useReferenceJump(query);

  if (isLoading) {
    return <LoadingState variant="cool" />;
  }

  if (isError) {
    return <ErrorState variant="cool" onRetry={() => void refetch()} />;
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
    <DawnBackground variant="cool">
      <ScrollView
        contentContainerClassName="gap-6 px-7 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1">
          <Text className="font-sans-bold text-2xl text-plum">
            {t("bible.title")}
          </Text>
          <Text className="font-sans text-base text-mist-ink">
            {t("bible.subtitle")}
          </Text>
        </View>

        <TextField
          label={t("bible.searchLabel")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("bible.searchPlaceholder")}
          autoCorrect={false}
        />

        {/* A reference beats a word search: typing "Juan 3" means go there. */}
        {jump ? (
          <Pressable
            accessibilityRole="button"
            className="rounded-card bg-plum-chip px-5 py-4 shadow-card"
            onPress={() => openChapter(jump.book_id, jump.chapter, jump.verse)}
          >
            <Text className="font-sans-semibold text-base text-white">
              {t("bible.goTo", {
                reference: `${bookName(all, jump.book_id)} ${jump.chapter}`,
              })}
            </Text>
          </Pressable>
        ) : null}

        {/* Solo cuando no se está buscando: quien escribió algo en la caja quiere
          resultados, no un versículo que no ha pedido empujando la lista hacia
          abajo. */}
        {searching ? null : <VerseOfTheDay />}

        {searching ? (
          tooShort ? (
            <Text className="font-sans text-sm text-mist-ink">
              {t("bible.searchHint")}
            </Text>
          ) : isFetching && !results ? (
            <ActivityIndicator
              color="#413653"
              accessibilityLabel={t("common.loading")}
            />
          ) : (results ?? []).length === 0 ? (
            // Saying "nothing found" underneath "Go to Juan 3" is noise: the
            // reference is what they were asking for.
            jump ? null : (
              <View className="gap-1">
                <Text className="font-sans text-base text-plum">
                  {t("bible.noResults")}
                </Text>
                <Text className="font-sans text-sm text-mist-ink">
                  {t("bible.noResultsHint")}
                </Text>
              </View>
            )
          ) : (
            <View className="gap-4">
              <Text className="font-sans text-sm text-mist-ink">
                {t("bible.results", { count: results![0].total_count })}
              </Text>

              {results!.map((hit) => (
                <Pressable
                  key={`${hit.book_id}-${hit.chapter}-${hit.verse}`}
                  accessibilityRole="button"
                  className="gap-1"
                  onPress={() =>
                    openChapter(hit.book_id, hit.chapter, hit.verse)
                  }
                >
                  <Text className="font-editorial text-base text-ember-ink">
                    {hit.book_name} {hit.chapter}:{hit.verse}
                  </Text>
                  <Text className="font-serif text-base leading-7 text-plum">
                    {splitHighlights(hit.text, query).map((part, index) => (
                      <Text
                        key={index}
                        className={
                          part.match ? "bg-ember-pale font-serif-bold" : ""
                        }
                      >
                        {part.text}
                      </Text>
                    ))}
                  </Text>
                </Pressable>
              ))}
            </View>
          )
        ) : (
          <>
            {resume ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  openChapter(resume.bookId, resume.chapter, resume.verse)
                }
              >
                <Card label={t("bible.continueReading")}>
                  <Text className="font-sans-semibold text-lg text-plum">
                    {bookName(all, resume.bookId)} {resume.chapter}
                  </Text>
                </Card>
              </Pressable>
            ) : null}

            {[false, true].map((testament) => (
              <View key={String(testament)} className="gap-1">
                <Text className="font-editorial text-lg text-ember-ink">
                  {testament
                    ? t("bible.newTestament")
                    : t("bible.oldTestament")}
                </Text>
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
