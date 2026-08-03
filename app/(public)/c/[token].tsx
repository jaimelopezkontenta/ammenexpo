import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { rememberShareToken, rememberSource } from "@/core/auth/pendingToken";
import { useSession } from "@/core/auth/SessionProvider";
import { useCircleInvitePreview, useJoinCircle } from "@/core/circles/queries";

export default function CircleInvite() {
  const { t } = useTranslation();
  const { token, de } = useLocalSearchParams<{
    token: string;
    /** Por dónde llegó: lo pone `buildShareUrl` al repartir el enlace. */
    de?: string;
  }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: circle,
    isLoading,
    isError,
    refetch,
  } = useCircleInvitePreview(token);
  const join = useJoinCircle(userId);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Same as the shared-plan preview: keep the token across signup so the new
  // account lands inside the circle instead of on an empty home screen.
  useEffect(() => {
    if (token) {
      void rememberShareToken(token);
      // La etiqueta viaja con el enlace y se guarda **una sola vez**: quien
      // abre tres antes de decidirse entró por el primero.
      if (de) void rememberSource(de);
    }
  }, [token, de]);

  const handleJoin = async () => {
    if (!token) return;

    setJoinError(null);

    try {
      const circleId = await join.mutateAsync(token);
      router.replace({ pathname: "/circulo/[id]", params: { id: circleId } });
    } catch {
      // Uncaught, an expired token or an already-a-member answer became an
      // unhandled rejection: the button un-spun and nothing was said.
      setJoinError(t("circles.joinFailed"));
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (!circle) {
    return (
      <DawnBackground
        variant="radial"
        className="items-center justify-center gap-3 px-8"
      >
        <Text className="text-center font-sans-bold text-xl text-plum">
          {t("circles.inviteNotFound")}
        </Text>

        {/* No header in this group, so without these a dead invite left a
            stranger on a single line of text with nowhere to go. */}
        <View className="mt-6 w-full gap-3">
          {session ? (
            <Button
              title={t("share.goHome")}
              onPress={() => router.replace("/")}
            />
          ) : (
            <>
              <Link href="/crear-cuenta" asChild>
                <Button title={t("share.deadLinkCta")} />
              </Link>
              <Link href="/entrar" asChild>
                <Button title={t("share.alreadyMember")} variant="ghost" />
              </Link>
            </>
          )}
        </View>
      </DawnBackground>
    );
  }

  return (
    <DawnBackground
      variant="radial"
      className="items-center justify-center gap-3 px-8"
    >
      <Text className="text-center font-sans-bold text-2xl text-plum">
        {t("circles.joinTitle", { name: circle.name })}
      </Text>
      <Text className="text-center font-sans text-base text-mist-ink">
        {t("circles.joinBody", { count: circle.member_count })}
      </Text>
      {circle.description ? (
        <Text className="text-center font-sans text-base text-mist-ink">
          {circle.description}
        </Text>
      ) : null}

      {joinError ? (
        <Text
          className="text-center font-sans text-sm text-danger"
          accessibilityRole="alert"
        >
          {joinError}
        </Text>
      ) : null}

      <View className="mt-8 w-full gap-3">
        {session ? (
          <Button
            title={t("circles.join")}
            loading={join.isPending}
            onPress={() => void handleJoin()}
          />
        ) : (
          <>
            <Link href="/crear-cuenta" asChild>
              <Button title={t("circles.join")} />
            </Link>
            <Link href="/entrar" asChild>
              <Button title={t("share.alreadyMember")} variant="ghost" />
            </Link>
          </>
        )}
      </View>
    </DawnBackground>
  );
}
