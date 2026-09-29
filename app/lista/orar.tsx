import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Txt } from "@/components/ui/Text";
import { ChoiceChips } from "@/components/ChoiceChips";
import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { Orb } from "@/components/Orb";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tap, triggerHaptic } from "@/components/ui/Tap";
import { useSession } from "@/core/auth/SessionProvider";
import { usePrayerList } from "@/core/list/queries";
import { goBackOr } from "@/core/nav/safeBack";

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

  const { data, isLoading, isLoadingError, refetch } = usePrayerList(userId);

  const [minutes, setMinutes] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [done, setDone] = useState(false);
  const reduceMotion = useReducedMotion();

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

  useEffect(() => {
    if (!done) return;
    const delay = reduceMotion ? 400 : 2000;
    // El cierre promete la lista, no "donde hubiera historia". `goBackOr`
    // respeta `canGoBack()` y, si se abrió `/lista/orar` en frío o tras un
    // remount, el back cae en Hoy.
    const timer = setTimeout(() => router.replace("/lista"), delay);
    return () => clearTimeout(timer);
  }, [done, reduceMotion]);

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

  if (isLoadingError) {
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
        <KeyboardScreen>
          <DawnBackground className="justify-center">
            <EmptyState title={t("list.empty")}>
              <Button
                title={t("list.addItems")}
                onPress={() => goBackOr("/lista")}
              />
            </EmptyState>
          </DawnBackground>
        </KeyboardScreen>
      </>
    );
  }

  // Antes de empezar: cuánto tiempo tienes. Preguntarlo es la mitad del
  // invento — decidir «cinco minutos» es lo que hace que ocurran.
  if (minutes === null) {
    return (
      <>
        <Stack.Screen options={{ title: t("list.pray"), headerShown: true }} />
        <KeyboardScreen>
          <DawnBackground className="justify-center gap-6 px-8">
            <Txt variant="title">{t("list.howLong")}</Txt>
            <Txt variant="body" tone="secondary">
              {t("list.howLongHint", { count: items.length })}
            </Txt>

            <ChoiceChips
              options={LENGTHS.map((value) => ({
                value: String(value),
                label: t("list.minutes", { count: value }),
              }))}
              selected={[]}
              onToggle={(value) => start(Number(value))}
            />
          </DawnBackground>
        </KeyboardScreen>
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

      <KeyboardScreen>
        <DawnBackground className="justify-center gap-8 px-8">
          <View className="items-center gap-3">
            <Orb size={72} />
            {done ? null : (
              <>
                <Txt variant="caption">
                  {t("list.position", {
                    current: index + 1,
                    total: items.length,
                  })}
                </Txt>
                <Txt variant="caption" className="tabular-nums">
                  {minutesLeft}:{String(seconds).padStart(2, "0")}
                </Txt>
              </>
            )}
          </View>

          <Txt
            variant="reading"
            className="text-center text-2xl leading-reading"
            accessibilityRole={done ? "alert" : undefined}
            accessibilityLiveRegion={done ? "polite" : undefined}
          >
            {done ? t("list.finished", { count: items.length }) : item.body}
          </Txt>

          {done ? null : isLast ? (
            <Button
              title={t("list.finish")}
              onPress={() => {
                triggerHaptic("success");
                setDone(true);
              }}
            />
          ) : (
            <Button
              title={t("list.next")}
              onPress={() => setIndex((current) => current + 1)}
            />
          )}

          {done ? null : (
            <Tap
              accessibilityRole="button"
              onPress={() => goBackOr("/orar")}
              className="items-center"
            >
              <Txt variant="caption" className="underline">
                {t("list.stop")}
              </Txt>
            </Tap>
          )}
        </DawnBackground>
      </KeyboardScreen>
    </>
  );
}
