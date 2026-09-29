import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { LoadMore } from "@/components/LoadMore";
import { TextField } from "@/components/TextField";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import {
  useClaimHold,
  useHeldContentQueue,
  useReleaseHold,
  useRemoveHold,
  type HeldContent,
} from "@/core/moderation/queue";

import { AuthorProfileLink } from "./AuthorProfileLink";
import { requiredText } from "./moderationView";
import { QueueBody } from "./QueueBody";

/**
 * 2. Retenidos (B1a) — lo que el filtro retuvo solo, sin que nadie lo
 * reportara; su autor sigue creyendo que lo publicó, con una nota.
 *
 * El motivo se escribe siempre, tanto para liberar como para retirar: es la
 * fila de `content_holds` que ninguna de las dos RPC deja escribir vacía.
 */
export const HeldQueue = () => {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const queue = useHeldContentQueue();
  const claim = useClaimHold();
  const release = useReleaseHold();
  const remove = useRemoveHold();

  const run = async (action: () => Promise<unknown>, done: string) => {
    setError(null);
    setNotice(null);

    try {
      await action();
      setNotice(done);
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const setReasonFor = (holdId: string, value: string) =>
    setReasons((prev) => ({ ...prev, [holdId]: value }));

  const requireReason = (holdId: string) => {
    const reason = requiredText(reasons[holdId]);

    if (!reason) {
      setError(t("moderation.reasonRequired"));
      return null;
    }

    return reason;
  };

  const renderRow = (hold: HeldContent) => (
    <View
      key={hold.id}
      className="gap-3 rounded-card border border-glassedge/60 p-5"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Txt variant="overline">
          {t(`moderation.target.${hold.target_type}`)} ·{" "}
          {t(`moderation.holdStatus.${hold.status}`)}
        </Txt>
        <Txt variant="caption" className="text-xs">
          {new Date(hold.created_at).toLocaleString()}
        </Txt>
      </View>

      <Txt variant="bodySerifReading">
        {hold.body ?? t("moderation.contentGone")}
      </Txt>

      <Txt variant="caption">
        {t("moderation.writtenBy", { name: hold.author_name })}
        {hold.claimed_by_name
          ? ` · ${t("moderation.claimedBy", { name: hold.claimed_by_name })}`
          : ""}
      </Txt>

      <AuthorProfileLink authorId={hold.author_id} />

      {hold.status === "pending" ? (
        <Tap
          accessibilityRole="button"
          onPress={() =>
            void run(() => claim.mutateAsync(hold.id), t("moderation.claim"))
          }
        >
          <Txt variant="label" className="underline">
            {t("moderation.claim")}
          </Txt>
        </Tap>
      ) : null}

      {hold.status === "pending" || hold.status === "claimed" ? (
        <View className="gap-3 pt-1">
          <TextField
            label={t("moderation.reasonPlaceholder")}
            value={reasons[hold.id] ?? ""}
            onChangeText={(value) => setReasonFor(hold.id, value)}
            placeholder={t("moderation.reasonPlaceholder")}
            multiline
          />

          <View className="flex-row flex-wrap gap-4">
            <Tap
              accessibilityRole="button"
              onPress={() => {
                const reason = requireReason(hold.id);
                if (!reason) return;

                void run(
                  () => release.mutateAsync({ holdId: hold.id, reason }),
                  t("moderation.releaseDone"),
                );
              }}
            >
              <Txt variant="caption" className="underline">
                {t("moderation.release")}
              </Txt>
            </Tap>

            <Tap
              accessibilityRole="button"
              onPress={() => {
                const reason = requireReason(hold.id);
                if (!reason) return;

                void run(
                  () => remove.mutateAsync({ holdId: hold.id, reason }),
                  t("moderation.removeDone"),
                );
              }}
            >
              <Txt variant="caption" tone="danger" className="underline">
                {t("moderation.remove")}
              </Txt>
            </Tap>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="gap-5">
      {notice ? (
        <Txt variant="caption" accessibilityRole="alert">
          {notice}
        </Txt>
      ) : null}

      {error ? (
        <Txt variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}

      <QueueBody
        loading={queue.isLoading}
        failed={queue.isLoadingError}
        onRetry={() => void queue.refetch()}
        empty={(queue.data ?? []).length === 0}
        emptyText={t("moderation.holdEmpty")}
      >
        {(queue.data ?? []).map(renderRow)}
      </QueueBody>

      <LoadMore
        hasMore={queue.hasNextPage}
        loading={queue.isFetchingNextPage}
        onPress={() => void queue.fetchNextPage()}
      />
    </View>
  );
};
