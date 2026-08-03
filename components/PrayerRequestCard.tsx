import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import type { PrayerRequest } from "@/core/posts/queries";

interface Props {
  request: PrayerRequest;
  /** Circle admins can hide; the open wall has nobody in charge. */
  canHide: boolean;
  onTogglePrayer: () => void;
  onOpen: () => void;
  onReport: () => void;
  onBlock: (userId: string) => void;
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
    <View className="gap-3 rounded-card border border-white/60 bg-white/60 p-5 shadow-card">
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
          <Text className="flex-1 font-sans-medium text-sm text-mist-ink">
            {/* Somebody who asked anonymously has no name to show and no id to
              correlate — that is the whole point of the checkbox. */}
            {request.is_anonymous
              ? t("feed.anonymousName")
              : (request.author_name ?? "")}
          </Text>
        </View>

        {request.answered_at ? (
          <Text className="font-sans-medium text-sm text-mist-ink">
            {t("feed.answered")}
          </Text>
        ) : null}
      </View>

      {/* Lo retenido se dice, no se traga. Un filtro que se queda un mensaje
          sin avisar deja a quien lo escribió creyendo que publicó, sin saber
          por qué nadie contesta — y volviéndolo a intentar. */}
      {request.held_at ? (
        <View className="gap-1 rounded-input bg-dawn-cream p-4">
          <Text className="font-sans-medium text-sm text-plum">
            {t("moderation.held")}
          </Text>
          <Text className="font-sans text-sm leading-5 text-mist-ink">
            {t("moderation.heldHint")}
          </Text>
        </View>
      ) : null}

      <Text className="font-serif text-base leading-reading text-plum">
        {request.body}
      </Text>

      {request.prayer_count > 0 ? (
        <Text className="font-sans text-sm text-mist-ink">
          {t("feed.prayCount", { count: request.prayer_count })}
        </Text>
      ) : null}

      {/* The gesture, and the way to take it back: a counter that only ever
          goes up stops meaning anything the first time somebody mis-taps. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ checked: request.i_prayed }}
        aria-checked={request.i_prayed}
        onPress={onTogglePrayer}
        className={`items-center rounded-2xl px-4 py-3 ${
          request.i_prayed ? "bg-white/60" : "bg-plum-chip"
        }`}
      >
        <Text
          className={`font-sans-semibold text-base ${
            request.i_prayed ? "text-mist-ink" : "text-white"
          }`}
        >
          {request.i_prayed ? t("feed.prayed") : t("feed.pray")}
        </Text>
      </Pressable>

      <View className="flex-row flex-wrap gap-4">
        <Pressable accessibilityRole="link" onPress={onOpen}>
          <Text className="font-sans text-sm text-mist-ink underline">
            {request.comment_count > 0
              ? t("feed.commentCount", { count: request.comment_count })
              : t("feed.comment")}
          </Text>
        </Pressable>

        {request.is_mine ? (
          <>
            {request.answered_at ? null : (
              <Pressable accessibilityRole="button" onPress={onMarkAnswered}>
                <Text className="font-sans text-sm text-mist-ink underline">
                  {t("feed.markAnswered")}
                </Text>
              </Pressable>
            )}

            <Pressable
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
              <Text
                className={
                  confirmingDelete
                    ? "font-sans-semibold text-sm text-danger"
                    : "text-sm text-mist-ink underline"
                }
                accessibilityLiveRegion={confirmingDelete ? "polite" : "none"}
              >
                {confirmingDelete ? t("feed.deleteConfirm") : t("feed.delete")}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable accessibilityRole="button" onPress={onReport}>
              <Text className="font-sans text-sm text-mist-ink underline">
                {t("moderation.report")}
              </Text>
            </Pressable>

            {/* Missing on purpose for anonymous requests: there is no id to
                block, which is the cost of letting somebody ask without their
                name. Reporting still works. */}
            {request.author_id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("moderation.block")} ${request.author_name ?? ""}`}
                onPress={() => onBlock(request.author_id!)}
              >
                <Text className="font-sans text-sm text-mist-ink underline">
                  {t("moderation.block")}
                </Text>
              </Pressable>
            ) : null}

            {canHide ? (
              <Pressable accessibilityRole="button" onPress={onHide}>
                <Text className="font-sans text-sm text-mist-ink underline">
                  {t("moderation.hide")}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};
