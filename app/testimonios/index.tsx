import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useBlockConfirm } from "@/components/BlockConfirm";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";
import { LoadMore } from "@/components/LoadMore";
import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { buildShareUrl, shareOrCopy } from "@/core/share";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  useDeleteTestimony,
  useReportTestimony,
  useSetTestimonyVisibility,
  useVisibleTestimonies,
} from "@/core/testimonies/queries";

import { Tap } from "@/components/ui/Tap";

/**
 * What was answered — yours, and your circles'.
 *
 * There is no visibility filter to choose here: the policy already decided
 * what comes back, so the screen cannot accidentally show something somebody
 * kept private.
 */
export default function Testimonies() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: testimonies,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useVisibleTestimonies(userId);

  const setVisibility = useSetTestimonyVisibility(userId);
  const remove = useDeleteTestimony(userId);
  const report = useReportTestimony(userId);
  const block = useBlockUser(userId);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const handleShare = async (body: string) => {
    setError(null);

    // El enlace va a la app, no al testimonio: no hay pantalla pública de un
    // testimonio, y mandar a alguien a una que no existe es peor que no mandarlo.
    const outcome = await shareOrCopy(
      t("testimony.shareMessage", { body }),
      buildShareUrl("/", "invitacion"),
    );

    if (outcome === "copied") setNotice(t("share.linkCopied"));
    if (outcome === "failed") setError(t("share.shareFailed"));
  };

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

  // Bloquear pregunta antes: estaba junto a «Reportar» y bastaba un toque suelto.
  const blockConfirm = useBlockConfirm(
    (blockedId) =>
      void run(() => block.mutateAsync(blockedId), t("moderation.blockDone")),
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("testimony.title"), headerShown: true }}
        />
        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("testimony.title"), headerShown: true }}
        />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: t("testimony.title"), headerShown: true }}
      />
      <DawnBackground>
        <ScrollView
          contentContainerClassName="flex-grow gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <Txt variant="body" tone="secondary">
            {t("testimony.subtitle")}
          </Txt>

          {notice ? (
            <Txt
              variant="caption"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {notice}
            </Txt>
          ) : null}

          {error ? (
            <Txt variant="caption" tone="danger" accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}

          {(testimonies ?? []).length === 0 ? (
            <EmptyState
              title={t("testimony.empty")}
              body={t("testimony.emptyBody")}
            />
          ) : null}

          {(testimonies ?? []).map((entry) => (
            <View
              key={entry.id}
              className="gap-2 rounded-card border border-glassedge/65 bg-glass/60 p-5 shadow-soft"
            >
              <View className="flex-row items-center gap-2">
                <Avatar
                  name={entry.author_name}
                  url={entry.author_avatar_url}
                  seed={entry.author_id}
                  size={28}
                />
                <Txt variant="label" tone="secondary">
                  {entry.author_name}
                </Txt>
              </View>

              <Txt variant="bodySerifReading">{entry.body}</Txt>

              {entry.plan_title ? (
                <Txt variant="caption">
                  {t("testimony.duringPlan", { title: entry.plan_title })}
                </Txt>
              ) : null}

              {/* Yours carries the way back: somebody who shared and regretted it
                needs a door, not a support email. Everyone else's carries the
                same two controls as any other text one person wrote for
                another. */}
              <View className="flex-row flex-wrap gap-4 pt-1">
                {entry.is_mine ? (
                  <>
                    {/* Lo más contable que tiene el producto —«oramos un mes y
                      pasó esto»— y solo se podía leer aquí dentro. Un testimonio
                      que no sale de la app es una historia que no le llega a
                      nadie que aún no esté. */}
                    <Tap
                      accessibilityRole="button"
                      onPress={() => void handleShare(entry.body)}
                    >
                      <Txt
                        variant="caption"
                        tone="accent"
                        className="underline"
                      >
                        {t("testimony.share")}
                      </Txt>
                    </Tap>

                    {entry.visibility !== "private" ? (
                      <Tap
                        accessibilityRole="button"
                        onPress={() =>
                          void run(
                            () =>
                              setVisibility.mutateAsync({
                                id: entry.id,
                                visibility: "private",
                              }),
                            t("testimony.saved"),
                          )
                        }
                      >
                        <Txt variant="caption" className="underline">
                          {t("testimony.makePrivate")}
                        </Txt>
                      </Tap>
                    ) : null}

                    <Tap
                      accessibilityRole="button"
                      onPress={() => {
                        if (confirmingDelete !== entry.id) {
                          setConfirmingDelete(entry.id);
                          return;
                        }

                        setConfirmingDelete(null);
                        void run(
                          () => remove.mutateAsync(entry.id),
                          t("testimony.saved"),
                        );
                      }}
                    >
                      <Txt
                        variant="caption"
                        tone={
                          confirmingDelete === entry.id ? "danger" : "secondary"
                        }
                        className={
                          confirmingDelete === entry.id
                            ? "font-sans-semibold"
                            : "underline"
                        }
                        accessibilityLiveRegion={
                          confirmingDelete === entry.id ? "polite" : "none"
                        }
                      >
                        {confirmingDelete === entry.id
                          ? t("testimony.deleteConfirm")
                          : t("testimony.delete")}
                      </Txt>
                    </Tap>
                  </>
                ) : (
                  <>
                    <Tap
                      accessibilityRole="button"
                      onPress={() =>
                        void run(
                          () => report.mutateAsync(entry.id),
                          t("moderation.reportDone"),
                        )
                      }
                    >
                      <Txt variant="caption" className="underline">
                        {t("moderation.report")}
                      </Txt>
                    </Tap>

                    <Tap
                      accessibilityRole="button"
                      accessibilityLabel={`${t("moderation.block")} ${entry.author_name}`}
                      onPress={() =>
                        blockConfirm.ask(entry.author_id, entry.author_name)
                      }
                    >
                      <Txt variant="caption" className="underline">
                        {t("moderation.block")}
                      </Txt>
                    </Tap>
                  </>
                )}
              </View>
            </View>
          ))}

          <View className="mt-auto pt-6">
            <Link href="/testimonios/nuevo" asChild>
              <Button title={t("testimony.markAnswered")} />
            </Link>
          </View>
          <LoadMore
            hasMore={hasNextPage}
            loading={isFetchingNextPage}
            onPress={() => void fetchNextPage()}
          />
        </ScrollView>
      </DawnBackground>
      {blockConfirm.dialog}
    </>
  );
}
