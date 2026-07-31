import { useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { LoadingState } from "@/components/ScreenState";
import { rememberShareToken } from "@/core/auth/pendingToken";
import { useSession } from "@/core/auth/SessionProvider";
import { useSharedPlanPreview } from "@/core/plans/sharePreview";
import { supabase } from "@/utils/supabase";

export default function SharedPlanPreviewScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
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
    }
  }, [token]);

  const handleOpenPlan = async () => {
    if (!token) return;

    setIsRedeeming(true);
    setRedeemError(null);

    const { data: outcome, error } = await supabase.rpc("redeem_share_token", {
      p_token: token,
    });

    setIsRedeeming(false);

    // The RPC answers `{ok:false, reason}` for a revoked or expired token
    // *without* raising, so ignoring both the error and the payload made a dead
    // link and a successful redemption produce identical UX: a spinner, then
    // the home screen.
    if (error || !(outcome as { ok?: boolean } | null)?.ok) {
      setRedeemError(t("share.previewNotFoundHint"));
      return;
    }

    // Redeeming is what makes this plan — and possibly a circle — visible.
    // Navigating without refreshing landed people on a Hoy and an Orar tab that
    // still believed nothing had been shared with them.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sharedWithMe"] }),
      queryClient.invalidateQueries({ queryKey: ["circles"] }),
    ]);

    router.replace("/");
  };

  if (isLoading) {
    return <LoadingState />;
  }

  // A failed request is not a dead link, and telling a stranger someone's link
  // is gone when the network hiccuped is both wrong and unrecoverable.
  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-paper px-8">
        <Text
          className="text-center text-xl font-bold text-ink"
          accessibilityRole="alert"
        >
          {t("common.errorTitle")}
        </Text>
        <Text className="text-center text-base leading-6 text-ink-muted">
          {t("common.errorBody")}
        </Text>
        <View className="mt-4 w-full">
          <Button title={t("common.retry")} onPress={() => void refetch()} />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-paper px-8">
        <Text className="text-center text-xl font-bold text-ink">
          {t("share.previewNotFound")}
        </Text>
        <Text className="text-center text-base leading-6 text-ink-muted">
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
              <Text className="text-center text-base text-ink-muted">
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
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="flex-grow px-7 py-14"
    >
      <Text className="text-sm font-medium text-ink-soft">
        {t("common.day", { number: data.day_number })}
      </Text>

      <Text className="mt-2 text-3xl font-bold text-ink">
        {t("share.previewTitle", { name: data.owner_name })}
      </Text>

      <View className="mt-8 gap-6">
        <View className="gap-1.5">
          <Text className="text-xl font-semibold text-ink">
            {data.day_title}
          </Text>
          {data.plan_theme ? (
            <Text className="text-base text-ink-muted">{data.plan_theme}</Text>
          ) : null}
        </View>

        {data.scripture_text ? (
          <View className="gap-2 rounded-2xl bg-paper-sunken p-5">
            <Text className="text-sm font-medium text-ink-soft">
              {t("plan.scripture")}
            </Text>
            <Text className="text-base leading-6 text-ink">
              {data.scripture_text}
            </Text>
            {data.scripture_ref ? (
              <Text className="text-sm text-ink-muted">
                {data.scripture_ref}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Without this the page was a shop window: someone who cared enough to
            open the link could read about the person but not actually pray for
            them without signing up first. */}
        {data.intercessor_prayer ? (
          <View className="gap-2 rounded-2xl bg-paper-sunken p-5">
            <Text className="text-sm font-medium text-ink-soft">
              {t("intercession.prayerFor", { name: data.owner_name })}
            </Text>
            <Text className="font-serif text-lg leading-reading text-ink">
              {data.intercessor_prayer}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-auto gap-3 pt-12">
        {redeemError ? (
          <Text
            className="text-center text-sm text-red-500"
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
            <Text className="text-center text-base text-ink-muted">
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
