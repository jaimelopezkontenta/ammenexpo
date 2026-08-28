import { Link, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Txt } from "@/components/ui/Text";
import { Button } from "@/components/Button";
import { LoadMore } from "@/components/LoadMore";
import { PrayerRequestCard } from "@/components/PrayerRequestCard";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useSession } from "@/core/auth/SessionProvider";
import { useBlockUser } from "@/core/moderation/blocks";
import { usePublicProfile } from "@/core/profile/queries";
import {
  useDeletePrayerRequest,
  useMarkAnswered,
  useReportPost,
  useTogglePostPrayer,
} from "@/core/posts/queries";
import {
  useHomeFeed,
  useSearchPeople,
  type FeedEntry,
} from "@/core/social/feed";
import { useFollowUser, useUnfollowUser } from "@/core/social/follows";
import { useReportTestimony } from "@/core/testimonies/queries";

import { EmptyState } from "@/components/ui/EmptyState";

import { Tap } from "@/components/ui/Tap";

/**
 * La comunidad — el contenido, sin pantalla alrededor.
 *
 * Vive como pane porque se sienta en dos sitios: la ruta /comunidad (con su
 * header de stack) y el segmento Comunidad de la tab Juntos. El scroll es
 * suyo: cada segmento trae su propio contenedor.
 *
 * Media red social ya estaba construida y escondida: el muro abierto de
 * peticiones era un enlace dentro de la pestaña Orar, y los testimonios estaban
 * detrás de un botón en el Perfil. Aquí se juntan, con los planes públicos y
 * —lo que no existía de ninguna forma— una manera de encontrar a una persona.
 *
 * **Buscar no es otra ruta**: escribir sustituye el feed por personas, igual
 * que en la pestaña de la Biblia. Un paso menos y ningún nombre que inventar.
 *
 * Y las peticiones se pintan con `PrayerRequestCard`, la misma del muro. La
 * primera versión traía tarjeta propia con orar y comentar, y **sin reportar ni
 * bloquear** — en la pantalla donde aparecen más desconocidos, que es justo
 * donde mira primero la Guideline 1.2.
 */
