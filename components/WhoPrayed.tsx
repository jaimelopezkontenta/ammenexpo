import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useBlockConfirm } from "@/components/BlockConfirm";
import { Button } from "@/components/Button";
import type { Intercession } from "@/core/intercessions/queries";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

type Props = {
  people: Intercession[];
  onReport: (intercessionId: string) => void;
  onBlock: (userId: string) => void;
  /**
   * El vacío pedía «Comparte tu plan» sin un botón para hacerlo: compartir, que
   * es lo que trae a alguien que ore por ti, quedaba a dos toques en el `···`.
   */
  onShare?: () => void;
};

/**
 * The half of the loop that brings people back: not a count, but names.
 *
 * Messages are text one user wrote for another, so every one of them carries a
 * way to report it. Reporting takes two taps rather than a modal — enough to
 * stop a mis-tap, not enough to discourage a real report.
 */
export const WhoPrayed = ({ people, onReport, onBlock, onShare }: Props) => {
  const { t } = useTranslation();

  const [confirming, setConfirming] = useState<string | null>(null);
  // Bloquear pregunta antes: quien oró por ti puede ser un desconocido llegado
  // por un enlace público, y perderlo de vista no debe ser un toque suelto.
  const blockConfirm = useBlockConfirm(onBlock);

  if (people.length === 0) {
    return (
      <View className="gap-3">
        <Txt variant="body" tone="secondary">
          {t("intercession.nobodyYet")}
        </Txt>
        {onShare ? (
          <Button
            title={t("share.title")}
            variant="secondary"
            onPress={onShare}
          />
        ) : null}
      </View>
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
              <Tap
                accessibilityRole="link"
                className="flex-row items-center gap-3"
              >
                <Avatar
                  name={person.intercessor_name}
                  url={person.intercessor_avatar_url}
                  seed={person.intercessor_id}
                  size={32}
                />
                <Txt variant="bodyMedium" className="flex-1">
                  {t("intercession.personPrayed", {
                    name: person.intercessor_name,
                  })}
                </Txt>
              </Tap>
            </Link>

            {/* A reported message stops coming back from the server, so there
                is no "reported" placeholder to keep: the text is simply gone
                and the prayer stays. */}
            {person.message ? (
              <Txt variant="body" tone="secondary">
                «{person.message}»
              </Txt>
            ) : null}

            {/* Outside the message check, unlike before. Reporting was the only
                control here and it only appeared when there was text, so
                somebody who prayed for you without writing anything could not
                be reported *or* blocked — and blocking was missing entirely,
                which left anyone who reached you through a public link rather
                than a circle unblockable anywhere in the app. */}
            <View className="flex-row gap-4">
              {person.message ? (
                <Tap
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
                  <Txt
                    variant="caption"
                    tone={isConfirming ? "danger" : "secondary"}
                    className={
                      isConfirming ? "font-sans-semibold" : "underline"
                    }
                    // Nothing announced the label flipping, so a screen reader
                    // user tapped "Reportar", heard silence, and had no way to
                    // know a second tap was needed.
                    accessibilityLiveRegion={isConfirming ? "polite" : "none"}
                  >
                    {isConfirming
                      ? t("intercession.reportConfirm")
                      : t("intercession.report")}
                  </Txt>
                </Tap>
              ) : null}

              <Tap
                accessibilityRole="button"
                accessibilityLabel={`${t("moderation.block")} ${person.intercessor_name}`}
                onPress={() =>
                  blockConfirm.ask(
                    person.intercessor_id,
                    person.intercessor_name,
                  )
                }
              >
                <Txt variant="caption" underline>
                  {t("moderation.block")}
                </Txt>
              </Tap>
            </View>
          </View>
        );
      })}
      {blockConfirm.dialog}
    </View>
  );
};
