import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ChoiceChips } from "@/components/ChoiceChips";
import { LoadMore } from "@/components/LoadMore";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { useUserId } from "@/core/auth/useUserId";
import { useAction } from "@/core/toast/useAction";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  useHideReportedContent,
  useReportQueue,
  useResolveReport,
  type ReportStatus,
} from "@/core/moderation/queue";

import { AuthorProfileLink } from "./AuthorProfileLink";
import { canHideReported } from "./moderationView";
import { QueueBody } from "./QueueBody";

/** 1. Reportes — alguien lo señaló a mano. */
export const ReportsQueue = () => {
  const { t } = useTranslation();
  const userId = useUserId();

  const [status, setStatus] = useState<ReportStatus>("open");
  // Hecho o fallido, el resultado de cada acción es un toast (core/toast).
  const { run } = useAction();

  const queue = useReportQueue(status);
  const resolve = useResolveReport();
  const hideReported = useHideReportedContent();
  const block = useBlockUser(userId);

  return (
    <View className="gap-5">
      <ChoiceChips
        options={[
          { value: "open", label: t("moderation.statusOpen") },
          { value: "reviewed", label: t("moderation.statusReviewed") },
          { value: "dismissed", label: t("moderation.statusDismissed") },
        ]}
        selected={[status]}
        onToggle={(value) => setStatus(value as ReportStatus)}
      />

      <QueueBody
        loading={queue.isLoading}
        failed={queue.isLoadingError}
        onRetry={() => void queue.refetch()}
        empty={(queue.data ?? []).length === 0}
        emptyText={t("moderation.queueEmpty")}
      >
        {(queue.data ?? []).map((report) => (
          <View
            key={report.id}
            className="gap-3 rounded-card border border-glassedge/60 p-5"
          >
            <View className="flex-row items-center justify-between gap-3">
              <Txt variant="overline">
                {t(`moderation.target.${report.target_type}`)}
              </Txt>
              <Txt variant="captionSm">
                {new Date(report.created_at).toLocaleString()}
              </Txt>
            </View>

            {/* Lo reportado, literal. Sin esto habría que creerse el
                reporte, que es exactamente lo que no se puede hacer. */}
            <Txt variant="bodySerifReading">
              {report.content ?? t("moderation.contentGone")}
            </Txt>

            <Txt variant="caption">
              {t("moderation.reportedBy", { name: report.reporter_name })}
              {report.author_name
                ? ` · ${t("moderation.writtenBy", { name: report.author_name })}`
                : ""}
              {report.already_hidden
                ? ` · ${t("moderation.alreadyHidden")}`
                : ""}
            </Txt>

            {report.author_id ? (
              <AuthorProfileLink authorId={report.author_id} />
            ) : null}

            {status === "open" ? (
              <View className="flex-row flex-wrap gap-4 pt-1">
                {canHideReported(report.target_type) &&
                !report.already_hidden ? (
                  <Tap
                    accessibilityRole="button"
                    onPress={() =>
                      void run(
                        () => hideReported.mutateAsync(report.id),
                        t("moderation.hideReportedDone"),
                      )
                    }
                  >
                    <Txt variant="caption" underline>
                      {t("moderation.hide")}
                    </Txt>
                  </Tap>
                ) : null}

                {report.author_id ? (
                  <Tap
                    accessibilityRole="button"
                    onPress={() =>
                      void run(
                        () => block.mutateAsync(report.author_id!),
                        t("moderation.blockDone"),
                      )
                    }
                  >
                    <Txt variant="caption" underline>
                      {t("moderation.block")}
                    </Txt>
                  </Tap>
                ) : null}

                <Tap
                  accessibilityRole="button"
                  onPress={() =>
                    void run(
                      () =>
                        resolve.mutateAsync({
                          reportId: report.id,
                          status: "reviewed",
                        }),
                      t("moderation.resolved"),
                    )
                  }
                >
                  <Txt variant="label" underline>
                    {t("moderation.markReviewed")}
                  </Txt>
                </Tap>

                <Tap
                  accessibilityRole="button"
                  onPress={() =>
                    void run(
                      () =>
                        resolve.mutateAsync({
                          reportId: report.id,
                          status: "dismissed",
                        }),
                      t("moderation.resolved"),
                    )
                  }
                >
                  <Txt variant="caption" underline>
                    {t("moderation.dismiss")}
                  </Txt>
                </Tap>
              </View>
            ) : null}
          </View>
        ))}
      </QueueBody>

      <LoadMore
        hasMore={queue.hasNextPage}
        loading={queue.isFetchingNextPage}
        onPress={() => void queue.fetchNextPage()}
      />
    </View>
  );
};
