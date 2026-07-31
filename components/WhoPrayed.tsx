import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import type { Intercession } from "@/core/intercessions/queries";

type Props = {
  people: Intercession[];
  onReport: (intercessionId: string) => void;
  onBlock: (userId: string) => void;
};

/**
 * The half of the loop that brings people back: not a count, but names.
 *
 * Messages are text one user wrote for another, so every one of them carries a
 * way to report it. Reporting takes two taps rather than a modal — enough to
 * stop a mis-tap, not enough to discourage a real report.
 */
export const WhoPrayed = ({ people, onReport, onBlock }: Props) => {
  const { t } = useTranslation();

  const [confirming, setConfirming] = useState<string | null>(null);

  if (people.length === 0) {
    return (
      <Text className="text-base leading-6 text-slate-500">
        {t("intercession.nobodyYet")}
      </Text>
    );
  }

  return (
    <View className="gap-4">
      {people.map((person) => {
        const isConfirming = confirming === person.intercession_id;

        return (
          <View key={person.intercession_id} className="gap-1">
            <Text className="text-base font-medium text-slate-800">
              {t("intercession.personPrayed", {
                name: person.intercessor_name,
              })}
            </Text>

            {/* A reported message stops coming back from the server, so there
                is no "reported" placeholder to keep: the text is simply gone
                and the prayer stays. */}
            {person.message ? (
              <Text className="text-base leading-6 text-slate-600">
                «{person.message}»
              </Text>
            ) : null}

            {/* Outside the message check, unlike before. Reporting was the only
                control here and it only appeared when there was text, so
                somebody who prayed for you without writing anything could not
                be reported *or* blocked — and blocking was missing entirely,
                which left anyone who reached you through a public link rather
                than a circle unblockable anywhere in the app. */}
            <View className="flex-row gap-4">
              {person.message ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isConfirming }}
                  aria-expanded={isConfirming}
                  onPress={() => {
                    if (isConfirming) {
                      onReport(person.intercession_id);
                      setConfirming(null);
                    } else {
                      setConfirming(person.intercession_id);
                    }
                  }}
                >
                  <Text
                    className={
                      isConfirming
                        ? "text-sm font-semibold text-red-500"
                        : "text-sm text-slate-400 underline"
                    }
                    // Nothing announced the label flipping, so a screen reader
                    // user tapped "Reportar", heard silence, and had no way to
                    // know a second tap was needed.
                    accessibilityLiveRegion={isConfirming ? "polite" : "none"}
                  >
                    {isConfirming
                      ? t("intercession.reportConfirm")
                      : t("intercession.report")}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("moderation.block")} ${person.intercessor_name}`}
                onPress={() => onBlock(person.intercessor_id)}
              >
                <Text className="text-sm text-slate-400 underline">
                  {t("moderation.block")}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
};
