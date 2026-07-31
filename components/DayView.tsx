import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "react-native";

import { DaySection } from "@/components/DaySection";
import type { BibleBook } from "@/core/bible/navigation";
import { parseCanonicalRef } from "@/core/bible/reference";
import type { PlanDay } from "@/core/plans/queries";

type Props = {
  day: PlanDay;
  books: BibleBook[];
};

/**
 * The four parts of a day, exactly as they read on Hoy.
 *
 * Shared with the history screen so the day you reread is the day you read —
 * two renderings of the same content would drift the first time either changed.
 */
export const DayView = ({ day, books }: Props) => {
  const { t } = useTranslation();
  const scripture = parseCanonicalRef(day.scripture_ref, books);

  return (
    <>
      {day.scripture_text ? (
        <DaySection label={t("plan.scripture")} tone="scripture">
          <Text className="text-lg leading-7 text-slate-800">
            {day.scripture_text}
          </Text>
          {day.scripture_ref ? (
            <Text className="text-sm font-medium text-slate-500">
              {day.scripture_ref}
            </Text>
          ) : null}

          {/* The verse is shown out of context: this is the way into the
              chapter around it. If the reference cannot be parsed there is no
              link at all — guessing would open the wrong chapter. */}
          {scripture ? (
            <Pressable
              accessibilityRole="button"
              // Without an explicit label the name is built from the children,
              // so the arrow became part of it: "Leer el capítulo flecha hacia
              // la derecha".
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
              <Text className="text-sm font-medium text-slate-600">
                {t("bible.readInContext")} <Text aria-hidden>→</Text>
              </Text>
            </Pressable>
          ) : null}
        </DaySection>
      ) : null}

      {day.interpretation ? (
        <DaySection label={t("plan.meaning")}>
          <Text className="text-base leading-7 text-slate-700">
            {day.interpretation}
          </Text>
        </DaySection>
      ) : null}

      {day.daily_action ? (
        <DaySection label={t("plan.action")} tone="action">
          <Text className="text-lg leading-7 text-amber-950">
            {day.daily_action}
          </Text>
        </DaySection>
      ) : null}

      <DaySection label={t("plan.prayer")}>
        <Text className="text-base leading-8 text-slate-800">
          {day.prayer_body}
        </Text>
      </DaySection>
    </>
  );
};
