import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { TabHeader } from "@/components/TabHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { PrayForCard } from "@/components/PrayForCard";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { derivePrayerProgress } from "@/core/intercessions/progress";
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
  const prayerProgress = derivePrayerProgress(plans ?? []);

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
      <DawnBackground>
        <TabHeader title={t("tabs.pray")} />
        <ResponsiveTabContent className="flex-1 justify-center pb-10">
          <View className="w-full items-center gap-3 self-center md:max-w-2xl">
            <Text className="text-center font-sans-bold text-2xl text-plum">
              {t("pray.empty")}
            </Text>
            <Text className="text-center font-sans text-base leading-6 text-mist-ink">
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
        </ResponsiveTabContent>
      </DawnBackground>
    );
  }

  return (
    <DawnBackground>
      <TabHeader title={t("tabs.pray")} />
      <ScrollView
        contentContainerClassName="py-8"
        keyboardShouldPersistTaps="handled"
      >
        <ResponsiveTabContent className="gap-6">
          <View className="gap-1">
            <Text className="font-sans-bold text-2xl text-plum">
              {t("pray.title")}
            </Text>
            <Text className="font-sans text-base text-mist-ink">
              {t("pray.subtitle")}
            </Text>
          </View>

          <Card className="gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="font-sans-semibold text-base text-plum">
                {t("pray.progressTitle")}
              </Text>
              <Text className="font-sans-semibold text-base text-plum">
                {t("pray.progress", {
                  completed: prayerProgress.completedCount,
                  total: prayerProgress.total,
                })}
              </Text>
            </View>
            <View
              className="h-2 overflow-hidden rounded-full bg-white/70"
              accessibilityRole="progressbar"
              accessibilityLabel={t("pray.progressAccessibility", {
                completed: prayerProgress.completedCount,
                total: prayerProgress.total,
              })}
              accessibilityValue={{
                min: 0,
                max: prayerProgress.total,
                now: prayerProgress.completedCount,
              }}
            >
              <View
                className="h-full rounded-full bg-ember-accent"
                style={{
                  width: `${
                    (prayerProgress.completedCount / prayerProgress.total) * 100
                  }%`,
                }}
              />
            </View>
          </Card>

          <View className="gap-6 md:flex-row md:items-start">
            <View className="gap-5 md:min-w-0 md:flex-1">
              {/* The finish line. The server already sorts prayed-for last, but
                the UI derives this state itself instead of trusting that order. */}
              {prayerProgress.allPrayed ? (
                <Card className="gap-1">
                  <Text className="font-sans-semibold text-base text-plum">
                    {t("intercession.allPrayed")}
                  </Text>
                  <Text className="font-sans text-base leading-6 text-mist-ink">
                    {t("intercession.allPrayedBody")}
                  </Text>
                </Card>
              ) : null}

              {prayerProgress.pending.length > 0 ? (
                <View className="gap-3">
                  <Text className="font-editorial text-lg text-ember-ink">
                    {t("pray.pending")}
                  </Text>
                  {prayerProgress.pending.map((plan) => (
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
                </View>
              ) : null}

              {prayerProgress.completed.length > 0 ? (
                <View className="gap-3">
                  <Text className="font-editorial text-lg text-ember-ink">
                    {t("pray.completed")}
                  </Text>
                  {prayerProgress.completed.map((plan) => (
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
                </View>
              ) : null}
            </View>

            <View className="gap-3 md:w-72">
              <Link href="/lista" asChild>
                <Button title={t("list.title")} variant="secondary" />
              </Link>

              <Link href="/comunidad" asChild>
                <Button title={t("community.title")} variant="secondary" />
              </Link>
            </View>
          </View>
        </ResponsiveTabContent>
      </ScrollView>
    </DawnBackground>
  );
}
