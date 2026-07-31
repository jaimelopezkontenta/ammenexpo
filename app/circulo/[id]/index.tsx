import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useCircle,
  useCircleInviteToken,
  useCircleMembers,
  useLeaveCircle,
  useRemoveMember,
} from "@/core/circles/queries";
import { useBlockUser } from "@/core/moderation/blocks";
import { buildShareUrl, shareOrCopy } from "@/core/share";

export default function CircleDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: circle, isLoading, isError, refetch } = useCircle(id);
  const { data: members } = useCircleMembers(id);
  const { data: inviteToken } = useCircleInviteToken(id);
  const leave = useLeaveCircle(userId);
  const removeMember = useRemoveMember(id);
  const block = useBlockUser(userId);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingState />;
  }

  // These two used to be one branch with no header and no controls, so a flaky
  // connection told you your own circle did not exist and left you stuck on a
  // line of grey text with no way back.
  if (isError || !circle) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("circles.title"), headerShown: true }}
        />
        <ErrorState
          onRetry={isError ? () => void refetch() : undefined}
          message={isError ? undefined : t("circles.inviteNotFound")}
        />
      </>
    );
  }

  // The token no longer travels with the circle row, so it can be missing for
  // a moment. Showing the invite block with a half-built URL in it would hand
  // somebody a link to nowhere, which is worse than showing it a beat later.
  const inviteUrl = inviteToken ? buildShareUrl(`/c/${inviteToken}`) : null;

  const isAdmin = (members ?? []).some(
    (m) => m.user_id === userId && m.role !== "member",
  );

  const handleRemove = async (memberId: string) => {
    if (pendingRemoval !== memberId) {
      setNotice(null);
      setError(null);
      setPendingRemoval(memberId);
      return;
    }

    setError(null);
    setPendingRemoval(null);

    try {
      await removeMember.mutateAsync(memberId);
    } catch {
      setError(t("circles.removeFailed"));
    }
  };

  const handleBlock = async (memberId: string) => {
    setError(null);

    try {
      await block.mutateAsync(memberId);
      setNotice(t("moderation.blockDone"));
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const handleInvite = async () => {
    if (!inviteUrl) return;

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
    // Leaving a private circle cannot be undone without a fresh invite, and it
    // used to happen on a single tap of a ghost button. `circles.leaveConfirm`
    // has been translated in both languages all along, waiting.
    if (!confirmingLeave) {
      setNotice(null);
      setError(null);
      setConfirmingLeave(true);
      return;
    }

    setError(null);

    try {
      await leave.mutateAsync(circle.id);
      router.replace("/circulos");
    } catch {
      // Uncaught, this was an unhandled rejection: the button stopped spinning,
      // nothing was said, and the person stayed in the circle believing they
      // had left.
      setConfirmingLeave(false);
      setError(t("common.errorGeneric"));
    }
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
            <View key={member.user_id} className="gap-1">
              <View className="flex-row items-center justify-between">
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

              {/* Now that strangers can find and join a public circle, the two
                  ways out have to be reachable from the roster itself — not
                  buried behind a message somebody has to receive first. */}
              {member.user_id !== userId ? (
                <View className="flex-row gap-4">
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleBlock(member.user_id)}
                  >
                    <Text className="text-sm text-slate-400">
                      {t("moderation.block")}
                    </Text>
                  </Pressable>

                  {isAdmin && member.role !== "owner" ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleRemove(member.user_id)}
                    >
                      <Text className="text-sm text-slate-400">
                        {pendingRemoval === member.user_id
                          ? t("circles.removeConfirmCta")
                          : t("circles.remove")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <Link
          href={{ pathname: "/circulo/[id]/chat", params: { id: id! } }}
          asChild
        >
          <Button title={t("chat.open")} variant="secondary" />
        </Link>

        {inviteUrl ? (
          <View className="gap-2 rounded-2xl bg-slate-50 p-5">
            <Text className="text-sm font-medium text-slate-400">
              {t("circles.inviteLink")}
            </Text>
            <Text className="text-sm text-slate-600" selectable>
              {inviteUrl}
            </Text>
          </View>
        ) : null}

        {notice ? (
          <Text className="text-sm text-slate-600" accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}

        {error ? (
          <Text className="text-sm text-red-500" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {confirmingLeave ? (
          <Text
            className="text-sm text-slate-600"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {t("circles.leaveConfirm")}
          </Text>
        ) : null}

        <View className="mt-auto gap-3 pt-6">
          {inviteUrl ? (
            <Button
              title={t("circles.invite")}
              onPress={() => void handleInvite()}
            />
          ) : null}
          <Button
            title={
              confirmingLeave
                ? t("circles.leaveConfirmCta")
                : t("circles.leave")
            }
            variant={confirmingLeave ? "secondary" : "ghost"}
            loading={leave.isPending}
            onPress={() => void handleLeave()}
          />
        </View>
      </ScrollView>
    </>
  );
}
