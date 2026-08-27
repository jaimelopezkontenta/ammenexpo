import { Link, Stack, useLocalSearchParams } from "expo-router";
import { MoreHorizontal } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";
import { useSession } from "@/core/auth/SessionProvider";
import { useBlockUser } from "@/core/moderation/blocks";
import { useReportProfile } from "@/core/moderation/queue";
import { usePublicProfile } from "@/core/profile/queries";
import { buildShareUrl, shareOrCopy } from "@/core/share";
import { usePersonPlans, usePersonPosts } from "@/core/social/feed";
import { useFollowUser, useUnfollowUser } from "@/core/social/follows";
import { useVisibleTestimonies } from "@/core/testimonies/queries";
import { icon, useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";

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
  const colors = useThemeColors();
  const { scrollBottom } = useScreenPadding();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: person, isLoading, isError, refetch } = usePublicProfile(id);
  const { data: testimonies } = useVisibleTestimonies(userId);
  const { data: posts } = usePersonPosts(id);
  const { data: plans } = usePersonPlans(id);
  const block = useBlockUser(userId);
  const report = useReportProfile(userId);
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const handleReport = async () => {
    setError(null);

    try {
      await report.mutateAsync(id);
      setNotice(t("moderation.reportDone"));
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const handleShare = async () => {
    if (!person) return;

    setError(null);

    const outcome = await shareOrCopy(
      t("profile.shareMessage", { name: person.display_name }),
      buildShareUrl(`/persona/${id}`, "invitacion"),
    );

    if (outcome === "copied") setNotice(t("share.linkCopied"));
    if (outcome === "failed") setError(t("share.shareFailed"));
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
        <DawnBackground className="justify-center">
          <EmptyState
            title={t("profile.unavailable")}
            body={t("profile.unavailableBody")}
          />
        </DawnBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: person.display_name,
          headerShown: true,
          headerRight: person.is_me
            ? undefined
            : () => (
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.moreActions")}
                  onPress={() => {
                    setMenuOpen(true);
                  }}
                  className="h-11 w-11 items-center justify-center"
                >
                  <MoreHorizontal
                    size={icon.md}
                    color={colors.plum.DEFAULT}
                    strokeWidth={icon.strokeWidth}
                  />
                </Tap>
              ),
        }}
      />

      <DawnBackground>
        <ScrollView
          contentContainerClassName="flex-grow gap-8 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
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

              {/* `person_plans` solo devuelve planes `visibility = 'public'`,
                así que toda esta lista es la lectura pública, no la oración.
                Desde B2, `/orar/[planId]` rechaza un plan público sin share
                explícito — apuntar aquí a Orar dejaba el enlace roto para
                exactamente lo que esta lista promete (ver DEF-01 del plan). */}
              {(plans ?? []).map((plan) => (
                <Link
                  key={plan.id}
                  href={{
                    pathname: "/plan-publico/[planId]",
                    params: { planId: plan.id },
                  }}
                  asChild
                >
                  <Tap accessibilityRole="link" className="rounded-card">
                    <Card flat className="gap-1">
                      <Text className="font-serif-bold text-base text-plum">
                        {plan.title}
                      </Text>
                      <Text className="font-sans text-sm text-mist-ink">
                        {t("newPlan.days", { count: plan.duration_days })}
                      </Text>
                    </Card>
                  </Tap>
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
                <Card key={post.id} flat className="gap-2">
                  <Txt variant="bodySerifReading">{post.body}</Txt>
                  <Text className="font-sans text-sm text-mist-ink">
                    {t("feed.prayCount", { count: post.prayer_count })}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}

          {theirs.length > 0 ? (
            <View className="gap-4">
              <Text className="font-sans-medium text-sm text-mist-ink">
                {t("testimony.title")}
              </Text>

              {theirs.map((entry) => (
                <Card key={entry.id} flat className="gap-2">
                  {entry.plan_title ? (
                    <Text className="font-sans text-sm text-mist-ink">
                      {entry.plan_title}
                    </Text>
                  ) : null}
                  <Txt variant="bodySerifReading">{entry.body}</Txt>
                </Card>
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
        </ScrollView>
      </DawnBackground>

      {!person.is_me ? (
        <ActionMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={t("profile.moreActions")}
          actions={[
            {
              key: "share",
              label: t("common.share"),
              onPress: () => {
                void handleShare();
              },
            },
            {
              key: "report",
              label: t("moderation.report"),
              disabled: report.isPending,
              onPress: () => {
                void handleReport();
              },
            },
            {
              key: "block",
              label: t("moderation.block"),
              danger: true,
              disabled: block.isPending,
              onPress: () => {
                void handleBlock();
              },
            },
          ]}
        />
      ) : null}
    </>
  );
}
