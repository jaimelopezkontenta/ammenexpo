import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useSession } from "@/core/auth/SessionProvider";
import { goBackOr } from "@/core/nav/safeBack";
import {
  ITEM_MAX,
  useAddListItem,
  useDeleteListItem,
  usePrayerList,
  useSetItemAnswered,
} from "@/core/list/queries";

import { useThemeColors } from "@/theme";

import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";

import { Tap } from "@/components/ui/Tap";

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
  const colors = useThemeColors();
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

  const { scrollBottom } = useScreenPadding();

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

  // El volver por defecto de la pila apunta a la tab inicial (Hoy); quien
  // entró desde Orar espera volver a Orar. Si hay historia, se respeta; si
  // no (arranque en frío o entrada directa a la lista), se cae en Orar.
  const goBack = () => goBackOr("/orar");

  const screenOptions = {
    title: t("list.title"),
    headerShown: true,
    headerLeft: () => (
      <Tap
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        onPress={goBack}
        hitSlop={8}
        className="min-h-11 min-w-11 items-center justify-center px-2"
      >
        <Text className="font-sans-semibold text-base text-plum">
          {t("common.back")}
        </Text>
      </Tap>
    ),
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />

      <KeyboardScreen>
        <DawnBackground>
          <ScrollView
            contentContainerClassName="gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-2">
              <TextInput
                // `min-h-12` + leading: siendo multiline, el alto por contenido
                // recortaba el placeholder de dos líneas a media letra.
                className="min-h-12 w-full rounded-input border border-glassedge/60 bg-dawn-cream-bg px-4 py-3.5 font-sans text-base leading-5 text-plum"
                accessibilityLabel={t("list.placeholder")}
                value={draft}
                onChangeText={setDraft}
                placeholder={t("list.placeholder")}
                placeholderTextColor={colors.mist.ink}
                maxLength={ITEM_MAX}
                multiline
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

            {items.length === 0 ? <EmptyState title={t("list.empty")} /> : null}

            {pending.map((item) => (
              <Card key={item.id} flat className="gap-2">
                <Txt variant="bodySerifReading">{item.body}</Txt>

                <View className="flex-row flex-wrap gap-4">
                  <Tap
                    accessibilityRole="button"
                    onPress={() =>
                      void run(() =>
                        setAnswered.mutateAsync({
                          id: item.id,
                          answered: true,
                        }),
                      )
                    }
                  >
                    <Text className="font-sans text-sm text-ember-ink underline">
                      {t("list.markAnswered")}
                    </Text>
                  </Tap>

                  <Tap
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
                  </Tap>
                </View>
              </Card>
            ))}

            {answered.length > 0 ? (
              <View className="gap-4 pt-4">
                <Text className="font-sans-medium text-sm text-mist-ink">
                  {t("list.answeredTitle")}
                </Text>

                {answered.map((item) => (
                  <Card key={item.id} flat className="gap-2">
                    <Txt variant="bodySerifReading" tone="secondary">
                      {item.body}
                    </Txt>

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
                        <Tap accessibilityRole="link">
                          <Text className="font-sans text-sm text-ember-ink underline">
                            {t("list.tellIt")}
                          </Text>
                        </Tap>
                      </Link>

                      <Tap
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
                      </Tap>
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </DawnBackground>
      </KeyboardScreen>
    </>
  );
}
