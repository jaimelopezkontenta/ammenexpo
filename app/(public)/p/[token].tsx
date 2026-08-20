import { useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Button } from "@/components/Button";
import { LoadingState } from "@/components/ScreenState";
import { rememberShareToken, rememberSource } from "@/core/auth/pendingToken";
import { useSession } from "@/core/auth/SessionProvider";
import { track } from "@/core/observability/track";
import { resolveRedeemOutcome } from "@/core/plans/redeemOutcome";
import { useSharedPlanPreview } from "@/core/plans/sharePreview";
import { supabase } from "@/utils/supabase";

export default function SharedPlanPreviewScreen() {
  const { t } = useTranslation();
  const { top, scrollBottom } = useScreenPadding();
  const { token, de } = useLocalSearchParams<{
    token: string;
    /** Por dónde llegó: lo pone `buildShareUrl` al repartir el enlace. */
    de?: string;
  }>();
  const { session } = useSession();
  const { data, isLoading, isError, refetch } = useSharedPlanPreview(token);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Stash the token before anything else: if this visitor signs up, onboarding
  // redeems it and they end up genuinely connected to whoever shared the plan.
  useEffect(() => {
    if (token) {
      void rememberShareToken(token);
      // La etiqueta viaja con el enlace y se guarda **una sola vez**: quien
      // abre tres antes de decidirse entró por el primero.
      if (de) void rememberSource(de);
    }
  }, [token, de]);

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

    const { data: outcome, error } = await supabase.rpc("redeem_share_token", {
      p_token: token,
    });

    setIsRedeeming(false);

    const result = outcome as {
      ok?: boolean;
      reason?: string;
      plan_id?: string;
    } | null;

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
      queryClient.invalidateQueries({ queryKey: ["sharedWithMe"] }),
      queryClient.invalidateQueries({ queryKey: ["circles"] }),
    ]);

    // Con `plan_id` el canje abre el día que toca orar, no Hoy: aterrizar en la
    // pestaña de Hoy dejaba el plan a un tab de distancia y sin ninguna pista
    // de que acababa de pasar algo. Sin `plan_id` (enlace de grupo) sigue
    // cayendo a la raíz, como antes.
    if (result.plan_id) {
      router.replace({
        pathname: "/orar/[planId]",
        params: { planId: result.plan_id },
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
  if (isError) {
    return (
      <DawnBackground className="items-center justify-center gap-3 px-8">
        <Text
          className="text-center font-sans-bold text-xl text-plum"
          accessibilityRole="alert"
        >
          {t("common.errorTitle")}
        </Text>
        <Text className="text-center font-sans text-base leading-6 text-mist-ink">
          {t("common.errorBody")}
        </Text>
        <View className="mt-4 w-full">
          <Button title={t("common.retry")} onPress={() => void refetch()} />
        </View>
      </DawnBackground>
    );
  }

  if (!data) {
    return (
      <DawnBackground className="items-center justify-center gap-3 px-8">
        <Text className="text-center font-sans-bold text-xl text-plum">
          {t("share.previewNotFound")}
        </Text>
        <Text className="text-center font-sans text-base leading-6 text-mist-ink">
          {t("share.previewNotFoundHint")}
        </Text>

        {/* This group has no header, so without a way forward a visitor who
            opened an expired WhatsApp link was simply stuck on two lines of
            grey text — on the surface that brings people into the product. */}
        <View className="mt-6 w-full gap-3">
          {session ? (
            <Button
              title={t("share.goHome")}
              onPress={() => router.replace("/")}
            />
          ) : (
            <>
              <Text className="text-center font-sans text-base text-mist-ink">
                {t("share.deadLinkInvite")}
              </Text>
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
    <ScrollView
      className="flex-1 bg-dawn-cream-bg"
      contentContainerClassName="flex-grow px-7 py-14 md:w-full md:max-w-read md:self-center"
      contentContainerStyle={{
        paddingTop: top,
        paddingBottom: scrollBottom,
      }}
    >
      <Text className="font-sans-medium text-sm text-mist-ink">
        {t("common.day", { number: data.day_number })}
      </Text>

      <Text className="mt-2 font-sans-bold text-3xl text-plum">
        {t("share.previewTitle", { name: data.owner_name })}
      </Text>

      <View className="mt-8 gap-6">
        <View className="gap-1.5">
          <Text className="font-sans-semibold text-xl text-plum">
            {data.day_title}
          </Text>
          {data.plan_theme ? (
            <Text className="font-sans text-base text-mist-ink">
              {data.plan_theme}
            </Text>
          ) : null}
        </View>

        {data.scripture_text ? (
          <View className="gap-2 rounded-card bg-glass/60 p-5">
            <Text className="font-sans-medium text-sm text-mist-ink">
              {t("plan.scripture")}
            </Text>
            <Text className="font-sans text-base leading-6 text-plum">
              {data.scripture_text}
            </Text>
            {data.scripture_ref ? (
              <Text className="font-sans text-sm text-mist-ink">
                {data.scripture_ref}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Without this the page was a shop window: someone who cared enough to
            open the link could read about the person but not actually pray for
            them without signing up first. */}
        {data.intercessor_prayer ? (
          <View className="gap-2 rounded-card bg-glass/60 p-5">
            <Text className="font-sans-medium text-sm text-mist-ink">
              {t("intercession.prayerFor", { name: data.owner_name })}
            </Text>
            <Text className="font-serif text-lg leading-reading text-plum">
              {data.intercessor_prayer}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-auto gap-3 pt-12">
        {redeemError ? (
          <Text
            className="text-center font-sans text-sm text-danger"
            accessibilityRole="alert"
          >
            {redeemError}
          </Text>
        ) : null}

        {session ? (
          <Button
            title={t("share.viewPlan")}
            loading={isRedeeming}
            onPress={() => void handleOpenPlan()}
          />
        ) : (
          <>
            <Text className="text-center font-sans text-base text-mist-ink">
              {t("share.previewSignupHint", { name: data.owner_name })}
            </Text>
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
  );
}
