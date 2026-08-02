import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PrayForCard } from "@/components/PrayForCard";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { usePlansSharedWithMe } from "@/core/intercessions/queries";
import { useMyPlans } from "@/core/plans/queries";

export default function Pray() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: plans,
    isLoading,
    isError,
    refetch,
  } = usePlansSharedWithMe(userId);
  const { data: myPlans } = useMyPlans(userId);

  if (isLoading) {
    return <LoadingState />;
  }

  // Before this, a failed read fell straight through to the empty state and told
  // people nobody had shared anything with them — a false statement, with no way
  // to find out otherwise.
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (!plans || plans.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-paper px-8">
        <Text className="text-center text-2xl font-bold text-ink">
          {t("pray.empty")}
        </Text>
        <Text className="text-center text-base leading-6 text-ink-muted">
          {t("pray.emptyBody")}
        </Text>
        {/* Nobody has shared with you yet, so the useful move is to share
            yours — which is what the button says. It used to read "Crear un
            círculo" and land on the circles *list*, two steps away from the
            thing this screen is actually asking for. */}
        <View className="mt-6 w-full gap-3">
          {/* Tu lista no depende de que nadie comparta nada contigo: es lo que
              se puede hacer aquí el primer día, cuando esta pantalla no tiene
              todavía a nadie por quien orar. */}
          <Link href="/lista" asChild>
            <Button title={t("list.title")} />
          </Link>

          {/* A la comunidad, no al muro suelto. Eran dos puertas al mismo
              contenido con nombres distintos, y la comunidad además trae los
              testimonios y los planes públicos. */}
          <Link href="/comunidad" asChild>
            <Button title={t("community.title")} variant="secondary" />
          </Link>
          <Button
            title={
              (myPlans ?? []).length > 0
                ? t("pray.emptyCta")
                : t("plan.createCta")
            }
            variant="secondary"
            onPress={() =>
              (myPlans ?? []).length > 0
                ? router.push({
                    pathname: "/plan/[id]/compartir",
                    params: { id: myPlans![0].id },
                  })
                : router.push("/plan/nuevo")
            }
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="gap-5 px-7 py-8"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-2xl font-bold text-ink">{t("pray.title")}</Text>
        <Text className="text-base text-ink-muted">{t("pray.subtitle")}</Text>
      </View>

      {/* The finish line. The server already sorts prayed-for last, but the
          screen looked identical to one with work outstanding — just greyer —
          so there was no moment where you were told you were done. */}
      {plans.every((plan) => plan.already_prayed) ? (
        <View className="gap-1 rounded-2xl bg-paper-sunken p-5">
          <Text className="text-base font-semibold text-ink">
            {t("intercession.allPrayed")}
          </Text>
          <Text className="text-base leading-6 text-ink-muted">
            {t("intercession.allPrayedBody")}
          </Text>
        </View>
      ) : null}

      <Link href="/lista" asChild>
        <Button title={t("list.title")} variant="secondary" />
      </Link>

      <Link href="/comunidad" asChild>
        <Button title={t("community.title")} variant="secondary" />
      </Link>

      {plans.map((plan) => (
        <PrayForCard
          key={plan.plan_id}
          plan={plan}
          onOpen={() =>
            router.push({
              pathname: "/orar/[planId]",
              params: { planId: plan.plan_id },
            })
          }
        />
      ))}
    </ScrollView>
  );
}
