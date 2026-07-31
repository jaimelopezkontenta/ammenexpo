import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

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
    <View className="gap-3 rounded-2xl border border-slate-200 p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-slate-400">
          {/* Somebody who asked anonymously has no name to show and no id to
              correlate — that is the whole point of the checkbox. */}
          {request.is_anonymous
            ? t("feed.anonymousName")
            : (request.author_name ?? "")}
        </Text>

        {request.answered_at ? (
          <Text className="text-sm font-medium text-slate-500">
            {t("feed.answered")}
          </Text>
        ) : null}
      </View>

      <Text className="text-base leading-7 text-slate-800">{request.body}</Text>

      {request.prayer_count > 0 ? (
        <Text className="text-sm text-slate-500">
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
          request.i_prayed ? "bg-slate-100" : "bg-slate-900"
        }`}
      >
        <Text
          className={`text-base font-semibold ${
            request.i_prayed ? "text-slate-600" : "text-white"
          }`}
        >
          {request.i_prayed ? t("feed.prayed") : t("feed.pray")}
        </Text>
      </Pressable>

      <View className="flex-row flex-wrap gap-4">
        <Pressable accessibilityRole="link" onPress={onOpen}>
          <Text className="text-sm text-slate-400 underline">
            {request.comment_count > 0
              ? t("feed.commentCount", { count: request.comment_count })
              : t("feed.comment")}
          </Text>
        </Pressable>

        {request.is_mine ? (
          <>
            {request.answered_at ? null : (
              <Pressable accessibilityRole="button" onPress={onMarkAnswered}>
                <Text className="text-sm text-slate-400 underline">
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
                    ? "text-sm font-semibold text-red-500"
                    : "text-sm text-slate-400 underline"
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
              <Text className="text-sm text-slate-400 underline">
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
                <Text className="text-sm text-slate-400 underline">
                  {t("moderation.block")}
                </Text>
              </Pressable>
            ) : null}

            {canHide ? (
              <Pressable accessibilityRole="button" onPress={onHide}>
                <Text className="text-sm text-slate-400 underline">
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
