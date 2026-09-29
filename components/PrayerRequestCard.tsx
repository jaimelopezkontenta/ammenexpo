import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Txt } from "@/components/ui/Text";
import type { PrayerRequest } from "@/core/posts/queries";

import { Tap } from "@/components/ui/Tap";

interface Props {
  request: PrayerRequest;
  /** Circle admins can hide; the open wall has nobody in charge. */
  canHide: boolean;
  onTogglePrayer: () => void;
  /**
   * Abrir los comentarios. Sin él la tarjeta está ya dentro de ellos (la
   * pantalla de comentarios la enseña arriba) y el contador es solo texto.
   */
  onOpen?: () => void;
  onReport: () => void;
  /** Con el nombre, para que quien confirme sepa a quién bloquea. */
  onBlock: (userId: string, name: string) => void;
  onHide: () => void;
  onMarkAnswered: () => void;
  onDelete: () => void;
}

export const PrayerRequestCard = ({
  request,
  canHide,
  onTogglePrayer,
  onOpen,
  onReport,
  onBlock,
  onHide,
  onMarkAnswered,
  onDelete,
}: Props) => {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Card flat className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Avatar
            name={
              request.is_anonymous
                ? t("feed.anonymousName")
                : (request.author_name ?? "")
            }
            url={request.is_anonymous ? null : request.author_avatar_url}
            // Sin id para la anónima: el tono se derivaría de algo estable y
            // dos peticiones de la misma persona compartirían color, que es
            // exactamente lo que el anonimato evita.
            seed={request.is_anonymous ? request.id : (request.author_id ?? "")}
            size={28}
          />
          <Txt variant="label" tone="secondary" className="flex-1">
            {/* Somebody who asked anonymously has no name to show and no id to
              correlate — that is the whole point of the checkbox. */}
            {request.is_anonymous
              ? t("feed.anonymousName")
              : (request.author_name ?? "")}
          </Txt>
        </View>

        {request.answered_at ? (
          <Txt variant="label" tone="secondary">
            {t("feed.answered")}
          </Txt>
        ) : null}
      </View>

      {/* Lo retenido se dice, no se traga. Un filtro que se queda un mensaje
          sin avisar deja a quien lo escribió creyendo que publicó, sin saber
          por qué nadie contesta — y volviéndolo a intentar. */}
      {request.held_at ? (
        <View className="gap-1 rounded-input bg-dawn-cream p-4">
          <Txt variant="label">{t("moderation.held")}</Txt>
          <Txt variant="caption">{t("moderation.heldHint")}</Txt>
        </View>
      ) : null}

      <Txt variant="bodySerifReading">{request.body}</Txt>

      {request.prayer_count > 0 ? (
        <Txt variant="caption">
          {t("feed.prayCount", { count: request.prayer_count })}
        </Txt>
      ) : null}

      {/* The gesture, and the way to take it back: a counter that only ever
          goes up stops meaning anything the first time somebody mis-taps. */}
      <Tap
        accessibilityRole="button"
        accessibilityState={{ checked: request.i_prayed }}
        aria-checked={request.i_prayed}
        onPress={onTogglePrayer}
        className={`items-center rounded-cta px-4 py-3 ${
          request.i_prayed ? "bg-glass/60" : "bg-plum-chip"
        }`}
      >
        <Txt
          variant="subheading"
          tone={request.i_prayed ? "secondary" : "onDark"}
        >
          {request.i_prayed ? t("feed.prayed") : t("feed.pray")}
        </Txt>
      </Tap>

      <View className="flex-row flex-wrap gap-4">
        {onOpen ? (
          <Tap accessibilityRole="link" onPress={onOpen}>
            <Txt variant="caption" underline>
              {request.comment_count > 0
                ? t("feed.commentCount", { count: request.comment_count })
                : t("feed.comment")}
            </Txt>
          </Tap>
        ) : request.comment_count > 0 ? (
          <Txt variant="caption">
            {t("feed.commentCount", { count: request.comment_count })}
          </Txt>
        ) : null}

        {request.is_mine ? (
          <>
            {request.answered_at ? null : (
              <Tap accessibilityRole="button" onPress={onMarkAnswered}>
                <Txt variant="caption" underline>
                  {t("feed.markAnswered")}
                </Txt>
              </Tap>
            )}

            <Tap
              accessibilityRole="button"
              onPress={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                setConfirmingDelete(false);
                onDelete();
              }}
            >
              <Txt
                variant="caption"
                tone={confirmingDelete ? "danger" : "secondary"}
                className={
                  confirmingDelete ? "font-sans-semibold" : "underline"
                }
                accessibilityLiveRegion={confirmingDelete ? "polite" : "none"}
              >
                {confirmingDelete ? t("feed.deleteConfirm") : t("feed.delete")}
              </Txt>
            </Tap>
          </>
        ) : (
          <>
            <Tap accessibilityRole="button" onPress={onReport}>
              <Txt variant="caption" underline>
                {t("moderation.report")}
              </Txt>
            </Tap>

            {/* Missing on purpose for anonymous requests: there is no id to
                block, which is the cost of letting somebody ask without their
                name. Reporting still works. */}
            {request.author_id ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`${t("moderation.block")} ${request.author_name ?? ""}`}
                onPress={() =>
                  onBlock(request.author_id!, request.author_name ?? "")
                }
              >
                <Txt variant="caption" underline>
                  {t("moderation.block")}
                </Txt>
              </Tap>
            ) : null}

            {canHide ? (
              <Tap accessibilityRole="button" onPress={onHide}>
                <Txt variant="caption" underline>
                  {t("moderation.hide")}
                </Txt>
              </Tap>
            ) : null}
          </>
        )}
      </View>
    </Card>
  );
};