export const CommunityPane = () => {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Una sola mutación para todas las tarjetas: sin saber cuál está en vuelo,
  // pulsar dos seguidas dejaría las dos con el indicador puesto.
  const [pending, setPending] = useState<string | null>(null);

  const { scrollBottom } = useScreenPadding();

  const searching = query.trim().length > 0;
  // Tu propio perfil ya trae este número y está en caché desde cualquier
  // pantalla que lo haya abierto; no hace falta una consulta nueva para una
  // línea de texto.
  const { data: me } = usePublicProfile(userId);
  const following = me?.following_count ?? 0;

  const feed = useHomeFeed();
  const people = useSearchPeople(query.trim());
  const togglePrayer = useTogglePostPrayer(userId);
  const reportPost = useReportPost(userId);
  const reportTestimony = useReportTestimony(userId);
  const block = useBlockUser(userId);
  const markAnswered = useMarkAnswered();
  const remove = useDeletePrayerRequest();
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setError(null);
    setNotice(null);

    try {
      await action();
      if (done) setNotice(done);
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const handleFollow = async (targetId: string, following: boolean) => {
    if (!userId) return;

    setError(null);
    setPending(targetId);

    try {
      const input = { userId, targetId };
      if (following) {
        await unfollow.mutateAsync(input);
      } else {
        await follow.mutateAsync(input);
      }
      void people.refetch();
    } catch {
      setError(t("common.errorGeneric"));
    } finally {
      setPending(null);
    }
  };

  return (
    <ScrollView
      contentContainerClassName="gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center md:px-10"
      contentContainerStyle={{ paddingBottom: scrollBottom }}
      keyboardShouldPersistTaps="handled"
    >
      <TextField
        skin="dawn"
        hideLabel
        label={t("community.searchPlaceholder")}
        className="py-3.5"
        value={query}
        onChangeText={setQuery}
        placeholder={t("community.searchPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {notice ? (
        <Txt variant="caption" accessibilityRole="alert">
          {notice}
        </Txt>
      ) : null}

      {error ? (
        <Txt variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}

      {searching ? (
        people.isLoading ? (
          <LoadingState />
        ) : people.isError ? (
          <ErrorState onRetry={() => void people.refetch()} />
        ) : (people.data ?? []).length === 0 ? (
          <Txt variant="body" tone="secondary">
            {t("community.nobodyFound")}
          </Txt>
        ) : (
          (people.data ?? []).map((person) => (
            <View
              key={person.id}
              className="flex-row items-center gap-3 rounded-card border border-glassedge/65 bg-glass/60 p-4 shadow-soft"
            >
              <Link
                href={{
                  pathname: "/persona/[id]",
                  params: { id: person.id },
                }}
                asChild
              >
                <Tap
                  accessibilityRole="link"
                  className="flex-1 flex-row items-center gap-3"
                >
                  <Avatar
                    name={person.display_name}
                    url={person.avatar_url}
                    seed={person.id}
                    size={40}
                  />
                  <View className="flex-1">
                    <Txt variant="bodyMedium">{person.display_name}</Txt>
                    <Txt variant="caption">
                      {t("community.followers", {
                        count: person.follower_count,
                      })}
                    </Txt>
                  </View>
                </Tap>
              </Link>

              <Tap
                accessibilityRole="button"
                disabled={pending === person.id}
                onPress={() => void handleFollow(person.id, person.i_follow)}
              >
                <Txt variant="label" tone="accent">
                  {person.i_follow ? t("social.following") : t("social.follow")}
                </Txt>
              </Tap>
            </View>
          ))
        )
      ) : feed.isLoading ? (
        <LoadingState />
      ) : feed.isError ? (
        <ErrorState onRetry={() => void feed.refetch()} />
      ) : (
        <>
          {/* De quién es lo que se ve. Con cero seguidos el servidor sirve
                lo público reciente —un feed vacío el primer día es la forma más
                rápida de no volver— y sin decirlo parece que la app enseña
                desconocidos porque sí. */}
          <Txt variant="caption">
            {following > 0
              ? t("community.fromFollowing", { count: following })
              : t("community.fromEveryone")}
          </Txt>

          <Link href="/peticiones/nueva" asChild>
            <Button title={t("feed.newPost")} variant="secondary" />
          </Link>

          {(feed.data ?? []).length === 0 ? (
            <EmptyState title={t("community.empty")} />
          ) : (
            (feed.data ?? []).map((entry) =>
              entry.kind === "request" ? (
                // La misma tarjeta que el muro, con todo lo que trae:
                // reportar, bloquear, marcar respondida y borrar. `canHide` en
                // falso porque en el muro abierto no manda nadie, y eso la
                // propia pantalla del muro ya lo dice en voz alta.
                <PrayerRequestCard
                  key={`${entry.kind}-${entry.id}`}
                  request={{
                    id: entry.id,
                    body: entry.body ?? "",
                    is_anonymous: entry.is_anonymous,
                    author_id: entry.author_id,
                    author_name: entry.author_name,
                    author_avatar_url: entry.author_avatar_url,
                    prayer_count: entry.prayer_count,
                    comment_count: entry.comment_count,
                    answered_at: entry.answered_at,
                    held_at: entry.held_at,
                    crisis_flagged_at: entry.crisis_flagged_at,
                    created_at: entry.created_at,
                    i_prayed: entry.i_prayed,
                    is_mine: entry.is_mine,
                  }}
                  canHide={false}
                  onTogglePrayer={() =>
                    void run(() =>
                      togglePrayer
                        .mutateAsync({
                          postId: entry.id,
                          prayed: entry.i_prayed,
                        })
                        .then(() => feed.refetch()),
                    )
                  }
                  onOpen={() =>
                    router.push({
                      pathname: "/peticiones/[id]",
                      params: { id: entry.id },
                    })
                  }
                  onReport={() =>
                    void run(
                      () =>
                        reportPost.mutateAsync({
                          id: entry.id,
                          kind: "post",
                        }),
                      t("moderation.reportDone"),
                    )
                  }
                  onBlock={(who) =>
                    void run(
                      () => block.mutateAsync(who),
                      t("moderation.blockDone"),
                    )
                  }
                  // En el muro abierto no hay quien administre, así que esta
                  // nunca se llama: `canHide` mantiene el control fuera.
                  onHide={() => undefined}
                  onMarkAnswered={() =>
                    void run(() =>
                      markAnswered
                        .mutateAsync(entry.id)
                        .then(() => feed.refetch()),
                    )
                  }
                  onDelete={() =>
                    void run(() =>
                      remove.mutateAsync(entry.id).then(() => feed.refetch()),
                    )
                  }
                />
              ) : (
                <StoryCard
                  key={`${entry.kind}-${entry.id}`}
                  entry={entry}
                  onReport={() =>
                    void run(
                      () =>
                        entry.kind === "testimony"
                          ? reportTestimony.mutateAsync(entry.id)
                          : reportPost.mutateAsync({
                              id: entry.id,
                              kind: "post",
                            }),
                      t("moderation.reportDone"),
                    )
                  }
                  onBlock={() => {
                    if (!entry.author_id) return;

                    void run(
                      () => block.mutateAsync(entry.author_id!),
                      t("moderation.blockDone"),
                    );
                  }}
                />
              ),
            )
          )}

          <LoadMore
            hasMore={feed.hasNextPage}
            loading={feed.isFetchingNextPage}
            onPress={() => void feed.fetchNextPage()}
          />
        </>
      )}
    </ScrollView>
  );
};

/**
 * Un testimonio o un plan público.
 *
 * Los dos llevan reportar y bloquear. Sin eso, el testimonio de un desconocido
 * era una tarjeta que no se podía tocar de ninguna forma — el mismo agujero que
 * tenían las peticiones aquí, en esta misma pantalla.
 */
const StoryCard = ({
  entry,
  onReport,
  onBlock,
}: {
  entry: FeedEntry;
  onReport: () => void;
  onBlock: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <View className="gap-3 rounded-card border border-glassedge/65 bg-glass/60 p-5 shadow-soft">
      <View className="flex-row items-center gap-2">
        <Avatar
          name={entry.author_name ?? ""}
          url={entry.author_avatar_url}
          seed={entry.author_id ?? entry.id}
          size={28}
        />

        <Link
          href={{
            pathname: "/persona/[id]",
            params: { id: entry.author_id ?? "" },
          }}
          asChild
        >
          <Tap accessibilityRole="link" className="flex-1">
            <Txt variant="label" tone="secondary">
              {entry.author_name}
            </Txt>
          </Tap>
        </Link>

        {/* Qué es cada fila. Sin esto, un testimonio y una petición se leen
            igual, y son cosas muy distintas: una pide, la otra cuenta. */}
        <Txt variant="overline">{t(`community.kind.${entry.kind}`)}</Txt>
      </View>

      {entry.title ? (
        <Txt variant="title" className="text-base">
          {entry.title}
        </Txt>
      ) : null}

      {entry.body ? <Txt variant="bodySerifReading">{entry.body}</Txt> : null}

      <View className="flex-row flex-wrap gap-4">
        {entry.kind === "plan" ? (
          // Comunidad solo enseña planes `public` (home_feed los filtra así),
          // y desde B2 esos ya no se abren en /orar/[planId] sin un share
          // explícito: la lectura y la oración dejaron de ser la misma ruta.
          <Link
            href={{
              pathname: "/plan-publico/[planId]",
              params: { planId: entry.id },
            }}
            asChild
          >
            <Tap accessibilityRole="link">
              <Txt variant="caption" tone="accent" className="underline">
                {t("community.openPlan")}
              </Txt>
            </Tap>
          </Link>
        ) : (
          <Link href="/testimonios" asChild>
            <Tap accessibilityRole="link">
              <Txt variant="caption" tone="accent" className="underline">
                {t("community.openTestimonies")}
              </Txt>
            </Tap>
          </Link>
        )}

        {entry.is_mine ? null : (
          <>
            <Tap accessibilityRole="button" onPress={onReport}>
              <Txt variant="caption" className="underline">
                {t("moderation.report")}
              </Txt>
            </Tap>

            <Tap
              accessibilityRole="button"
              accessibilityLabel={`${t("moderation.block")} ${entry.author_name ?? ""}`}
              onPress={onBlock}
            >
              <Txt variant="caption" className="underline">
                {t("moderation.block")}
              </Txt>
            </Tap>
          </>
        )}
      </View>
    </View>
  );
};
