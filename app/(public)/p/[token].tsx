import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { rememberShareToken } from "@/core/auth/pendingToken";
import { useSession } from "@/core/auth/SessionProvider";
import { useSharedPlanPreview } from "@/core/plans/sharePreview";
import { supabase } from "@/utils/supabase";

export default function SharedPlanPreviewScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const { data, isLoading } = useSharedPlanPreview(token);
  const [isRedeeming, setIsRedeeming] = useState(false);

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
    await supabase.rpc("redeem_share_token", { p_token: token });
    setIsRedeeming(false);
    router.replace("/");
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0f172a" />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-white px-8">
        <Text className="text-center text-xl font-bold text-slate-900">
          {t("share.previewNotFound")}
        </Text>
        <Text className="text-center text-base text-slate-500">
          {t("share.previewNotFoundHint")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="flex-grow px-7 py-14"
    >
      <Text className="text-sm font-medium text-slate-400">
        {t("common.day", { number: data.day_number })}
      </Text>

      <Text className="mt-2 text-3xl font-bold text-slate-900">
        {t("share.previewTitle", { name: data.owner_name })}
      </Text>

      <View className="mt-8 gap-6">
        <View className="gap-1.5">
          <Text className="text-xl font-semibold text-slate-900">
            {data.day_title}
          </Text>
          {data.plan_theme ? (
            <Text className="text-base text-slate-500">{data.plan_theme}</Text>
          ) : null}
        </View>

        {data.scripture_text ? (
          <View className="gap-2 rounded-2xl bg-slate-50 p-5">
            <Text className="text-sm font-medium text-slate-400">
              {t("plan.scripture")}
            </Text>
            <Text className="text-base leading-6 text-slate-800">
              {data.scripture_text}
            </Text>
            {data.scripture_ref ? (
              <Text className="text-sm text-slate-500">
                {data.scripture_ref}
              </Text>
            ) : null}
          </View>
        ) : null}

        {data.reflection_question ? (
          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-400">
              {t("plan.reflection")}
            </Text>
            <Text className="text-base leading-6 text-slate-800">
              {data.reflection_question}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-auto gap-3 pt-12">
        {session ? (
          <Button
            title={t("share.viewPlan")}
            loading={isRedeeming}
            onPress={() => void handleOpenPlan()}
          />
        ) : (
          <>
            <Text className="text-center text-base text-slate-500">
              {t("share.previewSignupHint")}
            </Text>
            <Link href="/crear-cuenta" asChild>
              <Button title={t("share.previewCta")} />
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
