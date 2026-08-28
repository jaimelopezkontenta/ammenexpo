import { router, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { Txt } from "@/components/ui/Text";
import { EmptyState } from "@/components/ui/EmptyState";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useJoinPublicCircle,
  useSearchPublicCircles,
} from "@/core/circles/queries";

import { Tap } from "@/components/ui/Tap";

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
  const { scrollBottom } = useScreenPadding();
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
      <DawnBackground>
        <ScrollView
          contentContainerClassName="gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            skin="dawn"
            hideLabel
            label={t("circles.findPlaceholder")}
            className="py-3.5"
            value={query}
            onChangeText={setQuery}
            placeholder={t("circles.findPlaceholder")}
            autoCorrect={false}
          />

          {error ? (
            <Txt variant="caption" tone="danger" accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}

          {isLoading ? <LoadingState /> : null}

          {isError ? <ErrorState onRetry={() => void refetch()} /> : null}

          {/* An empty query browses instead of filtering, so "no results" here
            always means something real: either nobody has opened a public
            circle yet, or this search found none. */}
          {!isLoading && !isError && (circles ?? []).length === 0 ? (
            <EmptyState
              title={
                query.trim() ? t("circles.findEmpty") : t("circles.findNone")
              }
            />
          ) : null}

          {(circles ?? []).map((circle) => (
            <View
              key={circle.id}
              className="gap-2 rounded-card border border-glassedge/65 bg-glass/60 p-5 shadow-soft"
            >
              <Txt variant="subheadingLg">{circle.name}</Txt>

              {circle.description ? (
                <Txt variant="body" tone="secondary">
                  {circle.description}
                </Txt>
              ) : null}

              <Txt variant="caption">
                {t("circles.members", { count: circle.member_count })}
              </Txt>

              {circle.is_member ? (
                <Tap
                  accessibilityRole="link"
                  onPress={() =>
                    router.push({
                      pathname: "/circulo/[id]",
                      params: { id: circle.id },
                    })
                  }
                >
                  <Txt variant="bodyMedium">{t("circles.alreadyIn")}</Txt>
                </Tap>
              ) : (
                <Tap
                  accessibilityRole="button"
                  accessibilityState={{ busy: joining === circle.id }}
                  aria-busy={joining === circle.id}
                  disabled={joining !== null}
                  onPress={() => void handleJoin(circle.id)}
                >
                  <Txt
                    variant="bodyMedium"
                    tone={joining !== null ? "secondary" : "primary"}
                  >
                    {joining === circle.id
                      ? t("circles.joining")
                      : t("circles.join")}
                  </Txt>
                </Tap>
              )}
            </View>
          ))}
        </ScrollView>
      </DawnBackground>
    </>
  );
}
