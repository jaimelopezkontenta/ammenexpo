import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { LoadMore } from "@/components/LoadMore";
import { DawnBackground } from "@/components/DawnBackground";
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

/**
 * What was answered — yours, and your circles'.
 *
 * There is no visibility filter to choose here: the policy already decided
 * what comes back, so the screen cannot accidentally show something somebody
 * kept private.
 */
export default function Testimonies() {
  const { t } = useTranslation();
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

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("testimony.title"), headerShown: true }}
        />
        <LoadingState variant="comm" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("testimony.title"), headerShown: true }}
        />
        <ErrorState variant="comm" onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: t("testimony.title"), headerShown: true }}
      />
      <DawnBackground variant="comm">
        <ScrollView contentContainerClassName="flex-grow gap-5 px-7 py-8">
          <Text className="font-sans text-base text-mist-ink">
            {t("testimony.subtitle")}
          </Text>

          {notice ? (
            <Text
              className="font-sans text-sm text-mist-ink"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
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

          {(testimonies ?? []).length === 0 ? (
            <View className="gap-2 py-6">
              <Text className="font-sans-semibold text-lg text-mist-ink">
                {t("testimony.empty")}
              </Text>
              <Text className="font-sans text-base leading-6 text-mist-ink">
                {t("testimony.emptyBody")}
              </Text>
            </View>
          ) : null}

          {(testimonies ?? []).map((entry) => (
            <View
              key={entry.id}
              className="gap-2 rounded-2xl border border-white/60 p-5"
            >
              <View className="flex-row items-center gap-2">
                <Avatar
                  name={entry.author_name}
                  url={entry.author_avatar_url}
                  seed={entry.author_id}
                  size={28}
                />
                <Text className="font-sans-medium text-sm text-mist-ink">
                  {entry.author_name}
                </Text>
              </View>

              <Text className="font-serif text-base leading-reading text-plum">
                {entry.body}
              </Text>

              {entry.plan_title ? (
                <Text className="font-sans text-sm text-mist-ink">
                  {t("testimony.duringPlan", { title: entry.plan_title })}
                </Text>
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
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleShare(entry.body)}
                    >
                      <Text className="font-sans text-sm text-ember-ink underline">
                        {t("testimony.share")}
                      </Text>
                    </Pressable>

                    {entry.visibility !== "private" ? (
                      <Pressable
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
                        <Text className="font-sans text-sm text-mist-ink underline">
                          {t("testimony.makePrivate")}
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
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
                      <Text
                        className={
                          confirmingDelete === entry.id
                            ? "font-sans-semibold text-sm text-danger"
                            : "text-sm text-mist-ink underline"
                        }
                        accessibilityLiveRegion={
                          confirmingDelete === entry.id ? "polite" : "none"
                        }
                      >
                        {confirmingDelete === entry.id
                          ? t("testimony.deleteConfirm")
                          : t("testimony.delete")}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void run(
                          () => report.mutateAsync(entry.id),
                          t("moderation.reportDone"),
                        )
                      }
                    >
                      <Text className="font-sans text-sm text-mist-ink underline">
                        {t("moderation.report")}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t("moderation.block")} ${entry.author_name}`}
                      onPress={() =>
                        void run(
                          () => block.mutateAsync(entry.author_id),
                          t("moderation.blockDone"),
                        )
                      }
                    >
                      <Text className="font-sans text-sm text-mist-ink underline">
                        {t("moderation.block")}
                      </Text>
                    </Pressable>
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
    </>
  );
}
