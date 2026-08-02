import { Link, router, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { LoadMore } from "@/components/LoadMore";
import { PrayerRequestCard } from "@/components/PrayerRequestCard";
import { ErrorState, LoadingState } from "@/components/ScreenState";
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

/**
 * La comunidad.
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
export default function Community() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Una sola mutación para todas las tarjetas: sin saber cuál está en vuelo,
  // pulsar dos seguidas dejaría las dos con el indicador puesto.
  const [pending, setPending] = useState<string | null>(null);

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
    <>
      <Stack.Screen
        options={{ title: t("community.title"), headerShown: true }}
      />

      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="gap-5 px-7 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          className="w-full rounded-2xl border border-ink-line bg-paper px-4 py-3.5 text-base text-ink"
          accessibilityLabel={t("community.searchPlaceholder")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("community.searchPlaceholder")}
          placeholderTextColor="#726A62"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

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

        {searching ? (
          people.isLoading ? (
            <LoadingState />
          ) : people.isError ? (
            <ErrorState onRetry={() => void people.refetch()} />
          ) : (people.data ?? []).length === 0 ? (
            <Text className="text-base leading-6 text-ink-muted">
              {t("community.nobodyFound")}
            </Text>
          ) : (
            (people.data ?? []).map((person) => (
              <View
                key={person.id}
                className="flex-row items-center gap-3 rounded-2xl border border-ink-line p-4"
              >
                <Link
                  href={{
                    pathname: "/persona/[id]",
                    params: { id: person.id },
                  }}
                  asChild
                >
                  <Pressable
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
                      <Text className="text-base font-medium text-ink">
                        {person.display_name}
                      </Text>
                      <Text className="text-sm text-ink-soft">
                        {t("community.followers", {
                          count: person.follower_count,
                        })}
                      </Text>
                    </View>
                  </Pressable>
                </Link>

                <Pressable
                  accessibilityRole="button"
                  disabled={pending === person.id}
                  onPress={() => void handleFollow(person.id, person.i_follow)}
                >
                  <Text className="text-sm font-medium text-clay">
                    {person.i_follow
                      ? t("social.following")
                      : t("social.follow")}
                  </Text>
                </Pressable>
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
            <Text className="text-sm leading-6 text-ink-muted">
              {following > 0
                ? t("community.fromFollowing", { count: following })
                : t("community.fromEveryone")}
            </Text>

            <Link href="/peticiones/nueva" asChild>
              <Button title={t("feed.newPost")} variant="secondary" />
            </Link>

            {(feed.data ?? []).length === 0 ? (
              <Text className="text-base leading-6 text-ink-muted">
                {t("community.empty")}
              </Text>
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
    </>
  );
}

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
    <View className="gap-3 rounded-2xl border border-ink-line p-5">
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
          <Pressable accessibilityRole="link" className="flex-1">
            <Text className="text-sm font-medium text-ink-soft">
              {entry.author_name}
            </Text>
          </Pressable>
        </Link>

        {/* Qué es cada fila. Sin esto, un testimonio y una petición se leen
            igual, y son cosas muy distintas: una pide, la otra cuenta. */}
        <Text className="text-xs uppercase tracking-wide text-ink-soft">
          {t(`community.kind.${entry.kind}`)}
        </Text>
      </View>

      {entry.title ? (
        <Text className="font-serif-bold text-base text-ink">
          {entry.title}
        </Text>
      ) : null}

      {entry.body ? (
        <Text className="font-serif text-base leading-reading text-ink">
          {entry.body}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-4">
        {entry.kind === "plan" ? (
          <Link
            href={{ pathname: "/orar/[planId]", params: { planId: entry.id } }}
            asChild
          >
            <Pressable accessibilityRole="link">
              <Text className="text-sm text-clay underline">
                {t("community.openPlan")}
              </Text>
            </Pressable>
          </Link>
        ) : (
          <Link href="/testimonios" asChild>
            <Pressable accessibilityRole="link">
              <Text className="text-sm text-clay underline">
                {t("community.openTestimonies")}
              </Text>
            </Pressable>
          </Link>
        )}

        {entry.is_mine ? null : (
          <>
            <Pressable accessibilityRole="button" onPress={onReport}>
              <Text className="text-sm text-ink-soft underline">
                {t("moderation.report")}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t("moderation.block")} ${entry.author_name ?? ""}`}
              onPress={onBlock}
            >
              <Text className="text-sm text-ink-soft underline">
                {t("moderation.block")}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};
