import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { DaySection } from "@/components/DaySection";
import type { BibleBook } from "@/core/bible/navigation";
import { parseCanonicalRef } from "@/core/bible/reference";
import type { PlanDay } from "@/core/plans/queries";

import { Tap } from "@/components/ui/Tap";

type ScriptureProps = {
  scriptureText: string | null;
  scriptureRef: string | null;
  books: BibleBook[];
};

/**
 * The verse, with the way into the chapter around it.
 *
 * Split out of `DayView` so somebody else's day can carry it too: the Orar
 * screen and the public preview each inlined their own verse block, so the only
 * place a reference was ever tappable was your own day — and the whole point of
 * the link is that a verse quoted alone is missing its context.
 */
export const ScriptureSection = ({
  scriptureText,
  scriptureRef,
  books,
}: ScriptureProps) => {
  const { t } = useTranslation();

  // `books` lands a beat after the day does, and until it does
  // `parseCanonicalRef` returns null for every reference — so the link used to
  // appear a moment late, indistinguishable from a reference that genuinely has
  // no chapter to open. Waiting for the list is the honest version.
  const scripture =
    books.length > 0 ? parseCanonicalRef(scriptureRef, books) : null;

  if (!scriptureText) {
    return null;
  }

  return (
    <DaySection label={t("plan.scripture")} tone="scripture">
      <Text className="font-serif text-lg leading-reading text-plum">
        {scriptureText}
      </Text>

      {scriptureRef ? (
        <Text className="font-sans-medium text-sm text-mist-ink">
          {scriptureRef}
        </Text>
      ) : null}

      {/* If the reference cannot be parsed there is no link at all — guessing
          would open the wrong chapter. */}
      {scripture ? (
        <Tap
          accessibilityRole="button"
          // Without an explicit label the name is built from the children, so
          // the arrow became part of it: "Leer el capítulo flecha hacia la
          // derecha".
          accessibilityLabel={t("bible.readInContext")}
          onPress={() =>
            router.push({
              pathname: "/libro/[book]/[chapter]",
              params: {
                book: String(scripture.bookId),
                chapter: String(scripture.chapter),
                verse: String(scripture.verse),
              },
            })
          }
        >
          <Text className="font-sans-medium text-sm text-mist-ink">
            {t("bible.readInContext")} <Text aria-hidden>→</Text>
          </Text>
        </Tap>
      ) : null}
    </DaySection>
  );
};

type Props = {
  day: PlanDay;
  books: BibleBook[];
  /**
   * Qué parte del día se enseña además de la Palabra. El journey de Hoy la
   * recorre paso a paso (significado, acción, oración); el historial la lee
   * entera, que es el `"all"` por defecto y no necesita pasar nada.
   */
  focus?: "all" | "meaning" | "action" | "prayer";
};

/**
 * The four parts of a day, exactly as they read on Hoy.
 *
 * Shared with the history screen so the day you reread is the day you read —
 * two renderings of the same content would drift the first time either changed.
 */
export const DayView = ({ day, books, focus = "all" }: Props) => {
  const { t } = useTranslation();

  const all = focus === "all";

  return (
    <>
      {/* La Palabra no es un paso del journey: es la puerta. Se queda siempre,
          elija lo que elija el chip. */}
      <ScriptureSection
        scriptureText={day.scripture_text}
        scriptureRef={day.scripture_ref}
        books={books}
      />

      {day.interpretation && (all || focus === "meaning") ? (
        <DaySection label={t("plan.meaning")}>
          <Text className="font-sans text-base leading-7 text-plum">
            {day.interpretation}
          </Text>
        </DaySection>
      ) : null}

      {day.daily_action && (all || focus === "action") ? (
        <DaySection label={t("plan.action")} tone="action">
          <Text className="font-serif text-lg leading-reading text-plum">
            {day.daily_action}
          </Text>
        </DaySection>
      ) : null}

      {/* La oración en cursiva, como en el montaje: es lo único del día que
          está escrito para decirse en voz alta, y la cursiva lo separa de lo
          que solo se lee. */}
      {all || focus === "prayer" ? (
        <DaySection label={t("plan.prayer")}>
          <Text className="font-serif text-lg italic leading-reading text-plum">
            {day.prayer_body}
          </Text>
        </DaySection>
      ) : null}
    </>
  );
};
