import { router, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useJoinPublicCircle,
  useSearchPublicCircles,
} from "@/core/circles/queries";

/**
 * The directory that makes "aparecerá en las búsquedas" true.
 *
 * That line has been on the circle creation screen since the first version,
 * describing something that did not exist. Building it rather than deleting it
 * is the more useful half of the choice, but it is also the half that lets
 * strangers into a room where people write down what they are afraid of — so
 * blocking, reporting and removing members shipped alongside it.
 */
export default function FindCircles() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  // One mutation is shared by every card, so without tracking which one is in
  // flight a slow join let somebody tap three circles and only the last
  // navigation won.
  const [joining, setJoining] = useState<string | null>(null);

  const {
    data: circles,
    isLoading,
    isError,
    refetch,
  } = useSearchPublicCircles(query);
  const join = useJoinPublicCircle(userId);

  const handleJoin = async (circleId: string) => {
    setError(null);

    setJoining(circleId);

    try {
      await join.mutateAsync(circleId);
      router.push({ pathname: "/circulo/[id]", params: { id: circleId } });
    } catch {
      setError(t("common.errorGeneric"));
    } finally {
      setJoining(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("circles.find"), headerShown: true }} />
      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="gap-5 px-7 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          className="w-full rounded-2xl border border-ink-line bg-paper px-4 py-3.5 text-base text-ink"
          accessibilityLabel={t("circles.findPlaceholder")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("circles.findPlaceholder")}
          placeholderTextColor="#726A62"
          autoCorrect={false}
        />

        {error ? (
          <Text className="text-sm text-red-500" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {isLoading ? <LoadingState /> : null}

        {isError ? <ErrorState onRetry={() => void refetch()} /> : null}

        {/* An empty query browses instead of filtering, so "no results" here
            always means something real: either nobody has opened a public
            circle yet, or this search found none. */}
        {!isLoading && !isError && (circles ?? []).length === 0 ? (
          <Text className="text-base leading-6 text-ink-muted">
            {query.trim() ? t("circles.findEmpty") : t("circles.findNone")}
          </Text>
        ) : null}

        {(circles ?? []).map((circle) => (
          <View
            key={circle.id}
            className="gap-2 rounded-2xl border border-ink-line p-5"
          >
            <Text className="text-lg font-semibold text-ink">
              {circle.name}
            </Text>

            {circle.description ? (
              <Text className="text-base leading-6 text-ink-muted">
                {circle.description}
              </Text>
            ) : null}

            <Text className="text-sm text-ink-soft">
              {t("circles.members", { count: circle.member_count })}
            </Text>

            {circle.is_member ? (
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  router.push({
                    pathname: "/circulo/[id]",
                    params: { id: circle.id },
                  })
                }
              >
                <Text className="text-base font-medium text-ink">
                  {t("circles.alreadyIn")}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: joining === circle.id }}
                aria-busy={joining === circle.id}
                disabled={joining !== null}
                onPress={() => void handleJoin(circle.id)}
              >
                <Text
                  className={`text-base font-medium ${
                    joining !== null ? "text-ink-soft" : "text-ink"
                  }`}
                >
                  {joining === circle.id
                    ? t("circles.joining")
                    : t("circles.join")}
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </>
  );
}
