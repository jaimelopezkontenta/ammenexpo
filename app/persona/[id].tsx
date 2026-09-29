import { Link, Stack, useLocalSearchParams } from "expo-router";
import { MoreHorizontal } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";
import { useUserId } from "@/core/auth/useUserId";
import { useBlockUser } from "@/core/moderation/blocks";
import { useReportProfile } from "@/core/moderation/queue";
import { usePublicProfile } from "@/core/profile/queries";
import { buildShareUrl, shareOrCopy } from "@/core/share";
import { usePersonPlans, usePersonPosts } from "@/core/social/feed";
import { useFollowUser, useUnfollowUser } from "@/core/social/follows";
import { useVisibleTestimonies } from "@/core/testimonies/queries";
import { useToast } from "@/core/toast/ToastProvider";
import { useAction } from "@/core/toast/useAction";
import { icon, useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";

/** Un número y lo que significa. Tres veces en la misma fila. */
const Stat = ({ value, label }: { value: number; label: string }) => (
  <View className="items-center gap-0.5">
    <Txt variant="subheadingLg">{value}</Txt>
    <Txt variant="captionSm">{label}</Txt>
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();

  const {
    data: person,
    isLoading,
    isLoadingError,
    refetch,
  } = usePublicProfile(id);
  const { data: testimonies } = useVisibleTestimonies(userId);
  const { data: posts } = usePersonPosts(id);
  const { data: plans } = usePersonPlans(id);
  const block = useBlockUser(userId);
  const report = useReportProfile(userId);
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();

  // Los resultados, por el toast del sistema (core/toast/useAction.ts).
  const { run } = useAction();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const theirs = (testimonies ?? []).filter((entry) => entry.author_id === id);

  const handleFollow = async () => {
    if (!userId || !person) return;

    const input = { userId, targetId: id };

    // El caso concreto que la policy rechaza —seguir a quien te bloqueó— no
    // se dice por su nombre: bloquear es silencioso en toda la app, y un
    // "no puedes porque te bloquearon" lo dejaría de ser. Sale el error de
    // siempre.
    await run(() =>
      person.i_follow ? unfollow.mutateAsync(input) : follow.mutateAsync(input),
    );
  };

  const handleBlock = () =>
    run(() => block.mutateAsync(id), t("moderation.blockDone"));

  const handleReport = () =>
    run(() => report.mutateAsync(id), t("moderation.reportDone"));

  const handleShare = async () => {
    if (!person) return;

    const outcome = await shareOrCopy(
      t("profile.shareMessage", { name: person.display_name }),
      buildShareUrl(`/persona/${id}`, "invitacion"),
    );

    if (outcome === "copied") toast.success(t("share.linkCopied"));
    if (outcome === "failed") toast.error(t("share.shareFailed"));
  };

  if (isLoading) {
    return <ScreenScaffold title="" loading />;
  }

  if (isLoadingError) {
    return <ScreenScaffold title="" error onRetry={() => void refetch()} />;
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
      <ScreenScaffold
        title={person.display_name}
        screenOptions={{
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
        contentClassName="flex-grow gap-8"
      >
        <View className="items-center gap-3">
          <Avatar
            name={person.display_name}
            url={person.avatar_url}
            seed={person.id}
            size={96}
          />

          <Txt variant="title" className="text-center">
            {person.display_name}
          </Txt>

          <Txt variant="caption" className="text-center">
            {t("profile.memberSince", {
              // El idioma de la app, no el del navegador: con `undefined`
              // ponía "May 2026" en una pantalla entera en español.
              date: new Date(person.member_since).toLocaleDateString(
                i18n.language,
                { year: "numeric", month: "long" },
              ),
            })}
          </Txt>

          {/* Compartir círculo es lo que explica por qué esta persona puede ver
              tus peticiones, así que se dice en las dos direcciones. En tu
              propio perfil no: `shares_a_circle_with` contigo misma es cierto,
              y "compartís un círculo" sobre ti no significa nada. */}
          {!person.is_me ? (
            <Txt variant="caption" className="text-center">
              {person.shares_circle
                ? t("profile.sharesCircle")
                : t("profile.noSharedCircle")}
            </Txt>
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
            <Txt variant="label" tone="secondary">
              {t("community.publicPlans")}
            </Txt>

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
                    <Txt variant="title" className="text-base">
                      {plan.title}
                    </Txt>
                    <Txt variant="caption">
                      {t("newPlan.days", { count: plan.duration_days })}
                    </Txt>
                  </Card>
                </Tap>
              </Link>
            ))}
          </View>
        ) : null}

        {(posts ?? []).length > 0 ? (
          <View className="gap-4">
            <Txt variant="label" tone="secondary">
              {t("feed.title")}
            </Txt>

            {/* Solo lo que pidió con su nombre. Lo anónimo no llega hasta aquí
                —el servidor lo excluye— porque una lista por persona es justo
                la forma de deshacer un anonimato. */}
            {(posts ?? []).map((post) => (
              <Card key={post.id} flat className="gap-2">
                <Txt variant="bodySerifReading">{post.body}</Txt>
                <Txt variant="caption">
                  {t("feed.prayCount", { count: post.prayer_count })}
                </Txt>
              </Card>
            ))}
          </View>
        ) : null}

        {theirs.length > 0 ? (
          <View className="gap-4">
            <Txt variant="label" tone="secondary">
              {t("testimony.title")}
            </Txt>

            {theirs.map((entry) => (
              <Card key={entry.id} flat className="gap-2">
                {entry.plan_title ? (
                  <Txt variant="caption">{entry.plan_title}</Txt>
                ) : null}
                <Txt variant="bodySerifReading">{entry.body}</Txt>
              </Card>
            ))}
          </View>
        ) : null}
      </ScreenScaffold>

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
