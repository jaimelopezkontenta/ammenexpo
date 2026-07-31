import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useCircle,
  useCircleMembers,
  useLeaveCircle,
} from "@/core/circles/queries";
import { buildShareUrl, shareOrCopy } from "@/core/share";

export default function CircleDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: circle, isLoading } = useCircle(id);
  const { data: members } = useCircleMembers(id);
  const leave = useLeaveCircle(userId);

  const [notice, setNotice] = useState<string | null>(null);

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
        <Text className="text-center text-base text-slate-500">
          {t("circles.inviteNotFound")}
        </Text>
      </View>
    );
  }

  const inviteUrl = buildShareUrl(`/c/${circle.invite_token}`);

  const handleInvite = async () => {
    const outcome = await shareOrCopy(
      t("circles.shareMessage", { name: circle.name }),
      inviteUrl,
    );

    // "failed" used to fall into the same branch as a successful native share
    // and show nothing at all, so a blocked clipboard looked like a dead button.
    setNotice(
      outcome === "copied"
        ? t("circles.linkCopied")
        : outcome === "failed"
          ? t("share.shareFailed")
          : null,
    );
  };

  const handleLeave = async () => {
    await leave.mutateAsync(circle.id);
    router.replace("/circulos");
  };

  return (
    <>
      <Stack.Screen options={{ title: circle.name, headerShown: true }} />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="flex-grow gap-6 px-7 py-8"
      >
        {/* The name is already in the navigation header; repeating it here as a
            heading just pushed the useful content down. */}
        <View className="gap-1">
          {circle.description ? (
            <Text className="text-base text-slate-500">
              {circle.description}
            </Text>
          ) : null}
          <Text className="text-sm text-slate-400">
            {t("circles.members", { count: circle.member_count })} ·{" "}
            {circle.visibility === "private"
              ? t("circles.visibilityPrivate")
              : t("circles.visibilityPublic")}
          </Text>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-slate-400">
            {t("circles.membersTitle")}
          </Text>
          {(members ?? []).map((member) => (
            <View
              key={member.user_id}
              className="flex-row items-center justify-between"
            >
              <Text className="text-base text-slate-800">
                {member.display_name}
              </Text>
              {member.role !== "member" ? (
                <Text className="text-sm text-slate-400">
                  {member.role === "owner"
                    ? t("circles.owner")
                    : t("circles.admin")}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View className="gap-2 rounded-2xl bg-slate-50 p-5">
          <Text className="text-sm font-medium text-slate-400">
            {t("circles.inviteLink")}
          </Text>
          <Text className="text-sm text-slate-600" selectable>
            {inviteUrl}
          </Text>
        </View>

        {notice ? (
          <Text className="text-sm text-slate-600" accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}

        <View className="mt-auto gap-3 pt-6">
          <Button
            title={t("circles.invite")}
            onPress={() => void handleInvite()}
          />
          <Button
            title={t("circles.leave")}
            variant="ghost"
            loading={leave.isPending}
            onPress={() => void handleLeave()}
          />
        </View>
      </ScrollView>
    </>
  );
}
