import { useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { Orb } from "@/components/Orb";
import { useScreenPadding } from "@/components/useScreenPadding";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";
import { Wordmark } from "@/components/Wordmark";
import {
  redeemShareToken,
  rememberShareToken,
  rememberSource,
  shouldStashLinkToken,
} from "@/core/auth/pendingToken";
import { useSession } from "@/core/auth/SessionProvider";
import { track } from "@/core/observability/track";
import {
  planIdToOpenAfterRedeem,
  resolveRedeemOutcome,
} from "@/core/plans/redeemOutcome";
import { useSharedPlanPreview } from "@/core/plans/sharePreview";

import { qk } from "@/core/query/keys";
export default function SharedPlanPreviewScreen() {
  const { t } = useTranslation();
  const { top, scrollBottom } = useScreenPadding();
  const { token, de } = useLocalSearchParams<{
    token: string;
    /** Por dónde llegó: lo pone `buildShareUrl` al repartir el enlace. */
    de?: string;
  }>();
  const { session, isLoading: sessionLoading } = useSession();
  const { data, isLoading, isLoadingError, error, refetch } =
    useSharedPlanPreview(token);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Stash the token before anything else: if this visitor signs up, onboarding
  // redeems it and they end up genuinely connected to whoever shared the plan.
  // Solo sin sesión: con la cuenta abierta se canjea con «Abrir el plan», y un
  // token guardado se canjeaba solo en el siguiente arranque.
  const stash = shouldStashLinkToken({
    sessionLoading,
    hasSession: Boolean(session),
  });
  useEffect(() => {
    if (token && stash) {
      void rememberShareToken(token);
      // La etiqueta viaja con el enlace y se guarda **una sola vez**: quien
      // abre tres antes de decidirse entró por el primero.
      if (de) void rememberSource(de);
    }
  }, [token, de, stash]);

  // Un evento por lectura resuelta, no por cada remontaje: solo cuando la
  // preview ya trajo datos reales, nunca en el estado de carga o de error.
  useEffect(() => {
    if (data) {
      track("preview", { surface: "share_link" });
    }
  }, [data]);

  const handleOpenPlan = async () => {
    if (!token) return;

    setIsRedeeming(true);
    setRedeemError(null);

    // El canje también olvida el token guardado al abrir la página: sin eso,
    // el siguiente arranque lo volvía a canjear y te llevaba a `/orar/…`.
    const { result, error } = await redeemShareToken(token);

    setIsRedeeming(false);

    // The RPC answers `{ok:false, reason}` for a revoked or expired token
    // *without* raising, so ignoring both the error and the payload made a dead
    // link and a successful redemption produce identical UX: a spinner, then
    // the home screen.
    if (error || !result?.ok) {
      track("redeem", {
        outcome: resolveRedeemOutcome({
          hadError: Boolean(error),
          reason: result?.reason,
        }),
      });
      setRedeemError(t("share.previewNotFoundHint"));
      return;
    }

    track("redeem", { outcome: "ok" });

    // Redeeming is what makes this plan — and possibly a circle — visible.
    // Navigating without refreshing landed people on a Hoy and an Orar tab that
    // still believed nothing had been shared with them.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.sharedWithMe.root }),
      queryClient.invalidateQueries({ queryKey: qk.circles.root }),
    ]);

    // Con `plan_id` el canje abre el día que toca orar, no Hoy: aterrizar en la
    // pestaña de Hoy dejaba el plan a un tab de distancia y sin ninguna pista
    // de que acababa de pasar algo. Sin `plan_id` (enlace de grupo) o si quien
    // abre el enlace es el dueño, cae a la raíz: `/orar/[planId]` es el día de
    // *otra* persona, y el dueño ve "Ya no tienes acceso".
    const planId = planIdToOpenAfterRedeem(result);
    if (planId) {
      router.replace({
        pathname: "/orar/[planId]",
        params: { planId },
      });
      return;
    }

    router.replace("/");
  };

  if (isLoading) {
    return <LoadingState />;
  }

  // A failed request is not a dead link, and telling a stranger someone's link
  // is gone when the network hiccuped is both wrong and unrecoverable.
  if (isLoadingError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  if (!data) {
    return (
      <DawnBackground
        className="items-center justify-center px-8"
        style={{ paddingTop: top, paddingBottom: scrollBottom }}
      >
        {/* A todo el ancho (con tope en escritorio): los botones de dentro
          miden lo que el bloque, y sin esto se quedaban del ancho del texto. */}
        <View className="w-full md:max-w-md">
          <EmptyState
            title={t("share.previewNotFound")}
            body={t("share.previewNotFoundHint")}
          >
            {/* This group has no header, so without a way forward a visitor who
            opened an expired WhatsApp link was simply stuck on two lines of
            grey text — on the surface that brings people into the product. */}
            <View className="gap-3">
              {session ? (
                <Button
                  title={t("share.goHome")}
                  onPress={() => router.replace("/")}
                />
              ) : (
                <>
                  <Txt variant="body" tone="secondary" className="text-center">
                    {t("share.deadLinkInvite")}
                  </Txt>
                  <Link href="/crear-cuenta" asChild>
                    <Button title={t("share.deadLinkCta")} />
                  </Link>
                  <Link href="/entrar" asChild>
                    <Button title={t("share.alreadyMember")} variant="ghost" />
                  </Link>
                </>
              )}
            </View>
          </EmptyState>
        </View>

        {/* La firma: quien llega por un enlace roto ve al menos de qué casa es. */}
        <View className="pt-4">
          <Wordmark />
        </View>
      </DawnBackground>
    );
  }

  return (
    <DawnBackground>
      <ScrollView
        contentContainerClassName="flex-grow px-7 py-14 md:w-full md:max-w-read md:self-center"
        contentContainerStyle={{
          paddingTop: top,
          paddingBottom: scrollBottom,
        }}
      >
        {/* La marca en la puerta: esta página es lo primero que ve quien llega
        de un enlace de WhatsApp sin conocer Ammen, y no decía de quién era.
        El orbe y el wordmark, como en las pantallas de entrada. */}
        <View className="flex-row items-center gap-3 pb-8">
          <Orb size={44} animated={false} />
          <Wordmark size={32} />
        </View>

        <Txt variant="label" tone="secondary">
          {t("common.day", { number: data.day_number })}
        </Txt>

        <Txt variant="display" className="mt-2">
          {t("share.previewTitle", { name: data.owner_name })}
        </Txt>

        <View className="mt-8 gap-6">
          <View className="gap-1.5">
            <Txt variant="subheadingLg" className="text-xl">
              {data.day_title}
            </Txt>
            {data.plan_theme ? (
              <Txt variant="body" tone="secondary">
                {data.plan_theme}
              </Txt>
            ) : null}
          </View>

          {data.scripture_text ? (
            <Card label={t("plan.scripture")} className="gap-2">
              <Txt variant="reading">{data.scripture_text}</Txt>
              {data.scripture_ref ? (
                <Txt variant="editorial">{data.scripture_ref}</Txt>
              ) : null}
            </Card>
          ) : null}

          {/* Without this the page was a shop window: someone who cared enough to
            open the link could read about the person but not actually pray for
            them without signing up first. */}
          {data.intercessor_prayer ? (
            <Card
              label={t("intercession.prayerFor", { name: data.owner_name })}
              className="gap-2"
            >
              <Txt variant="reading">{data.intercessor_prayer}</Txt>
            </Card>
          ) : null}
        </View>

        <View className="mt-auto gap-3 pt-12">
          {redeemError ? (
            <Txt
              variant="caption"
              tone="danger"
              className="text-center"
              accessibilityRole="alert"
            >
              {redeemError}
            </Txt>
          ) : null}

          {session ? (
            <Button
              title={t("share.viewPlan")}
              loading={isRedeeming}
              onPress={() => void handleOpenPlan()}
            />
          ) : (
            <>
              <Txt variant="body" tone="secondary" className="text-center">
                {t("share.previewSignupHint", { name: data.owner_name })}
              </Txt>
              <Link href="/crear-cuenta" asChild>
                <Button
                  title={t("share.previewCta", { name: data.owner_name })}
                />
              </Link>
              <Link href="/entrar" asChild>
                <Button title={t("share.alreadyMember")} variant="ghost" />
              </Link>
            </>
          )}
        </View>
      </ScrollView>
    </DawnBackground>
  );
}
