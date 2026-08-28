import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { ChoiceChips } from "@/components/ChoiceChips";
import { LoadMore } from "@/components/LoadMore";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/ui/Text";
import { useSession } from "@/core/auth/SessionProvider";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  useAcknowledgeCrisis,
  useClaimHold,
  useCrisisQueue,
  useHeldContentQueue,
  useReleaseHold,
  useRemoveHold,
  useReportQueue,
  useResolveReport,
  type HeldContent,
  type ReportStatus,
} from "@/core/moderation/queue";
import { useHideComment, useHidePost } from "@/core/posts/queries";
import { useHideMessage } from "@/core/circles/chat";

import { Tap } from "@/components/ui/Tap";

type ModerationMode = "reports" | "held" | "crisis";

/**
 * La cola de moderación.
 *
 * Tres colas distintas, a propósito nunca mezcladas en una sola lista:
 *
 * 1. **Reportes** — alguien lo señaló a mano.
 * 2. **Retenidos** (B1a) — el filtro lo retuvo solo; nadie lo reportó y su
 *    autor sigue creyendo que lo publicó, con una nota. Reclamar, liberar o
 *    retirar quedan auditados desde `content_holds`.
 * 3. **Crisis** (B1b) — nunca comparte cola con lo anterior. No es "contenido
 *    por revisar", es un registro de guardia: acusar recibo, no moderar.
 */
export default function Moderation() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const [mode, setMode] = useState<ModerationMode>("reports");

  return (
    <>
      <Stack.Screen
        options={{ title: t("moderation.queueTitle"), headerShown: true }}
      />

      <DawnBackground>
        <ScrollView
          contentContainerClassName="gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <ChoiceChips
            options={[
              { value: "reports", label: t("moderation.mode.reports") },
              { value: "held", label: t("moderation.mode.held") },
              { value: "crisis", label: t("moderation.mode.crisis") },
            ]}
            selected={[mode]}
            onToggle={(value) => setMode(value as ModerationMode)}
          />

          {mode === "reports" ? <ReportsQueue /> : null}
          {mode === "held" ? <HeldQueue /> : null}
          {mode === "crisis" ? <CrisisQueue /> : null}
        </ScrollView>
      </DawnBackground>
    </>
  );
}

