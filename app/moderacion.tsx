import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ChoiceChips } from "@/components/ChoiceChips";
import { LoadMore } from "@/components/LoadMore";
import { DawnBackground } from "@/components/DawnBackground";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  useReportQueue,
  useResolveReport,
  type ReportStatus,
} from "@/core/moderation/queue";
import { useHideComment, useHidePost } from "@/core/posts/queries";
import { useHideMessage } from "@/core/circles/chat";

/**
 * La cola de moderación.
 *
 * Reportar existía desde la Fase 1 y **leer un reporte no existía en absoluto**.
 * La Guideline 1.2 exige actuar en 24 horas sobre contenido objetable; sin esta
 * pantalla no había forma ni de saber que alguien había reportado algo.
 *
 * El contenido reportado viene **dentro de cada fila**. Si para saber qué se
 * reportó hubiera que abrir otra pantalla con el id en la mano, la cola no se
 * revisaría, y una cola que no se revisa es peor que ninguna porque parece que sí.
 */
export default function Moderation() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [status, setStatus] = useState<ReportStatus>("open");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queue = useReportQueue(status);
  const resolve = useResolveReport();
  const hidePost = useHidePost();
  const hideComment = useHideComment(undefined);
  const hideMessage = useHideMessage(undefined);
  const block = useBlockUser(userId);

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

  const hideFor = (report: {
    target_type: string;
    target_id: string;
  }): (() => Promise<unknown>) | null => {
    switch (report.target_type) {
      case "post":
        return () => hidePost.mutateAsync(report.target_id);
      case "comment":
        return () => hideComment.mutateAsync(report.target_id);
      case "message":
        return () => hideMessage.mutateAsync(report.target_id);
      // Un testimonio y una intercesión no se ocultan: el testimonio lo retira
      // quien lo escribió, y una intercesión reportada se resuelve bloqueando.
      // Fingir un botón que no hace nada sería peor que no ponerlo.
      default:
        return null;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ title: t("moderation.queueTitle"), headerShown: true }}
      />

      <DawnBackground variant="radial">
        <ScrollView contentContainerClassName="gap-5 px-7 py-8">
          <ChoiceChips
            options={[
              { value: "open", label: t("moderation.statusOpen") },
              { value: "reviewed", label: t("moderation.statusReviewed") },
              { value: "dismissed", label: t("moderation.statusDismissed") },
            ]}
            selected={[status]}
            onToggle={(value) => setStatus(value as ReportStatus)}
          />

          {notice ? (
            <Text
              className="font-sans text-sm text-mist-ink"
              accessibilityRole="alert"
            >
              {notice}
            </Text>
          ) : null}

          {error ? (
            <Text
              className="font-sans text-sm text-danger"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}

          {queue.isLoading ? (
            <LoadingState variant="radial" />
          ) : queue.isError ? (
            <ErrorState variant="radial" onRetry={() => void queue.refetch()} />
          ) : (queue.data ?? []).length === 0 ? (
            <Text className="font-sans text-base leading-6 text-mist-ink">
              {t("moderation.queueEmpty")}
            </Text>
          ) : (
            (queue.data ?? []).map((report) => {
              const hide = hideFor(report);

              return (
                <View
                  key={report.id}
                  className="gap-3 rounded-2xl border border-white/60 p-5"
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="font-sans text-xs uppercase tracking-wide text-mist-ink">
                      {t(`moderation.target.${report.target_type}`)}
                    </Text>
                    <Text className="font-sans text-xs text-mist-ink">
                      {new Date(report.created_at).toLocaleString()}
                    </Text>
                  </View>

                  {/* Lo reportado, literal. Sin esto habría que creerse el
                    reporte, que es exactamente lo que no se puede hacer. */}
                  <Text className="font-serif text-base leading-reading text-plum">
                    {report.content ?? t("moderation.contentGone")}
                  </Text>

                  <Text className="font-sans text-sm text-mist-ink">
                    {t("moderation.reportedBy", { name: report.reporter_name })}
                    {report.author_name
                      ? ` · ${t("moderation.writtenBy", { name: report.author_name })}`
                      : ""}
                    {report.already_hidden
                      ? ` · ${t("moderation.alreadyHidden")}`
                      : ""}
                  </Text>

                  {report.author_id ? (
                    <Link
                      href={{
                        pathname: "/persona/[id]",
                        params: { id: report.author_id },
                      }}
                      asChild
                    >
                      <Pressable accessibilityRole="link">
                        <Text className="font-sans text-sm text-ember-ink underline">
                          {t("moderation.openProfile")}
                        </Text>
                      </Pressable>
                    </Link>
                  ) : null}

                  {status === "open" ? (
                    <View className="flex-row flex-wrap gap-4 pt-1">
                      {hide && !report.already_hidden ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            void run(hide, t("moderation.hideDone"))
                          }
                        >
                          <Text className="font-sans text-sm text-mist-ink underline">
                            {t("moderation.hide")}
                          </Text>
                        </Pressable>
                      ) : null}

                      {report.author_id ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            void run(
                              () => block.mutateAsync(report.author_id!),
                              t("moderation.blockDone"),
                            )
                          }
                        >
                          <Text className="font-sans text-sm text-mist-ink underline">
                            {t("moderation.block")}
                          </Text>
                        </Pressable>
                      ) : null}

                      <Pressable
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
                        <Text className="font-sans-medium text-sm text-plum underline">
                          {t("moderation.markReviewed")}
                        </Text>
                      </Pressable>

                      <Pressable
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
                        <Text className="font-sans text-sm text-mist-ink underline">
                          {t("moderation.dismiss")}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          <LoadMore
            hasMore={queue.hasNextPage}
            loading={queue.isFetchingNextPage}
            onPress={() => void queue.fetchNextPage()}
          />
        </ScrollView>
      </DawnBackground>
    </>
  );
}
