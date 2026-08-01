import { Link, router, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useTogglePostPrayer } from "@/core/posts/queries";
import {
  useHomeFeed,
  useSearchPeople,
  type FeedEntry,
} from "@/core/social/feed";
import { useFollowUser, useUnfollowUser } from "@/core/social/follows";

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
 */
export default function Community() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Una sola mutación para todas las tarjetas: sin saber cuál está en vuelo,
  // pulsar dos seguidas dejaría las dos con el indicador puesto.
  const [pending, setPending] = useState<string | null>(null);

  const searching = query.trim().length > 0;

  const feed = useHomeFeed();
  const people = useSearchPeople(query.trim());
  const togglePrayer = useTogglePostPrayer(userId);
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();

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

  const handlePray = async (entry: FeedEntry) => {
    setError(null);

    try {
      await togglePrayer.mutateAsync({
        postId: entry.id,
        prayed: entry.i_prayed,
      });
      void feed.refetch();
    } catch {
      setError(t("common.errorGeneric"));
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
            <Link href="/peticiones/nueva" asChild>
              <Button title={t("feed.newPost")} variant="secondary" />
            </Link>

            {(feed.data ?? []).length === 0 ? (
              <Text className="text-base leading-6 text-ink-muted">
                {t("community.empty")}
              </Text>
            ) : (
              (feed.data ?? []).map((entry) => (
                <FeedCard
                  key={`${entry.kind}-${entry.id}`}
                  entry={entry}
                  onPray={() => void handlePray(entry)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const FeedCard = ({
  entry,
  onPray,
}: {
  entry: FeedEntry;
  onPray: () => void;
}) => {
  const { t } = useTranslation();

  // Una petición anónima no trae ni nombre ni id: es lo que hace que el
  // anonimato lo sea. Sin id, el tono del avatar sale del de la propia
  // petición, para que dos de la misma persona no compartan color.
  const anonymous = !entry.author_id;

  return (
    <View className="gap-3 rounded-2xl border border-ink-line p-5">
      <View className="flex-row items-center gap-2">
        <Avatar
          name={anonymous ? t("feed.anonymousName") : (entry.author_name ?? "")}
          url={entry.author_avatar_url}
          seed={anonymous ? entry.id : (entry.author_id ?? "")}
          size={28}
        />

        {anonymous ? (
          <Text className="flex-1 text-sm font-medium text-ink-soft">
            {t("feed.anonymousName")}
          </Text>
        ) : (
          <Link
            href={{
              pathname: "/persona/[id]",
              params: { id: entry.author_id! },
            }}
            asChild
          >
            <Pressable accessibilityRole="link" className="flex-1">
              <Text className="text-sm font-medium text-ink-soft">
                {entry.author_name}
              </Text>
            </Pressable>
          </Link>
        )}

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

      {entry.kind === "request" ? (
        <View className="flex-row items-center gap-4">
          <Pressable accessibilityRole="button" onPress={onPray}>
            <Text
              className={
                entry.i_prayed
                  ? "text-sm font-semibold text-clay"
                  : "text-sm text-ink-soft underline"
              }
            >
              {entry.i_prayed ? t("feed.prayed") : t("feed.pray")}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/peticiones/[id]",
                params: { id: entry.id },
              })
            }
          >
            <Text className="text-sm text-ink-soft underline">
              {t("feed.commentCount", { count: entry.comment_count })}
            </Text>
          </Pressable>
        </View>
      ) : null}

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
      ) : null}
    </View>
  );
};