function ReportsQueue() {
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

      {queue.isLoading ? (
        <LoadingState />
      ) : queue.isError ? (
        <ErrorState onRetry={() => void queue.refetch()} />
      ) : (queue.data ?? []).length === 0 ? (
        <Txt variant="body" tone="secondary">
          {t("moderation.queueEmpty")}
        </Txt>
      ) : (
        (queue.data ?? []).map((report) => {
          const hide = hideFor(report);

          return (
            <View
              key={report.id}
              className="gap-3 rounded-card border border-glassedge/60 p-5"
            >
              <View className="flex-row items-center justify-between gap-3">
                <Txt variant="overline">
                  {t(`moderation.target.${report.target_type}`)}
                </Txt>
                <Txt variant="caption" className="text-xs">
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
                <Link
                  href={{
                    pathname: "/persona/[id]",
                    params: { id: report.author_id },
                  }}
                  asChild
                >
                  <Tap accessibilityRole="link">
                    <Txt variant="caption" tone="accent" className="underline">
                      {t("moderation.openProfile")}
                    </Txt>
                  </Tap>
                </Link>
              ) : null}

              {status === "open" ? (
                <View className="flex-row flex-wrap gap-4 pt-1">
                  {hide && !report.already_hidden ? (
                    <Tap
                      accessibilityRole="button"
                      onPress={() => void run(hide, t("moderation.hideDone"))}
                    >
                      <Txt variant="caption" className="underline">
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
                      <Txt variant="caption" className="underline">
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
                    <Txt variant="label" className="underline">
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
                    <Txt variant="caption" className="underline">
                      {t("moderation.dismiss")}
                    </Txt>
                  </Tap>
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
    </View>
  );
}

/**
 * B1a — lo que el filtro retuvo solo, sin que nadie lo reportara.
 *
 * El motivo se escribe siempre, tanto para liberar como para retirar: es la
 * fila de `content_holds` que ninguna de las dos RPC deja escribir vacía.
 */
function HeldQueue() {
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

  const reasonFor = (holdId: string) => reasons[holdId] ?? "";
  const setReasonFor = (holdId: string, value: string) =>
    setReasons((prev) => ({ ...prev, [holdId]: value }));

  const requireReason = (holdId: string) => {
    const reason = reasonFor(holdId).trim();

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

      <Link
        href={{ pathname: "/persona/[id]", params: { id: hold.author_id } }}
        asChild
      >
        <Tap accessibilityRole="link">
          <Txt variant="caption" tone="accent" className="underline">
            {t("moderation.openProfile")}
          </Txt>
        </Tap>
      </Link>

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
            value={reasonFor(hold.id)}
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

      {queue.isLoading ? (
        <LoadingState />
      ) : queue.isError ? (
        <ErrorState onRetry={() => void queue.refetch()} />
      ) : (queue.data ?? []).length === 0 ? (
        <Txt variant="body" tone="secondary">
          {t("moderation.holdEmpty")}
        </Txt>
      ) : (
        (queue.data ?? []).map(renderRow)
      )}

      <LoadMore
        hasMore={queue.hasNextPage}
        loading={queue.isFetchingNextPage}
        onPress={() => void queue.fetchNextPage()}
      />
    </View>
  );
}

/**
 * B1b — la guardia de crisis. Deliberadamente sin paginar, sin estados
 * intermedios y sin nada que se parezca a "moderar": la única acción es
 * acusar recibo, con una nota de qué se hizo.
 */
function CrisisQueue() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queue = useCrisisQueue(userId);
  const acknowledge = useAcknowledgeCrisis();

  const noteFor = (id: string) => notes[id] ?? "";
  const setNoteFor = (id: string, value: string) =>
    setNotes((prev) => ({ ...prev, [id]: value }));

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

  const open = (queue.data ?? []).filter((row) => !row.acknowledged_at);

  return (
    <View className="gap-5">
      <Txt variant="caption">{t("moderation.crisisHint")}</Txt>

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

      {queue.isLoading ? (
        <LoadingState />
      ) : queue.isError ? (
        <ErrorState onRetry={() => void queue.refetch()} />
      ) : open.length === 0 ? (
        <Txt variant="body" tone="secondary">
          {t("moderation.crisisEmpty")}
        </Txt>
      ) : (
        open.map((escalation) => (
          <View
            key={escalation.id}
            className="gap-3 rounded-card border border-danger p-5"
          >
            <Txt variant="overline">
              {new Date(escalation.created_at).toLocaleString()}
            </Txt>

            <Txt variant="bodySerifReading">
              {escalation.body ?? t("moderation.contentGone")}
            </Txt>

            <Txt variant="caption">
              {t("moderation.writtenBy", { name: escalation.author_name })}
            </Txt>

            <Link
              href={{
                pathname: "/persona/[id]",
                params: { id: escalation.author_id },
              }}
              asChild
            >
              <Tap accessibilityRole="link">
                <Txt variant="caption" tone="accent" className="underline">
                  {t("moderation.openProfile")}
                </Txt>
              </Tap>
            </Link>

            <TextField
              label={t("moderation.notePlaceholder")}
              value={noteFor(escalation.id)}
              onChangeText={(value) => setNoteFor(escalation.id, value)}
              placeholder={t("moderation.notePlaceholder")}
              multiline
            />

            <Tap
              accessibilityRole="button"
              onPress={() => {
                const note = noteFor(escalation.id).trim();

                if (!note) {
                  setError(t("moderation.noteRequired"));
                  return;
                }

                void run(
                  () =>
                    acknowledge.mutateAsync({
                      escalationId: escalation.id,
                      note,
                    }),
                  t("moderation.acknowledgeDone"),
                );
              }}
            >
              <Txt variant="label" className="underline">
                {t("moderation.acknowledge")}
              </Txt>
            </Tap>
          </View>
        ))
      )}
    </View>
  );
}
