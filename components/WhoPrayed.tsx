import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
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
      <Text className="font-sans text-base leading-6 text-mist-ink">
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
            {/* Quien ora por ti dejaba de ser una cadena de texto en cuanto
                tuvo cara; ahora también tiene a dónde ir. Es el sitio de la app
                donde más falta hacía: alguien te acaba de nombrar delante de
                Dios y no había forma de saber quién es. */}
            <Link
              href={{
                pathname: "/persona/[id]",
                params: { id: person.intercessor_id },
              }}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                className="flex-row items-center gap-3"
              >
                <Avatar
                  name={person.intercessor_name}
                  url={person.intercessor_avatar_url}
                  seed={person.intercessor_id}
                  size={32}
                />
                <Text className="flex-1 font-sans-medium text-base text-plum">
                  {t("intercession.personPrayed", {
                    name: person.intercessor_name,
                  })}
                </Text>
              </Pressable>
            </Link>

            {/* A reported message stops coming back from the server, so there
                is no "reported" placeholder to keep: the text is simply gone
                and the prayer stays. */}
            {person.message ? (
              <Text className="font-sans text-base leading-6 text-mist-ink">
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
                        ? "font-sans-semibold text-sm text-danger"
                        : "font-sans text-sm text-mist-ink underline"
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
                <Text className="font-sans text-sm text-mist-ink underline">
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
