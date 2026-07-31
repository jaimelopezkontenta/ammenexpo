import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { rememberShareToken } from "@/core/auth/pendingToken";
import { useSession } from "@/core/auth/SessionProvider";
import { useCircleInvitePreview, useJoinCircle } from "@/core/circles/queries";

export default function CircleInvite() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: circle, isLoading } = useCircleInvitePreview(token);
  const join = useJoinCircle(userId);

  // Same as the shared-plan preview: keep the token across signup so the new
  // account lands inside the circle instead of on an empty home screen.
  useEffect(() => {
    if (token) {
      void rememberShareToken(token);
    }
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;

    const circleId = await join.mutateAsync(token);
    router.replace({ pathname: "/circulo/[id]", params: { id: circleId } });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0f172a" />
      </View>
    );
  }

  if (!circle) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-xl font-bold text-slate-900">
          {t("circles.inviteNotFound")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
      <Text className="text-center text-2xl font-bold text-slate-900">
        {t("circles.joinTitle", { name: circle.name })}
      </Text>
      <Text className="text-center text-base text-slate-500">
        {t("circles.joinBody", { count: circle.member_count })}
      </Text>
      {circle.description ? (
        <Text className="text-center text-base text-slate-600">
          {circle.description}
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
    </View>
  );
}
