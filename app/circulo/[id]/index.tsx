import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useCanCreateCirclePlan,
  useCircle,
  useCircleInviteToken,
  useCircleMembers,
  useCirclePlan,
  useCircleSharedPlans,
  useLeaveCircle,
  useMarkCircleDay,
  useRemoveMember,
} from "@/core/circles/queries";
import { Avatar } from "@/components/Avatar";
import { CirclePlanCard } from "@/components/CirclePlanCard";
import { useBlockUser } from "@/core/moderation/blocks";
import { buildShareUrl, shareOrCopy } from "@/core/share";

export default function CircleDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: circle, isLoading, isError, refetch } = useCircle(id);
  const { data: members, isError: membersFailed } = useCircleMembers(id);
  const { data: inviteToken } = useCircleInviteToken(id);
  const { data: circlePlan } = useCirclePlan(id);
  const { data: canCreatePlan } = useCanCreateCirclePlan(id);
  const { data: sharedPlans } = useCircleSharedPlans(id);
  const markCircleDay = useMarkCircleDay(id, userId);
  const leave = useLeaveCircle(userId);
  const removeMember = useRemoveMember(id);
  const block = useBlockUser(userId);

  const [notice, setNoticeState] = useState<string | null>(null);

  // A notice with no expiry outlives the action it describes: "Listo. No
  // volverás a ver a esta persona" was still sitting there several unrelated
  // taps later, reading as a response to whatever had just been pressed.
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setNotice = useCallback((message: string | null) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNoticeState(message);

    if (message) {
      noticeTimer.current = setTimeout(() => setNoticeState(null), 6000);
    }
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

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

  const handleMarkCircleDay = async (planDayId: string) => {
    setError(null);

    try {
      await markCircleDay.mutateAsync(planDayId);
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
        className="flex-1 bg-paper"
        contentContainerClassName="flex-grow gap-6 px-7 py-8"
      >
        {/* The name is already in the navigation header; repeating it here as a
            heading just pushed the useful content down. */}
        <View className="gap-1">
          {circle.description ? (
            <Text className="text-base text-ink-muted">
              {circle.description}
            </Text>
          ) : null}
          <Text className="text-sm text-ink-soft">
            {t("circles.members", { count: circle.member_count })} ·{" "}
            {circle.visibility === "private"
              ? t("circles.visibilityPrivate")
              : t("circles.visibilityPublic")}
          </Text>
        </View>

        {/* Above the roster on purpose: what the circle is *doing* matters more
            than who is in it, and this screen used to answer only the second. */}
        <CirclePlanCard
          circle={circle}
          plan={circlePlan}
          canCreate={canCreatePlan === true}
          isPending={markCircleDay.isPending}
          error={null}
          onMarkPrayed={(dayId) => void handleMarkCircleDay(dayId)}
        />

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink-soft">
            {t("circles.membersTitle")}
          </Text>
          {/* A failed roster read used to render an empty list —
              indistinguishable from a circle of one — and silently set
              `isAdmin` to false, hiding "Expulsar" from a real admin at the
              moment they most likely need it. */}
          {membersFailed ? (
            <Text
              className="text-base leading-6 text-ink-muted"
              accessibilityRole="alert"
            >
              {t("common.errorBody")}
            </Text>
          ) : null}

          {(members ?? []).map((member) => (
            <View key={member.user_id} className="gap-1">
              <View className="flex-row items-center justify-between gap-3">
                {/* El censo era una lista de nombres muertos. Ahora cada uno
                    lleva a su perfil, que es donde se ve desde cuándo lleva
                    aquí y lo que haya querido contar. */}
                <Link
                  href={{
                    pathname: "/persona/[id]",
                    params: { id: member.user_id },
                  }}
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    className="flex-1 flex-row items-center gap-3"
                  >
                    <Avatar
                      name={member.display_name}
                      url={member.avatar_url}
                      seed={member.user_id}
                      size={32}
                    />
                    <Text className="flex-1 text-base text-ink">
                      {member.display_name}
                    </Text>
                  </Pressable>
                </Link>
                {member.role !== "member" ? (
                  <Text className="text-sm text-ink-soft">
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
                    <Text className="text-sm text-ink-soft">
                      {t("moderation.block")}
                    </Text>
                  </Pressable>

                  {isAdmin && member.role !== "owner" ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleRemove(member.user_id)}
                    >
                      <Text className="text-sm text-ink-soft">
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

        {/* What is actually being shared in here, which the screen said
            nothing about before — including whether your own plan is among
            them, the answer to "is this circle seeing my requests?". */}
        <View className="gap-3">
          <Text className="text-sm font-medium text-ink-soft">
            {t("circles.sharedTitle")}
          </Text>

          {(sharedPlans ?? []).length === 0 ? (
            <Text className="text-base text-ink-muted">
              {t("circles.sharedEmpty")}
            </Text>
          ) : null}

          {(sharedPlans ?? []).map((shared) => (
            <Pressable
              key={shared.plan_id}
              accessibilityRole="link"
              accessibilityLabel={`${shared.plan_title}. ${shared.owner_name}`}
              className="gap-0.5 rounded-2xl border border-ink-line p-4"
              onPress={() =>
                shared.is_mine
                  ? router.push("/")
                  : router.push({
                      pathname: "/orar/[planId]",
                      params: { planId: shared.plan_id },
                    })
              }
            >
              <Text className="text-base font-medium text-ink">
                {shared.plan_title}
              </Text>
              <Text className="text-sm text-ink-muted">
                {shared.is_mine ? t("circles.sharedMine") : shared.owner_name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Link
          href={{ pathname: "/peticiones", params: { circulo: id! } }}
          asChild
        >
          <Button title={t("feed.circleTitle")} variant="secondary" />
        </Link>

        <Link
          href={{ pathname: "/circulo/[id]/chat", params: { id: id! } }}
          asChild
        >
          <Button title={t("chat.open")} variant="secondary" />
        </Link>

        {inviteUrl ? (
          <View className="gap-2 rounded-2xl bg-paper-sunken p-5">
            <Text className="text-sm font-medium text-ink-soft">
              {t("circles.inviteLink")}
            </Text>
            <Text className="text-sm text-ink-muted" selectable>
              {inviteUrl}
            </Text>
          </View>
        ) : null}

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

        {confirmingLeave ? (
          <Text
            className="text-sm text-ink-muted"
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
