import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { Txt } from "@/components/ui/Text";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { VerseCard } from "@/components/VerseCard";
import { VerseStory } from "@/components/VerseStory";
import { useBibleBooks, useChapter } from "@/core/bible/queries";
import { useShareVerseImage } from "@/core/bible/image";
import { formatReference } from "@/core/bible/reference";
import { useBibleVersion } from "@/core/bible/useBibleVersion";
import { parseBibleVersion } from "@/core/bible/versionChoice";

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
  const {
    book,
    chapter,
    verse,
    version: versionParam,
  } = useLocalSearchParams<{
    book: string;
    chapter: string;
    verse: string;
    version?: string;
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

  // La versión la dice el enlace (el lector manda la que se estaba leyendo);
  // sin ella, la activa. Un enlace sin versión sigue funcionando.
  const linked = parseBibleVersion(versionParam);
  const active = useBibleVersion();
  const version = linked ?? active.version;
  const versionKnown = linked !== null || active.ready;

  const { data: books } = useBibleBooks();
  const {
    data,
    isLoading: chapterLoading,
    isLoadingError,
    refetch,
  } = useChapter(bookId, chapterNumber, version, { enabled: versionKnown });
  const isLoading = !versionKnown || chapterLoading;

  const row = (data ?? []).find((item) => item.verse === verseNumber);
  // La imagen viaja sola: lleva el nombre de la Biblia de la que sale el texto.
  const versionName = t(`bible.versionName.${version}`);
  // El nombre del libro y no su número: la referencia va escrita dentro de la
  // imagen que alguien va a mandar a su familia. En el idioma del texto.
  const reference = formatReference(
    books ?? [],
    { bookId, chapter: chapterNumber, verse: verseNumber },
    version,
  );

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

  // Retornos tempranos y no un `loading` dentro del contenido: así el JSX de
  // abajo solo se evalúa con `row` en la mano, y TypeScript lo sabe.
  const screen = {
    title: t("bible.share"),
    screenOptions: { animation: "fade_from_bottom" as const },
  };

  if (isLoading) {
    return <ScreenScaffold {...screen} loading />;
  }

  if (isLoadingError || !row) {
    return <ScreenScaffold {...screen} error onRetry={() => void refetch()} />;
  }

  return (
    <ScreenScaffold {...screen}>
      <View className="items-center gap-1">
        <Txt variant="editorial">{t("bible.formatLabel")}</Txt>
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
            <VerseCard
              text={row.text}
              reference={reference}
              versionName={versionName}
              size={300}
            />
          ) : (
            <VerseStory
              text={row.text}
              reference={reference}
              versionName={versionName}
              width={230}
            />
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
          <VerseCard
            ref={cardRef}
            text={row.text}
            reference={reference}
            versionName={versionName}
          />
        ) : (
          <VerseStory
            ref={cardRef}
            text={row.text}
            reference={reference}
            versionName={versionName}
          />
        )}
      </View>

      <Button
        title={t("bible.shareImage")}
        loading={share.isPending}
        onPress={() => void handleShare()}
      />

      {notice ? (
        <Txt
          variant="caption"
          className="text-center"
          accessibilityRole="alert"
        >
          {notice}
        </Txt>
      ) : null}

      {error ? (
        <Txt
          variant="caption"
          tone="danger"
          className="text-center"
          accessibilityRole="alert"
        >
          {error}
        </Txt>
      ) : null}
    </ScreenScaffold>
  );
}
