import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useBlockUser } from "@/core/moderation/blocks";
import { usePublicProfile } from "@/core/profile/queries";
import { usePersonPlans, usePersonPosts } from "@/core/social/feed";
import { useFollowUser, useUnfollowUser } from "@/core/social/follows";
import { useVisibleTestimonies } from "@/core/testimonies/queries";

/** Un número y lo que significa. Tres veces en la misma fila. */
const Stat = ({ value, label }: { value: number; label: string }) => (
  <View className="items-center gap-0.5">
    <Text className="font-sans-semibold text-lg text-plum">{value}</Text>
    <Text className="font-sans text-xs text-mist-ink">{label}</Text>
  </View>
);

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
  const { data: posts } = usePersonPosts(id);
  const { data: plans } = usePersonPlans(id);
  const block = useBlockUser(userId);
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const theirs = (testimonies ?? []).filter((entry) => entry.author_id === id);

  const handleFollow = async () => {
    if (!userId || !person) return;

    setError(null);

    try {
      const input = { userId, targetId: id };

      if (person.i_follow) {
        await unfollow.mutateAsync(input);
      } else {
        await follow.mutateAsync(input);
      }
    } catch {
      // El caso concreto que la policy rechaza —seguir a quien te bloqueó— no
      // se dice por su nombre: bloquear es silencioso en toda la app, y un
      // "no puedes porque te bloquearon" lo dejaría de ser.
      setError(t("common.errorGeneric"));
    }
  };

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
        <DawnBackground className="items-center justify-center gap-3 px-8">
          <Text className="text-center font-sans-medium text-lg text-plum">
            {t("profile.unavailable")}
          </Text>
          <Text className="text-center font-sans text-base leading-6 text-mist-ink">
            {t("profile.unavailableBody")}
          </Text>
        </DawnBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: person.display_name, headerShown: true }}
      />

      <DawnBackground>
        <ScrollView contentContainerClassName="flex-grow gap-8 px-7 py-8">
          <View className="items-center gap-3">
            <Avatar
              name={person.display_name}
              url={person.avatar_url}
              seed={person.id}
              size={96}
            />

            <Text className="text-center font-serif-bold text-2xl text-plum">
              {person.display_name}
            </Text>

            <Text className="text-center font-sans text-sm text-mist-ink">
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
              <Text className="text-center font-sans text-sm text-mist-ink">
                {person.shares_circle
                  ? t("profile.sharesCircle")
                  : t("profile.noSharedCircle")}
              </Text>
            ) : null}

            {/* Los tres números. La racha va aquí por decisión de producto, y es
              la única de las tres que antes era privada: en tu perfil es
              motivación, en el de otra persona es comparación. Se pinta ya
              decidida por el servidor, con el día de esa persona. */}
            <View className="flex-row gap-6 pt-2">
              <Stat value={person.streak} label={t("profile.statStreak")} />
              <Stat
                value={person.follower_count}
                label={t("profile.statFollowers")}
              />
              <Stat
                value={person.following_count}
                label={t("profile.statFollowing")}
              />
            </View>

            {!person.is_me ? (
              <View className="w-full pt-2">
                <Button
                  title={
                    person.i_follow ? t("social.following") : t("social.follow")
                  }
                  // Dejar de seguir no es la acción principal de esta pantalla, y
                  // un botón lleno invitando a deshacerlo lo sería.
                  variant={person.i_follow ? "secondary" : "primary"}
                  loading={follow.isPending || unfollow.isPending}
                  onPress={() => void handleFollow()}
                />
              </View>
            ) : null}
          </View>

          {(plans ?? []).length > 0 ? (
            <View className="gap-4">
              <Text className="font-sans-medium text-sm text-mist-ink">
                {t("community.publicPlans")}
              </Text>

              {(plans ?? []).map((plan) => (
                <Link
                  key={plan.id}
                  href={{
                    pathname: "/orar/[planId]",
                    params: { planId: plan.id },
                  }}
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    className="gap-1 rounded-2xl border border-white/60 p-5"
                  >
                    <Text className="font-serif-bold text-base text-plum">
                      {plan.title}
                    </Text>
                    <Text className="font-sans text-sm text-mist-ink">
                      {t("newPlan.days", { count: plan.duration_days })}
                    </Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          ) : null}

          {(posts ?? []).length > 0 ? (
            <View className="gap-4">
              <Text className="font-sans-medium text-sm text-mist-ink">
                {t("feed.title")}
              </Text>

              {/* Solo lo que pidió con su nombre. Lo anónimo no llega hasta aquí
                —el servidor lo excluye— porque una lista por persona es justo
                la forma de deshacer un anonimato. */}
              {(posts ?? []).map((post) => (
                <View
                  key={post.id}
                  className="gap-2 rounded-2xl border border-white/60 p-5"
                >
                  <Text className="font-serif text-base leading-reading text-plum">
                    {post.body}
                  </Text>
                  <Text className="font-sans text-sm text-mist-ink">
                    {t("feed.prayCount", { count: post.prayer_count })}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {theirs.length > 0 ? (
            <View className="gap-4">
              <Text className="font-sans-medium text-sm text-mist-ink">
                {t("testimony.title")}
              </Text>

              {theirs.map((entry) => (
                <View
                  key={entry.id}
                  className="gap-2 rounded-2xl bg-white/60 p-5"
                >
                  {entry.plan_title ? (
                    <Text className="font-sans text-sm text-mist-ink">
                      {entry.plan_title}
                    </Text>
                  ) : null}
                  <Text className="font-serif text-base leading-reading text-plum">
                    {entry.body}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {notice ? (
            <Text
              className="font-sans text-sm text-mist-ink"
              accessibilityRole="alert"
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
      </DawnBackground>
    </>
  );
}
