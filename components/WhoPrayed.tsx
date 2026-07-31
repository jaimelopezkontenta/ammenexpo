import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import type { Intercession } from "@/core/intercessions/queries";

type Props = {
  people: Intercession[];
  onReport: (intercessionId: string) => void;
};

/**
 * The half of the loop that brings people back: not a count, but names.
 *
 * Messages are text one user wrote for another, so every one of them carries a
 * way to report it. Reporting takes two taps rather than a modal — enough to
 * stop a mis-tap, not enough to discourage a real report.
 */
export const WhoPrayed = ({ people, onReport }: Props) => {
  const { t } = useTranslation();

  const [confirming, setConfirming] = useState<string | null>(null);
  const [reported, setReported] = useState<string[]>([]);

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
        const isReported = reported.includes(person.intercession_id);

        return (
          <View key={person.intercession_id} className="gap-1">
            <Text className="text-base font-medium text-slate-800">
              {t("intercession.personPrayed", {
                name: person.intercessor_name,
              })}
            </Text>

            {person.message ? (
              <>
                <Text className="text-base leading-6 text-slate-600">
                  “{person.message}”
                </Text>

                {isReported ? (
                  <Text className="text-sm text-slate-400">
                    {t("intercession.reported")}
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (confirming === person.intercession_id) {
                        onReport(person.intercession_id);
                        setReported((list) => [
                          ...list,
                          person.intercession_id,
                        ]);
                        setConfirming(null);
                      } else {
                        setConfirming(person.intercession_id);
                      }
                    }}
                  >
                    <Text className="text-sm text-slate-400">
                      {confirming === person.intercession_id
                        ? t("intercession.reportConfirm")
                        : t("intercession.report")}
                    </Text>
                  </Pressable>
                )}
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};
