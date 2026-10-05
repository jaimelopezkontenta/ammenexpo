import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { Txt } from "@/components/ui/Text";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { useUserId } from "@/core/auth/useUserId";
import { canRotateCircleInvite } from "@/core/circles/inviteRotation";
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
  useRotateCircleInviteToken,
} from "@/core/circles/queries";
import { Avatar } from "@/components/Avatar";
import { useBlockConfirm } from "@/components/BlockConfirm";
import { Card } from "@/components/Card";
import { CirclePlanCard } from "@/components/CirclePlanCard";
import { EmailInviteField } from "@/components/email/EmailInviteField";
import { RotateInviteLink } from "@/components/RotateInviteLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBlockUser } from "@/core/moderation/blocks";
import { buildShareUrl, shareOrCopy } from "@/core/share";
import { useToast } from "@/core/toast/ToastProvider";

import { Tap } from "@/components/ui/Tap";

export default function CircleDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();

  const { data: circle, isLoading, isLoadingError, refetch } = useCircle(id);
  const { data: members, isLoadingError: membersFailed } = useCircleMembers(id);
  const { data: inviteToken } = useCircleInviteToken(id);
  const { data: circlePlan } = useCirclePlan(id);
  const { data: canCreatePlan } = useCanCreateCirclePlan(id);
  const { data: sharedPlans } = useCircleSharedPlans(id);
  const markCircleDay = useMarkCircleDay(id, userId);
  const leave = useLeaveCircle(userId);
  const removeMember = useRemoveMember(id);
  const rotateInvite = useRotateCircleInviteToken(id);
  const block = useBlockUser(userId);

  // Los resultados de acción —"listo", "no se pudo"— van por el toast del
  // sistema: caducan solos y no empujan el layout. El `noticeTimer` de 6 s
  // que vivía aquí (copiado literal en el chat) se fue con ellos.
  const toast = useToast();

  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const handleBlock = async (memberId: string) => {
    try {
      await block.mutateAsync(memberId);
      toast.success(t("moderation.blockDone"));
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };
  // El censo bloqueaba con un toque suelto, pegado a «Expulsar»: ahora
  // pregunta antes. Va sobre las ramas tempranas (es un hook).
  const blockConfirm = useBlockConfirm(
    (memberId) => void handleBlock(memberId),
  );

  // Con cabecera también cargando: sin ella no había título ni volver.
  if (isLoading) {
    return (
      <ScreenScaffold title={t("circles.title")} loading skeleton="circle" />
    );
  }

  // These two used to be one branch with no header and no controls, so a flaky
  // connection told you your own circle did not exist and left you stuck on a
  // line of grey text with no way back.
  if (isLoadingError || !circle) {
    return (
      <ScreenScaffold
        title={t("circles.title")}
        error
        onRetry={isLoadingError ? () => void refetch() : undefined}
        errorMessage={isLoadingError ? undefined : t("circles.inviteNotFound")}
      />
    );
  }

  // The token no longer travels with the circle row, so it can be missing for
  // a moment. Showing the invite block with a half-built URL in it would hand
  // somebody a link to nowhere, which is worse than showing it a beat later.
  const inviteUrl = inviteToken
    ? buildShareUrl(`/c/${inviteToken}`, "circulo")
    : null;

  const isAdmin = (members ?? []).some(
    (m) => m.user_id === userId && m.role !== "member",
  );
  // Renovar el enlace, solo a quien la RPC se lo va a aceptar.
  const canRotateInvite = canRotateCircleInvite(userId, circle, members);

  const handleRemove = async (memberId: string) => {
    if (pendingRemoval !== memberId) {
      setPendingRemoval(memberId);
      return;
    }

    setPendingRemoval(null);

    try {
      await removeMember.mutateAsync(memberId);
    } catch {
      toast.error(t("circles.removeFailed"));
    }
  };

  const handleMarkCircleDay = async (planDayId: string) => {
    try {
      await markCircleDay.mutateAsync(planDayId);
    } catch {
      toast.error(t("common.errorGeneric"));
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
    if (outcome === "copied") {
      toast.success(t("circles.linkCopied"));
    } else if (outcome === "failed") {
      toast.error(t("share.shareFailed"));
    }
  };

  const handleLeave = async () => {
    // Leaving a private circle cannot be undone without a fresh invite, and it
    // used to happen on a single tap of a ghost button. `circles.leaveConfirm`
    // has been translated in both languages all along, waiting.
    if (!confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }

    try {
      await leave.mutateAsync(circle.id);
      router.replace("/circulos");
    } catch {
      // Uncaught, this was an unhandled rejection: the button stopped spinning,
      // nothing was said, and the person stayed in the circle believing they
      // had left.
      setConfirmingLeave(false);
      toast.error(t("common.errorGeneric"));
    }
  };

  // Invitar, en un solo bloque: el botón, el enlace y el correo juntos.
  const inviteSection = inviteUrl ? (
    <View className="gap-3">
      <Button title={t("circles.invite")} onPress={() => void handleInvite()} />
      <Card className="gap-2">
        <Txt variant="label" tone="secondary">
          {t("circles.inviteLink")}
        </Txt>
        <Txt variant="caption" selectable>
          {inviteUrl}
        </Txt>
      </Card>
      {inviteToken ? (
        <EmailInviteField kind="circle" token={inviteToken} />
      ) : null}
      {canRotateInvite ? (
        <RotateInviteLink
          kind="circle"
          rotate={() => rotateInvite.mutateAsync()}
        />
      ) : null}
    </View>
  ) : null;

  // En un círculo donde aún estás solo, invitar es lo primero que hay que
  // hacer, y quedaba debajo del plan, el censo, lo compartido, las peticiones
  // y el chat. Con gente dentro vuelve a su sitio, después de lo que pasa.
  const inviteFirst = circle.member_count <= 1;

  return (
    <>
      <ScreenScaffold title={circle.name} contentClassName="flex-grow gap-6">
        {/* The name is already in the navigation header; repeating it here as a
            heading just pushed the useful content down. */}
        <View className="gap-1">
          {circle.description ? (
            <Txt variant="body" tone="secondary">
              {circle.description}
            </Txt>
          ) : null}
          <Txt variant="caption">
            {t("circles.members", { count: circle.member_count })} ·{" "}
            {circle.visibility === "private"
              ? t("circles.visibilityPrivate")
              : t("circles.visibilityPublic")}
          </Txt>
        </View>

        {inviteFirst ? inviteSection : null}

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
          <Txt variant="label" tone="secondary">
            {t("circles.membersTitle")}
          </Txt>
          {/* A failed roster read used to render an empty list —
              indistinguishable from a circle of one — and silently set
              `isAdmin` to false, hiding "Expulsar" from a real admin at the
              moment they most likely need it. */}
          {membersFailed ? (
            <Txt variant="body" tone="secondary" accessibilityRole="alert">
              {t("common.errorBody")}
            </Txt>
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
                  <Tap
                    accessibilityRole="link"
                    className="flex-1 flex-row items-center gap-3"
                  >
                    <Avatar
                      name={member.display_name}
                      url={member.avatar_url}
                      seed={member.user_id}
                      size={32}
                    />
                    <Txt variant="body" className="flex-1">
                      {member.display_name}
                    </Txt>
                  </Tap>
                </Link>
                {member.role !== "member" ? (
                  <Txt variant="caption">
                    {member.role === "owner"
                      ? t("circles.owner")
                      : t("circles.admin")}
                  </Txt>
                ) : null}
              </View>

              {/* Now that strangers can find and join a public circle, the two
                  ways out have to be reachable from the roster itself — not
                  buried behind a message somebody has to receive first. */}
              {member.user_id !== userId ? (
                <View className="flex-row gap-4">
                  <Tap
                    accessibilityRole="button"
                    onPress={() =>
                      blockConfirm.ask(member.user_id, member.display_name)
                    }
                  >
                    <Txt variant="caption">{t("moderation.block")}</Txt>
                  </Tap>

                  {isAdmin && member.role !== "owner" ? (
                    <Tap
                      accessibilityRole="button"
                      onPress={() => void handleRemove(member.user_id)}
                    >
                      <Txt variant="caption">
                        {pendingRemoval === member.user_id
                          ? t("circles.removeConfirmCta")
                          : t("circles.remove")}
                      </Txt>
                    </Tap>
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
          <Txt variant="label" tone="secondary">
            {t("circles.sharedTitle")}
          </Txt>

          {(sharedPlans ?? []).length === 0 ? (
            <EmptyState title={t("circles.sharedEmpty")} />
          ) : null}

          {(sharedPlans ?? []).map((shared) => (
            <Tap
              key={shared.plan_id}
              accessibilityRole="link"
              accessibilityLabel={`${shared.plan_title}. ${shared.owner_name}`}
              className="gap-0.5 rounded-card border border-glassedge/60 p-4"
              onPress={() =>
                shared.is_mine
                  ? router.push("/")
                  : router.push({
                      pathname: "/orar/[planId]",
                      params: { planId: shared.plan_id },
                    })
              }
            >
              <Txt variant="bodyMedium">{shared.plan_title}</Txt>
              <Txt variant="caption">
                {shared.is_mine ? t("circles.sharedMine") : shared.owner_name}
              </Txt>
            </Tap>
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

        {inviteFirst ? null : inviteSection}

        {confirmingLeave ? (
          <Txt
            variant="caption"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {t("circles.leaveConfirm")}
          </Txt>
        ) : null}

        {/* Salir, solo al pie: compartía fila con «Invitar», y es lo único
            de esta pantalla que no se deshace sin una invitación nueva. */}
        <View className="mt-auto gap-3 pt-6">
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
      </ScreenScaffold>
      {blockConfirm.dialog}
    </>
  );
}
