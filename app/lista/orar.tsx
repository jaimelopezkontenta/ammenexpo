import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { DawnBackground } from "@/components/DawnBackground";
import { Orb } from "@/components/Orb";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { usePrayerList } from "@/core/list/queries";

/** Los tres tiempos que la gente tiene de verdad, no una rueda de minutos. */
const LENGTHS = [2, 5, 10];

/**
 * Orar por la lista, de una en una.
 *
 * Es la mitad que convierte una lista en una práctica. Sin esto, una lista de
 * ocho peticiones se lee entera de un vistazo y no se ora por ninguna: el ojo
 * las recorre y se acabó.
 *
 * **El reparto es el tiempo entre las peticiones**, no un cronómetro por
 * petición que corre solo: pasar de una a otra lo decide quien ora, y el reloj
 * solo dice cuánto queda. Un temporizador que te empuja a la siguiente mientras
 * estás rezando por tu madre es exactamente el producto equivocado.
 */
export default function PrayThrough() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data, isLoading, isError, refetch } = usePrayerList(userId);

  const [minutes, setMinutes] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const items = useMemo(
    () => (data ?? []).filter((item) => !item.answered_at),
    [data],
  );

  useEffect(() => {
    if (minutes === null) return;

    const timer = setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [minutes]);

  const start = (chosen: number) => {
    setMinutes(chosen);
    setSecondsLeft(chosen * 60);
    setIndex(0);
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t("list.pray"), headerShown: true }} />
        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen options={{ title: t("list.pray"), headerShown: true }} />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: t("list.pray"), headerShown: true }} />
        <DawnBackground className="items-center justify-center gap-3 px-8">
          <Text className="text-center font-sans text-base leading-6 text-mist-ink">
            {t("list.empty")}
          </Text>
        </DawnBackground>
      </>
    );
  }

  // Antes de empezar: cuánto tiempo tienes. Preguntarlo es la mitad del
  // invento — decidir «cinco minutos» es lo que hace que ocurran.
  if (minutes === null) {
    return (
      <>
        <Stack.Screen options={{ title: t("list.pray"), headerShown: true }} />
        <DawnBackground className="justify-center gap-6 px-8">
          <Text className="font-serif-bold text-2xl text-plum">
            {t("list.howLong")}
          </Text>
          <Text className="font-sans text-base leading-6 text-mist-ink">
            {t("list.howLongHint", { count: items.length })}
          </Text>

          <ChoiceChips
            options={LENGTHS.map((value) => ({
              value: String(value),
              label: t("list.minutes", { count: value }),
            }))}
            selected={[]}
            onToggle={(value) => start(Number(value))}
          />
        </DawnBackground>
      </>
    );
  }

  const item = items[Math.min(index, items.length - 1)];
  const isLast = index >= items.length - 1;
  const minutesLeft = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <>
      <Stack.Screen options={{ title: t("list.pray"), headerShown: true }} />

      <DawnBackground className="justify-center gap-8 px-8">
        <View className="items-center gap-3">
          <Orb size={72} />
          <Text className="font-sans text-sm text-mist-ink">
            {t("list.position", { current: index + 1, total: items.length })}
          </Text>
          {/* El reloj dice cuánto queda y no manda: no pasa de petición solo,
              no suena y no interrumpe. */}
          <Text className="font-sans text-sm tabular-nums text-mist-ink">
            {minutesLeft}:{String(seconds).padStart(2, "0")}
          </Text>
        </View>

        <Text className="text-center font-serif text-2xl leading-reading text-plum">
          {item.body}
        </Text>

        {isLast ? (
          <Button title={t("list.finish")} onPress={() => router.back()} />
        ) : (
          <Button
            title={t("list.next")}
            onPress={() => setIndex((current) => current + 1)}
          />
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="items-center"
        >
          <Text className="font-sans text-sm text-mist-ink underline">
            {t("list.stop")}
          </Text>
        </Pressable>
      </DawnBackground>
    </>
  );
}
