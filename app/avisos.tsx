import { Link, Stack } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { LoadMore } from "@/components/LoadMore";
import { DawnBackground } from "@/components/DawnBackground";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/core/notifications/queries";

import { Tap } from "@/components/ui/Tap";

/**
 * Los avisos.
 *
 * La tabla lleva llenándose desde la Fase 1 —una fila por cada persona que ora
 * por ti, con su nombre dentro— y nunca la había leído nadie. Esto no es una
 * función nueva: es desenterrar algo que ya estaba pasando.
 *
 * Y es la lista que en Hoy no existe: allí solo se ve quién oró **hoy**, así que
 * cada medianoche el producto olvidaba a todos los de ayer.
 */
export default function Notifications() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useNotifications(userId);
  const markRead = useMarkNotificationsRead(userId);

  const { scrollBottom } = useScreenPadding();

  // Al abrir, y una sola vez: entrar aquí es haberlos visto. `mutate` y no
  // `mutateAsync` a propósito — si falla, lo peor que pasa es que el punto
  // sigue puesto, y eso no merece un mensaje de error encima de la lista.
  useEffect(() => {
    if (userId) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("notifications.title"), headerShown: true }}
        />
        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("notifications.title"), headerShown: true }}
        />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: t("notifications.title"), headerShown: true }}
      />

      <DawnBackground>
        <ScrollView
          contentContainerClassName="flex-grow gap-4 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          {(data ?? []).length === 0 ? (
            <Text className="font-sans text-base leading-6 text-mist-ink">
              {t("notifications.empty")}
            </Text>
          ) : (
            (data ?? []).map((entry) => {
              const name = entry.payload.intercessor_name ?? "";
              const who = entry.payload.intercessor_id;

              const row = (
                <View className="flex-1 flex-row items-center gap-3">
                  <Avatar name={name} seed={who ?? entry.id} size={36} />

                  <View className="flex-1 gap-0.5">
                    <Text className="font-sans text-base text-plum">
                      {t("notifications.prayedForYou", {
                        name,
                        planTitle: entry.payload.plan_title ?? "",
                      })}
                    </Text>
                    <Text className="font-sans text-xs text-mist-ink">
                      {new Date(entry.created_at).toLocaleDateString(
                        i18n.language,
                        { day: "numeric", month: "long" },
                      )}
                    </Text>
                  </View>

                  {/* Sin leer, y sin contarlo: el número exacto no ayuda a nadie
                    dentro de una lista que se acaba de marcar entera. */}
                  {entry.read_at ? null : (
                    <View className="h-2 w-2 rounded-full bg-ember-accent" />
                  )}
                </View>
              );

              // A dónde lleva un aviso: al perfil de quien oró, que existe desde
              // hace tres commits. Antes de eso no había ningún sitio al que ir,
              // que es parte de por qué esta pantalla no se construyó entonces.
              return who ? (
                <Link
                  key={entry.id}
                  href={{ pathname: "/persona/[id]", params: { id: who } }}
                  asChild
                >
                  <Tap
                    accessibilityRole="link"
                    className="flex-row rounded-card border border-glassedge/60 p-4"
                  >
                    {row}
                  </Tap>
                </Link>
              ) : (
                <View
                  key={entry.id}
                  className="flex-row rounded-card border border-glassedge/60 p-4"
                >
                  {row}
                </View>
              );
            })
          )}

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
