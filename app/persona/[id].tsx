import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useBlockUser } from "@/core/moderation/blocks";
import { usePublicProfile } from "@/core/profile/queries";
import { useVisibleTestimonies } from "@/core/testimonies/queries";

/**
 * Quién es la persona que oró por ti.
 *
 * Hasta aquí, quien abría tu día y pulsaba "Oré por ti" era un nombre suelto en
 * una lista. Esta pantalla le da un sitio: la cara, desde cuándo lleva aquí, si
 * compartís círculo, y lo que haya querido contar.
 *
 * **Los testimonios no piden una consulta nueva.** `visible_testimonies()` ya
 * decide con las policies qué puedes leer de quién, así que filtrar por autor
 * en el cliente no enseña nada que el servidor no hubiera entregado igual — y
 * una RPC más sería una segunda copia de esa regla, que es como se desincronizan.
 */
export default function PersonProfile() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: person, isLoading, isError, refetch } = usePublicProfile(id);
  const { data: testimonies } = useVisibleTestimonies(userId);
  const block = useBlockUser(userId);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const theirs = (testimonies ?? []).filter((entry) => entry.author_id === id);

  const handleBlock = async () => {
    setError(null);

    try {
      await block.mutateAsync(id);
      setNotice(t("moderation.blockDone"));
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "", headerShown: true }} />
        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen options={{ title: "", headerShown: true }} />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  // Cero filas **no** es un fallo: es lo que devuelve la RPC para alguien a
  // quien has bloqueado, o para una cuenta que ya no existe. Enseñar aquí "no
  // hemos podido cargar esto" con un botón de reintentar sería mentir dos
  // veces: no falló nada, y ese botón no va a funcionar nunca. Se dice lo que
  // pasa y dónde se deshace.
  if (!person) {
    return (
      <>
        <Stack.Screen options={{ title: "", headerShown: true }} />
        <View className="flex-1 items-center justify-center gap-3 bg-paper px-8">
          <Text className="text-center text-lg font-medium text-ink">
            {t("profile.unavailable")}
          </Text>
          <Text className="text-center text-base leading-6 text-ink-muted">
            {t("profile.unavailableBody")}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: person.display_name, headerShown: true }}
      />

      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="flex-grow gap-8 px-7 py-8"
      >
        <View className="items-center gap-3">
          <Avatar
            name={person.display_name}
            url={person.avatar_url}
            seed={person.id}
            size={96}
          />

          <Text className="text-center font-serif-bold text-2xl text-ink">
            {person.display_name}
          </Text>

          <Text className="text-center text-sm text-ink-soft">
            {t("profile.memberSince", {
              // El idioma de la app, no el del navegador: con `undefined`
              // ponía "May 2026" en una pantalla entera en español.
              date: new Date(person.member_since).toLocaleDateString(
                i18n.language,
                { year: "numeric", month: "long" },
              ),
            })}
          </Text>

          {/* Compartir círculo es lo que explica por qué esta persona puede ver
              tus peticiones, así que se dice en las dos direcciones. En tu
              propio perfil no: `shares_a_circle_with` contigo misma es cierto,
              y "compartís un círculo" sobre ti no significa nada. */}
          {!person.is_me ? (
            <Text className="text-center text-sm text-ink-muted">
              {person.shares_circle
                ? t("profile.sharesCircle")
                : t("profile.noSharedCircle")}
            </Text>
          ) : null}
        </View>

        {theirs.length > 0 ? (
          <View className="gap-4">
            <Text className="text-sm font-medium text-ink-muted">
              {t("testimony.title")}
            </Text>

            {theirs.map((entry) => (
              <View
                key={entry.id}
                className="gap-2 rounded-2xl bg-paper-sunken p-5"
              >
                {entry.plan_title ? (
                  <Text className="text-sm text-ink-soft">
                    {entry.plan_title}
                  </Text>
                ) : null}
                <Text className="font-serif text-base leading-reading text-ink">
                  {entry.body}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {notice ? (
          <Text className="text-sm text-ink-muted" accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}

        {error ? (
          <Text className="text-sm text-red-500" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {/* En tu propio perfil no, obviamente. Y aquí abajo, no arriba: alguien
            que abre esto viene a ver quién oró por él, no a moderar. */}
        {!person.is_me && !notice ? (
          <View className="mt-auto pt-6">
            <Button
              title={t("moderation.block")}
              variant="ghost"
              loading={block.isPending}
              onPress={() => void handleBlock()}
            />
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
