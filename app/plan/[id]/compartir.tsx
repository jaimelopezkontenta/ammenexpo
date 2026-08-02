import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { useMyCircles } from "@/core/circles/queries";
import {
  useCreateShareLink,
  usePlanCircles,
  usePlanShareLink,
  usePlanSummary,
  useRevokeShareLink,
  useSetPlanPublic,
  useTogglePlanCircle,
} from "@/core/plans/sharing";
import { buildShareUrl, shareOrCopy } from "@/core/share";

export default function SharePlan() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: plan, isLoading, isError, refetch } = usePlanSummary(id);
  const { data: circles, isError: circlesFailed } = useMyCircles(userId);
  const { data: sharedCircles } = usePlanCircles(id);
  const { data: link, isLoading: linkLoading } = usePlanShareLink(id);

  const createLink = useCreateShareLink(id);
  const revokeLink = useRevokeShareLink(id);
  const toggleCircle = useTogglePlanCircle(id, userId);
  const setPublic = useSetPlanPublic(id);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The toggle used to be a bare `.mutate()` with no error handling and no
  // pending state, and the chip only reflects `sharedCircles` — so a failed
  // share was completely silent. Someone believed they had shared a prayer
  // request with their family and had not.
  const handlePublic = async () => {
    // Se lee aquí y no de una variable de arriba: este manejador vive antes de
    // la guarda que garantiza que el plan ha cargado.
    const publicNow = plan?.visibility === "public";

    setNotice(null);
    setError(null);

    try {
      await setPublic.mutateAsync(!publicNow);
      setNotice(publicNow ? t("share.unpublished") : t("share.published"));
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const handleToggleCircle = async (circleId: string) => {
    setError(null);
    setNotice(null);

    try {
      await toggleCircle.mutateAsync({
        circleId,
        shared: (sharedCircles ?? []).includes(circleId),
      });
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("share.title"), headerShown: true }}
        />
        <LoadingState />
      </>
    );
  }

  // Both used to render as one headerless line of grey text, so a network
  // stumble said your own plan did not exist and gave you no way out.
  if (isError || !plan) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("share.title"), headerShown: true }}
        />
        <ErrorState
          onRetry={isError ? () => void refetch() : undefined}
          message={isError ? undefined : t("share.previewNotFound")}
        />
      </>
    );
  }

  // Creating a plan with a public link lands straight here, before a single day
  // exists. Sharing then would hand someone a link to an empty preview.
  const stillWriting = plan.status === "generating";
  const isPublic = plan.visibility === "public";
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
        className="flex-1 bg-paper"
        contentContainerClassName="gap-8 px-7 py-8"
      >
        <View className="gap-1">
          <Text className="text-lg font-semibold text-ink">{plan.title}</Text>
          <Text className="text-base text-ink-muted">
            {stillWriting ? t("share.stillWritingMinute") : t("share.subtitle")}
          </Text>
        </View>

        {/* Publicar, y **dejar de publicar**, que es la mitad que importa:
            elegir "Todo el mundo" al crear el plan era un camino sin vuelta, y
            la única salida habría sido borrarlo entero con los días ya orados
            dentro. */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-ink">
            {t("share.publicTitle")}
          </Text>
          <Text className="text-sm text-ink-muted">
            {isPublic ? t("share.publicOn") : t("share.publicOff")}
          </Text>
          <Button
            title={isPublic ? t("share.unpublish") : t("share.publish")}
            variant="secondary"
            loading={setPublic.isPending}
            onPress={() => void handlePublic()}
          />
        </View>

        <View className="gap-3">
          <Text className="text-lg font-semibold text-ink">
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
                onToggle={(circleId) => void handleToggleCircle(circleId)}
                multiple
              />
              <Text className="text-sm text-ink-muted">
                {t("share.circlesHint")}
              </Text>
            </>
          ) : (
            // A failed read used to render "Todavía no tienes círculos", which
            // is a different and untrue thing to say — and it says it on the
            // screen where someone is deciding who gets to see their request.
            <Text className="text-sm text-ink-muted">
              {circlesFailed ? t("common.errorBody") : t("newPlan.noCircles")}
            </Text>
          )}
        </View>

        <View className="gap-3">
          <Text className="text-lg font-semibold text-ink">
            {t("share.linkTitle")}
          </Text>

          {linkLoading ? (
            <ActivityIndicator
              color="#1C1917"
              accessibilityLabel={t("common.loading")}
            />
          ) : linkUrl ? (
            <>
              <View className="gap-2 rounded-2xl bg-paper-sunken p-5">
                <Text className="text-sm text-ink-muted" selectable>
                  {linkUrl}
                </Text>
              </View>

              <Text className="text-sm text-ink-muted">
                {t("share.linkWarning")}
              </Text>

              <Button
                title={t("common.share")}
                disabled={stillWriting}
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
              <Text className="text-sm text-ink-muted">
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
          <Text className="text-sm text-ink-muted" accessibilityRole="alert">
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
