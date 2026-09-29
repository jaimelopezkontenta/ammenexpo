import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Txt } from "@/components/ui/Text";
import { DaySection } from "@/components/DaySection";
import { ScriptureSection } from "@/components/DayView";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { useBibleBooks } from "@/core/bible/queries";
import { track } from "@/core/observability/track";
import { usePublicPlanDay } from "@/core/plans/queries";

/**
 * Comunidad's "Abrir plan" for a `public` plan — descubrible/abrible per the
 * B2 contract, but never the Orar surface.
 *
 * Before this screen existed, that link pointed straight at
 * `/orar/[planId]`, which had been the only route for reading somebody
 * else's day. The B2 fix correctly closed that route to a public plan with
 * no explicit share — which quietly turned the link Comunidad had always
 * offered into a dead one. This screen is the other half of the contract:
 * the read that public was always supposed to mean, with no way to pray from
 * here, because that still requires being shared with directly.
 */
export default function PublicPlanDayScreen() {
  const { t } = useTranslation();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const {
    data: plan,
    isLoading,
    isLoadingError,
    refetch,
  } = usePublicPlanDay(planId);
  const { data: books } = useBibleBooks();

  useEffect(() => {
    if (plan) {
      track("preview", { surface: "public_plan" });
    }
  }, [plan]);

  if (isLoading) {
    return <ScreenScaffold title={t("community.title")} loading />;
  }

  if (isLoadingError || !plan) {
    return (
      <ScreenScaffold
        title={t("community.title")}
        error
        onRetry={isLoadingError ? () => void refetch() : undefined}
        errorMessage={
          isLoadingError ? undefined : t("community.publicPlan.notFound")
        }
      />
    );
  }

  return (
    <ScreenScaffold title={plan.owner_name} contentClassName="gap-7">
      <View className="flex-row items-center gap-3">
        <Avatar
          name={plan.owner_name}
          url={plan.owner_avatar_url}
          seed={plan.owner_id}
          size={40}
        />
        <View className="flex-1 gap-1">
          <Txt variant="overline">
            {t("common.day", { number: plan.day_number })}
          </Txt>
          <Txt variant="headingLg">
            {t("community.publicPlan.title", { name: plan.owner_name })}
          </Txt>
        </View>
      </View>

      <Txt variant="body" tone="secondary">
        {plan.plan_title}
      </Txt>

      <ScriptureSection
        scriptureText={plan.scripture_text}
        scriptureRef={plan.scripture_ref}
        books={books ?? []}
      />

      {/* Sin CTA de orar: leer y orar dejaron de ser la misma acción con
            el contrato B2. Esto es lo que Comunidad promete; orar sigue
            pidiendo un share explícito. */}
      <DaySection label={t("community.kind.plan")}>
        <Txt variant="caption">
          {t("community.publicPlan.readOnlyHint", {
            name: plan.owner_name,
          })}
        </Txt>
      </DaySection>
    </ScreenScaffold>
  );
}
