import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { useSession } from "@/core/auth/SessionProvider";
import { useMyCircles } from "@/core/circles/queries";
import {
  useCreateShareLink,
  usePlanCircles,
  usePlanShareLink,
  usePlanSummary,
  useRevokeShareLink,
  useTogglePlanCircle,
} from "@/core/plans/sharing";
import { buildShareUrl, shareOrCopy } from "@/core/share";

export default function SharePlan() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: plan, isLoading } = usePlanSummary(id);
  const { data: circles } = useMyCircles(userId);
  const { data: sharedCircles } = usePlanCircles(id);
  const { data: link, isLoading: linkLoading } = usePlanShareLink(id);

  const createLink = useCreateShareLink(id);
  const revokeLink = useRevokeShareLink(id);
  const toggleCircle = useTogglePlanCircle(id, userId);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0f172a" />
      </View>
    );
  }

  if (!plan) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-base text-slate-500">
          {t("share.previewNotFound")}
        </Text>
      </View>
    );
  }

  const shared = sharedCircles ?? [];
  const linkUrl = link ? buildShareUrl(`/p/${link.token}`) : null;

  const invitation = t("share.message", {
    theme: plan.theme ?? plan.title,
    days: plan.duration_days,
  });

  const handleShare = async () => {
    if (!linkUrl) return;

    setNotice(null);
    setError(null);

    const outcome = await shareOrCopy(invitation, linkUrl);

    // Silence on failure is what made the circle invite button feel broken:
    // the link is right there on screen, so say so instead of nothing.
    if (outcome === "copied") {
      setNotice(t("share.linkCopied"));
    } else if (outcome === "failed") {
      setError(t("share.shareFailed"));
    }
  };

  const handleCreate = async () => {
    setError(null);

    try {
      await createLink.mutateAsync(userId!);
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const handleRevoke = async () => {
    if (!link) return;

    setNotice(null);
    setError(null);

    try {
      await revokeLink.mutateAsync(link.id);
      setNotice(t("share.linkRevoked"));
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("share.title"), headerShown: true }} />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-8 px-7 py-8"
      >
        <View className="gap-1">
          <Text className="text-lg font-semibold text-slate-900">
            {plan.title}
          </Text>
          <Text className="text-base text-slate-500">
            {t("share.subtitle")}
          </Text>
        </View>

        <View className="gap-3">
          <Text className="text-lg font-semibold text-slate-900">
            {t("share.circlesTitle")}
          </Text>

          {(circles ?? []).length > 0 ? (
            <>
              <ChoiceChips
                options={(circles ?? []).map((circle) => ({
                  value: circle.id,
                  label: circle.name,
                }))}
                selected={shared}
                onToggle={(circleId) =>
                  toggleCircle.mutate({
                    circleId,
                    shared: shared.includes(circleId),
                  })
                }
                multiple
              />
              <Text className="text-sm text-slate-500">
                {t("share.circlesHint")}
              </Text>
            </>
          ) : (
            <Text className="text-sm text-slate-500">
              {t("newPlan.noCircles")}
            </Text>
          )}
        </View>

        <View className="gap-3">
          <Text className="text-lg font-semibold text-slate-900">
            {t("share.linkTitle")}
          </Text>

          {linkLoading ? (
            <ActivityIndicator color="#0f172a" />
          ) : linkUrl ? (
            <>
              <View className="gap-2 rounded-2xl bg-slate-50 p-5">
                <Text className="text-sm text-slate-600" selectable>
                  {linkUrl}
                </Text>
              </View>

              <Text className="text-sm text-slate-500">
                {t("share.linkWarning")}
              </Text>

              <Button
                title={t("common.share")}
                onPress={() => void handleShare()}
              />

              {/* Revoking is as prominent as sharing on purpose. These are
                  personal prayer requests: closing the tap must not require
                  hunting through a menu. */}
              <Button
                title={t("share.revoke")}
                variant="secondary"
                loading={revokeLink.isPending}
                onPress={() => void handleRevoke()}
              />
            </>
          ) : (
            <>
              <Text className="text-sm text-slate-500">
                {t("share.noLinkHint")}
              </Text>
              <Button
                title={t("share.createLink")}
                loading={createLink.isPending}
                onPress={() => void handleCreate()}
              />
            </>
          )}
        </View>

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
      </ScrollView>
    </>
  );
}
