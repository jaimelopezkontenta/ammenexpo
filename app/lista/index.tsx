import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import {
  ITEM_MAX,
  useAddListItem,
  useDeleteListItem,
  usePrayerList,
  useSetItemAnswered,
} from "@/core/list/queries";

/**
 * Tu lista de oración.
 *
 * Hasta aquí la app solo sabía de una cosa: el plan de treinta días que escribe
 * la IA sobre un tema. Y lo que la gente hace de verdad cada día no es eso, es
 * una lista de nombres — «mi madre, el trabajo de Luis, la decisión de
 * mudarnos». No cabía en ninguna parte.
 *
 * Es lo más privado del producto: no se comparte, no se ve, no se reporta. Por
 * eso no hay ni un control aquí que hable de otra persona.
 */
export default function PrayerList() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data, isLoading, isError, refetch } = usePrayerList(userId);
  const add = useAddListItem(userId);
  const setAnswered = useSetItemAnswered(userId);
  const remove = useDeleteListItem(userId);

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Borrar pide dos toques y el segundo va en rojo: aquí hay nombres de gente.
  const [confirming, setConfirming] = useState<string | null>(null);

  const items = data ?? [];
  const pending = items.filter((item) => !item.answered_at);
  const answered = items.filter((item) => item.answered_at);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);

    try {
      await action();
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const handleAdd = async () => {
    const body = draft.trim();
    if (!body) return;

    setDraft("");
    await run(() => add.mutateAsync({ body }));
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("list.title"), headerShown: true }} />
        <LoadingState variant="cool" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen options={{ title: t("list.title"), headerShown: true }} />
        <ErrorState variant="cool" onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("list.title"), headerShown: true }} />

      <DawnBackground variant="cool">
        <ScrollView
          contentContainerClassName="gap-5 px-7 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <TextInput
              className="w-full rounded-2xl border border-white/60 bg-dawn-cream-bg px-4 py-3.5 font-sans text-base text-plum"
              accessibilityLabel={t("list.placeholder")}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("list.placeholder")}
              placeholderTextColor="#726A62"
              maxLength={ITEM_MAX}
              multiline
              numberOfLines={1}
              onSubmitEditing={() => void handleAdd()}
            />

            <Button
              title={t("list.add")}
              variant="secondary"
              loading={add.isPending}
              disabled={draft.trim().length === 0}
              onPress={() => void handleAdd()}
            />
          </View>

          {error ? (
            <Text
              className="font-sans text-sm text-danger"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}

          {/* El temporizador es lo que convierte una lista en una práctica, así
            que va arriba y no escondido al final. Sin peticiones no se pinta:
            un botón que abre una pantalla vacía es peor que ningún botón. */}
          {pending.length > 0 ? (
            <Link href="/lista/orar" asChild>
              <Button title={t("list.prayThrough")} />
            </Link>
          ) : null}

          {items.length === 0 ? (
            <Text className="font-sans text-base leading-6 text-mist-ink">
              {t("list.empty")}
            </Text>
          ) : null}

          {pending.map((item) => (
            <View
              key={item.id}
              className="gap-2 rounded-2xl border border-white/60 p-5"
            >
              <Text className="font-serif text-base leading-reading text-plum">
                {item.body}
              </Text>

              <View className="flex-row flex-wrap gap-4">
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void run(() =>
                      setAnswered.mutateAsync({ id: item.id, answered: true }),
                    )
                  }
                >
                  <Text className="font-sans text-sm text-ember-ink underline">
                    {t("list.markAnswered")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: confirming === item.id }}
                  onPress={() => {
                    if (confirming === item.id) {
                      setConfirming(null);
                      void run(() => remove.mutateAsync(item.id));
                    } else {
                      setConfirming(item.id);
                    }
                  }}
                >
                  <Text
                    className={
                      confirming === item.id
                        ? "font-sans-semibold text-sm text-danger"
                        : "text-sm text-mist-ink underline"
                    }
                    accessibilityLiveRegion={
                      confirming === item.id ? "polite" : "none"
                    }
                  >
                    {confirming === item.id
                      ? t("list.removeConfirm")
                      : t("list.remove")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}

          {answered.length > 0 ? (
            <View className="gap-4 pt-4">
              <Text className="font-sans-medium text-sm text-mist-ink">
                {t("list.answeredTitle")}
              </Text>

              {answered.map((item) => (
                <View
                  key={item.id}
                  className="gap-2 rounded-2xl bg-white/60 p-5"
                >
                  <Text className="font-serif text-base leading-reading text-mist-ink">
                    {item.body}
                  </Text>

                  <View className="flex-row flex-wrap gap-4">
                    {/* El cuarto bucle del producto —terminas algo y cuentas qué
                      pasó— vale igual para una petición de la lista que para un
                      plan de treinta días. Sin esto, marcar respondida sería un
                      tachón y nada más. */}
                    <Link
                      href={{
                        pathname: "/testimonios/nuevo",
                        params: { listItem: item.id },
                      }}
                      asChild
                    >
                      <Pressable accessibilityRole="link">
                        <Text className="font-sans text-sm text-ember-ink underline">
                          {t("list.tellIt")}
                        </Text>
                      </Pressable>
                    </Link>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void run(() =>
                          setAnswered.mutateAsync({
                            id: item.id,
                            answered: false,
                          }),
                        )
                      }
                    >
                      <Text className="font-sans text-sm text-mist-ink underline">
                        {t("list.undoAnswered")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </DawnBackground>
    </>
  );
}
