import { Link } from "expo-router";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type LayoutChangeEvent, TextInput, View } from "react-native";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { NOTE_MAX } from "@/core/bible/marks";
import type { BibleVersion } from "@/core/bible/versions";
import { useThemeColors } from "@/theme";

type VerseRowProps = {
  verse: number;
  text: string;
  /** El versículo al que se llegó por enlace (`?verse=`). */
  linked: boolean;
  highlighted: boolean;
  note: string | undefined;
  /** Esta fila tiene los controles abiertos. */
  open: boolean;
  /** La tipografía del paso A−/A+ del lector. */
  fontClass: string;
  /**
   * El fallo de subrayar o guardar. Solo lo recibe la fila abierta: las demás
   * reciben siempre `null` y no se repintan cuando aparece o se va.
   */
  markError: string | null;
  bookId: number;
  chapter: number;
  version: BibleVersion;
  onToggle: (verse: number) => void;
  onToggleHighlight: (verse: number, on: boolean) => void;
  onSaveNote: (verse: number, body: string) => void;
  onClose: () => void;
  /** Dónde cae el versículo enlazado, para llevar el scroll hasta él. */
  onLinkedLayout: (y: number) => void;
};

/**
 * Un versículo del lector, memorizado.
 *
 * Salmos 119 son 176 filas. Con el borrador de la nota en la pantalla, cada
 * tecla repintaba las 176 —y cada fila buscaba su subrayado con un `.includes`
 * sobre la lista entera—. Ahora el borrador vive en el editor de la fila
 * abierta, lo que llega a cada fila son valores sueltos, y teclear repinta
 * solo el editor.
 */
export const VerseRow = memo(function VerseRow({
  verse,
  text,
  linked,
  highlighted,
  note,
  open,
  fontClass,
  markError,
  bookId,
  chapter,
  version,
  onToggle,
  onToggleHighlight,
  onSaveNote,
  onClose,
  onLinkedLayout,
}: VerseRowProps) {
  const { t } = useTranslation();

  return (
    <View
      className="gap-2"
      // Measured only for the verse we were sent to. Collecting all 176
      // layouts of Salmos 119 to use one would be waste. Se mide la fila y no
      // el versículo tocable: ese va dentro de ella, en y = 0, y el scroll
      // acababa siempre arriba del capítulo.
      onLayout={
        linked
          ? (event: LayoutChangeEvent) =>
              onLinkedLayout(event.nativeEvent.layout.y)
          : undefined
      }
    >
      {/* El versículo entero es el control. Un icono al margen sería más
          pequeño que el dedo que lo busca, y aquí el gesto natural es tocar la
          frase que te ha parado. */}
      <Tap
        accessibilityRole="button"
        // El label es el versículo: con «Versículo 16: subrayar o anotar» un
        // lector de pantalla leía la acción y nunca la Escritura. La acción va
        // de pista.
        accessibilityLabel={t("bible.verseLabel", { verse, text })}
        accessibilityHint={t("bible.markVerseHint")}
        accessibilityState={{ expanded: open }}
        onPress={() => onToggle(verse)}
        className={`flex-row gap-3 rounded-input px-2 py-1 ${
          linked ? "bg-ember-pale" : highlighted ? "bg-dawn-peach-mid" : ""
        }`}
      >
        <Txt variant="subheading" tone="secondary" className="pt-1 text-xs">
          {verse}
        </Txt>
        {/* La tipografía del versículo la manda el paso A−/A+ del lector,
            encima de la variante. */}
        <Txt variant="reading" className={`flex-1 ${fontClass}`}>
          {text}
        </Txt>
      </Tap>

      {/* La nota se ve sin abrir nada: escribir algo al margen y que luego
          haya que ir a buscarlo es la forma de no volver a escribir ninguna. */}
      {note && !open ? (
        <Txt variant="caption" className="px-2">
          {note}
        </Txt>
      ) : null}

      {open ? (
        <VerseEditor
          verse={verse}
          highlighted={highlighted}
          note={note}
          markError={markError}
          bookId={bookId}
          chapter={chapter}
          version={version}
          onToggleHighlight={onToggleHighlight}
          onSaveNote={onSaveNote}
          onClose={onClose}
        />
      ) : null}
    </View>
  );
});

/**
 * Los controles de un versículo: subrayar, la nota, compartir.
 *
 * Se monta al abrir la fila, con el borrador empezando en la nota que hay —lo
 * mismo que hacía la pantalla al abrir—, y el borrador es suyo: escribir no
 * sale de aquí.
 */
const VerseEditor = ({
  verse,
  highlighted,
  note,
  markError,
  bookId,
  chapter,
  version,
  onToggleHighlight,
  onSaveNote,
  onClose,
}: Pick<
  VerseRowProps,
  | "verse"
  | "highlighted"
  | "note"
  | "markError"
  | "bookId"
  | "chapter"
  | "version"
  | "onToggleHighlight"
  | "onSaveNote"
  | "onClose"
>) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [draft, setDraft] = useState(note ?? "");

  return (
    <View className="gap-3 rounded-input bg-dawn-cream p-4">
      <Tap
        accessibilityRole="button"
        onPress={() => onToggleHighlight(verse, !highlighted)}
      >
        <Txt variant="label" tone="accent">
          {highlighted ? t("bible.unhighlight") : t("bible.highlight")}
        </Txt>
      </Tap>

      <TextInput
        className="w-full rounded-input border border-glassedge/70 bg-surface px-3 py-2.5 font-sans text-base text-plum"
        accessibilityLabel={t("bible.notePlaceholder")}
        value={draft}
        onChangeText={setDraft}
        placeholder={t("bible.notePlaceholder")}
        placeholderTextColor={colors.mist.ink}
        maxLength={NOTE_MAX}
        multiline
      />

      <View className="flex-row gap-4">
        <Tap
          accessibilityRole="button"
          onPress={() => onSaveNote(verse, draft)}
        >
          {/* Guardar vacío borra la nota, y lo dice: un botón de guardar que
              borra sin avisar es una trampa. */}
          <Txt variant="labelStrong">
            {!draft.trim() && note ? t("bible.noteDelete") : t("common.save")}
          </Txt>
        </Tap>

        <Tap accessibilityRole="button" onPress={onClose}>
          <Txt variant="caption" underline>
            {t("common.cancel")}
          </Txt>
        </Tap>
      </View>

      {/* Compartirlo como imagen vive aquí y no en un icono aparte: ya has
          tocado el versículo que te ha parado, que es exactamente el momento
          en que a alguien le apetece mandárselo a otra persona. */}
      <Link
        href={{
          pathname: "/versiculo",
          params: {
            book: String(bookId),
            chapter: String(chapter),
            verse: String(verse),
            // La imagen lleva el texto que se está leyendo, no el de la
            // versión por defecto.
            version,
          },
        }}
        asChild
      >
        <Tap accessibilityRole="link">
          <Txt variant="label" tone="accent" underline>
            {t("bible.shareVerse")}
          </Txt>
        </Tap>
      </Link>

      {markError ? (
        <Txt variant="caption" tone="danger" accessibilityRole="alert">
          {markError}
        </Txt>
      ) : null}
    </View>
  );
};
