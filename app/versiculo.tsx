import { Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { DawnBackground } from "@/components/DawnBackground";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { VerseCard } from "@/components/VerseCard";
import { VerseStory } from "@/components/VerseStory";
import { bookName } from "@/core/bible/navigation";
import { useBibleBooks, useChapter } from "@/core/bible/queries";
import { useShareVerseImage } from "@/core/bible/image";

/**
 * La imagen del versículo, antes de mandarla.
 *
 * Es la función de crecimiento más copiada de la categoría —la inventó
 * YouVersion— y aquí solo se compartían enlaces de texto. En mercados
 * hispanohablantes el canal es el estado de WhatsApp, y ahí un enlace no se abre
 * y una imagen sí.
 *
 * **Se ve antes de compartirse.** Enseñar la tarjeta cuesta una pantalla y evita
 * la única forma de fallar que tiene esto: que alguien mande a un grupo de
 * familia un versículo cortado por abajo.
 */
export default function VerseImage() {
  const { t } = useTranslation();
  const { book, chapter, verse } = useLocalSearchParams<{
    book: string;
    chapter: string;
    verse: string;
  }>();

  const bookId = Number(book);
  const chapterNumber = Number(chapter);
  const verseNumber = Number(verse);

  const cardRef = useRef<View>(null);
  const share = useShareVerseImage(cardRef);

  // Cuadrada para una publicación, vertical para un estado. Es la misma
  // captura: cambia qué componente está montado bajo la referencia, no cómo se
  // comparte.
  const [format, setFormat] = useState<"square" | "story">("square");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: books } = useBibleBooks();
  const { data, isLoading, isError, refetch } = useChapter(
    bookId,
    chapterNumber,
  );

  const row = (data ?? []).find((item) => item.verse === verseNumber);
  // El nombre del libro y no su número: la referencia va escrita dentro de la
  // imagen que alguien va a mandar a su familia.
  const reference = `${bookName(books ?? [], bookId)} ${chapterNumber}:${verseNumber}`;

  const handleShare = async () => {
    setNotice(null);
    setError(null);

    try {
      const outcome = await share.mutateAsync({ reference });
      setNotice(
        outcome === "downloaded"
          ? t("bible.imageDownloaded")
          : t("bible.imageShared"),
      );
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("bible.share"), headerShown: true }}
        />
        <LoadingState variant="story" />
      </>
    );
  }

  if (isError || !row) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("bible.share"), headerShown: true }}
        />
        <ErrorState variant="story" onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("bible.share"), headerShown: true }} />

      <DawnBackground variant="story">
        <ScrollView contentContainerClassName="gap-5 px-7 py-8">
          <View className="items-center gap-1">
            <Text className="font-editorial text-lg text-ember-ink">
              {t("bible.formatLabel")}
            </Text>
            <ChoiceChips
              options={[
                { value: "square", label: t("bible.formatSquare") },
                { value: "story", label: t("bible.formatStory") },
              ]}
              selected={[format]}
              onToggle={(value) => setFormat(value as "square" | "story")}
            />
          </View>

          {/* Lo que se ve, a tamaño de pantalla. */}
          <View className="items-center">
            <View style={{ overflow: "hidden", borderRadius: 16 }}>
              {format === "square" ? (
                <VerseCard text={row.text} reference={reference} size={300} />
              ) : (
                <VerseStory text={row.text} reference={reference} width={230} />
              )}
            </View>
          </View>

          {/* Y lo que se captura, a 1080, fuera de la pantalla pero **pintado**:
            `html2canvas` rasteriza el DOM, así que no puede capturar algo que no
            se ha renderizado, y capturar la vista reducida daba una imagen de
            450 px. Dos instancias del mismo componente, no dos maquetaciones. */}
          <View
            style={{ position: "absolute", left: -20000, top: 0 }}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
          >
            {format === "square" ? (
              <VerseCard ref={cardRef} text={row.text} reference={reference} />
            ) : (
              <VerseStory ref={cardRef} text={row.text} reference={reference} />
            )}
          </View>

          <Button
            title={t("bible.shareImage")}
            loading={share.isPending}
            onPress={() => void handleShare()}
          />

          {notice ? (
            <Text
              className="text-center font-sans text-sm text-mist-ink"
              accessibilityRole="alert"
            >
              {notice}
            </Text>
          ) : null}

          {error ? (
            <Text
              className="text-center font-sans text-sm text-danger"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </DawnBackground>
    </>
  );
}
