import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { Txt } from "@/components/ui/Text";
import { Card } from "@/components/Card";
import { ChoiceChips } from "@/components/ChoiceChips";
import { DawnBackground } from "@/components/DawnBackground";
import { EmailInviteField } from "@/components/email/EmailInviteField";
import { useScreenPadding } from "@/components/useScreenPadding";
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
import {
  buildShareUrl,
  canCopyText,
  copyText,
  shareOrCopy,
} from "@/core/share";
import { useToast } from "@/core/toast/ToastProvider";

import { useThemeColors } from "@/theme";

export default function SharePlan() {
  const { t } = useTranslation();
  const toast = useToast();
  const colors = useThemeColors();
  const { scrollBottom } = useScreenPadding();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: plan, isLoading, isLoadingError, refetch } = usePlanSummary(id);
  const { data: circles, isLoadingError: circlesFailed } = useMyCircles(userId);
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
  if (isLoadingError || !plan) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("share.title"), headerShown: true }}
        />
        <ErrorState
          onRetry={isLoadingError ? () => void refetch() : undefined}
          message={isLoadingError ? undefined : t("share.previewNotFound")}
        />
      </>
    );
  }

  // Creating a plan with a public link lands straight here, before a single day
  // exists. Sharing then would hand someone a link to an empty preview.
  const stillWriting = plan.status === "generating";
  const isPublic = plan.visibility === "public";
  const shared = sharedCircles ?? [];
  const linkUrl = link ? buildShareUrl(`/p/${link.token}`, "plan") : null;

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
      <DawnBackground>
        <ScrollView
          contentContainerClassName="gap-8 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <View className="gap-1">
            <Txt variant="subheadingLg">{plan.title}</Txt>
            <Txt variant="body" tone="secondary">
              {stillWriting
                ? t("share.stillWritingMinute")
                : t("share.subtitle")}
            </Txt>
          </View>

          {/* Publicar, y **dejar de publicar**, que es la mitad que importa:
            elegir "Todo el mundo" al crear el plan era un camino sin vuelta, y
            la única salida habría sido borrarlo entero con los días ya orados
            dentro. */}
          <View className="gap-3">
            <Txt variant="subheadingLg">{t("share.publicTitle")}</Txt>
            <Txt variant="caption">
              {isPublic ? t("share.publicOn") : t("share.publicOff")}
            </Txt>
            <Button
              title={isPublic ? t("share.unpublish") : t("share.publish")}
              variant="secondary"
              loading={setPublic.isPending}
              onPress={() => void handlePublic()}
            />
          </View>

          <View className="gap-3">
            <Txt variant="subheadingLg">{t("share.circlesTitle")}</Txt>

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
                <Txt variant="caption">{t("share.circlesHint")}</Txt>
              </>
            ) : (
              // A failed read used to render "Todavía no tienes círculos", which
              // is a different and untrue thing to say — and it says it on the
              // screen where someone is deciding who gets to see their request.
              <Txt variant="caption">
                {circlesFailed ? t("common.errorBody") : t("newPlan.noCircles")}
              </Txt>
            )}
          </View>

          <View className="gap-3">
            <Txt variant="subheadingLg">{t("share.linkTitle")}</Txt>

            {linkLoading ? (
              <ActivityIndicator
                color={colors.plum.DEFAULT}
                accessibilityLabel={t("common.loading")}
              />
            ) : linkUrl ? (
              <>
                <Card className="gap-2">
                  <Txt variant="caption" selectable>
                    {linkUrl}
                  </Txt>
                </Card>

                <Txt variant="caption">{t("share.linkWarning")}</Txt>

                <Button
                  title={t("common.share")}
                  disabled={stillWriting}
                  onPress={() => void handleShare()}
                />

                {/* Copiar, a un toque y sin pasar por la hoja de compartir: el
                  enlace se pega en un grupo de WhatsApp, un correo, una nota. */}
                {canCopyText() ? (
                  <Button
                    title={t("share.copyLink")}
                    variant="secondary"
                    disabled={stillWriting}
                    onPress={() =>
                      void copyText(linkUrl).then((copied) =>
                        copied
                          ? toast.success(t("share.linkCopied"))
                          : toast.error(t("common.errorGeneric")),
                      )
                    }
                  />
                ) : null}

                {link ? (
                  <EmailInviteField kind="plan" token={link.token} />
                ) : null}

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
                <Txt variant="caption">{t("share.noLinkHint")}</Txt>
                <Button
                  title={t("share.createLink")}
                  loading={createLink.isPending}
                  onPress={() => void handleCreate()}
                />
              </>
            )}
          </View>

          {notice ? (
            <Txt variant="caption" accessibilityRole="alert">
              {notice}
            </Txt>
          ) : null}

          {error ? (
            <Txt variant="caption" tone="danger" accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}
        </ScrollView>
      </DawnBackground>
    </>
  );
}
