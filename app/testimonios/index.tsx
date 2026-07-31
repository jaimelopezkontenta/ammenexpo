import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
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
  } = useVisibleTestimonies(userId);

  const setVisibility = useSetTestimonyVisibility(userId);
  const remove = useDeleteTestimony(userId);
  const report = useReportTestimony(userId);
  const block = useBlockUser(userId);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

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
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="flex-grow gap-5 px-7 py-8"
      >
        <Text className="text-base text-slate-500">
          {t("testimony.subtitle")}
        </Text>

        {notice ? (
          <Text
            className="text-sm text-slate-600"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {notice}
          </Text>
        ) : null}

        {error ? (
          <Text className="text-sm text-red-500" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {(testimonies ?? []).length === 0 ? (
          <View className="gap-2 py-6">
            <Text className="text-lg font-semibold text-slate-700">
              {t("testimony.empty")}
            </Text>
            <Text className="text-base leading-6 text-slate-500">
              {t("testimony.emptyBody")}
            </Text>
          </View>
        ) : null}

        {(testimonies ?? []).map((entry) => (
          <View
            key={entry.id}
            className="gap-2 rounded-2xl border border-slate-200 p-5"
          >
            <Text className="text-sm font-medium text-slate-400">
              {entry.author_name}
            </Text>

            <Text className="text-base leading-7 text-slate-800">
              {entry.body}
            </Text>

            {entry.plan_title ? (
              <Text className="text-sm text-slate-500">
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
                      <Text className="text-sm text-slate-400 underline">
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
                          ? "text-sm font-semibold text-red-500"
                          : "text-sm text-slate-400 underline"
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
                    <Text className="text-sm text-slate-400 underline">
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
                    <Text className="text-sm text-slate-400 underline">
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
      </ScrollView>
    </>
  );
}
