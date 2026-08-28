import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { TabHeader } from "@/components/TabHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavRow } from "@/components/ui/NavRow";
import { PrayForCard } from "@/components/PrayForCard";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { derivePrayerProgress } from "@/core/intercessions/progress";
import { usePlansSharedWithMe } from "@/core/intercessions/queries";
import { useMyPlans } from "@/core/plans/queries";
import { enterStagger } from "@/theme/motion";

/**
 * Orar es un hub de tres bloques siempre visibles, no una bandeja que se
 * vacía cuando nadie te ha compartido nada: Mis planes (crear/compartir),
 * Mi lista (a un tap) y Por otros (la intercesión, con su empty local).
 * El plan propio se reza en Hoy; aquí solo se crea y se comparte.
 */
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
    return <LoadingState skeleton="list" />;
  }

  // Before this, a failed read fell straight through to the empty state and told
  // people nobody had shared anything with them — a false statement, with no way
  // to find out otherwise.
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const myFirstPlan = (myPlans ?? [])[0];
  const hasSharedPlans = (plans ?? []).length > 0;

  return (
    <DawnBackground>
      <TabHeader title={t("tabs.pray")} />
      <ScrollView
        contentContainerClassName="py-8"
        keyboardShouldPersistTaps="handled"
      >
        <ResponsiveTabContent className="gap-6 md:max-w-2xl">
          {/* El microcopy fija el reparto: tu plan se reza en Hoy; esta tab
          es para crearlo, compartirlo y orar por otros. */}
          <Animated.View entering={enterStagger(0)}>
            <Text className="font-sans text-base leading-6 text-mist-ink">
              {t("pray.intro")}
            </Text>
          </Animated.View>

          {/* Mis planes: el CTA primario (Nuevo plan) no depende de que
          exista ya un plan ni de que nadie haya compartido contigo — es la
          puerta que antes solo aparecía dentro del empty-wall. */}
          <Animated.View entering={enterStagger(1)}>
            <Card label={t("pray.sectionMyPlans")} className="gap-3">
              {myFirstPlan ? (
                // El plan como contenido, no como pila de botones: la fila
                // lleva a compartirlo, con su duración de meta.
                <NavRow
                  label={myFirstPlan.title}
                  meta={t("pray.planDuration", {
                    count: myFirstPlan.duration_days,
                  })}
                  onPress={() =>
                    router.push({
                      pathname: "/plan/[id]/compartir",
                      params: { id: myFirstPlan.id },
                    })
                  }
                />
              ) : null}
              <Button
                title={t("pray.newPlan")}
                onPress={() => router.push("/plan/nuevo")}
              />
            </Card>
          </Animated.View>

          {/* Mi lista: un tap desde Orar, siempre. No depende de que nadie
          comparta nada contigo. */}
          <Animated.View entering={enterStagger(2)}>
            <Card label={t("pray.sectionMyList")} className="gap-3">
              {/* Una fila que navega, no otro botón: el único CTA de esta
                pantalla es "Nuevo plan". */}
              <Link href="/lista" asChild>
                <NavRow label={t("pray.openList")} />
              </Link>
            </Card>
          </Animated.View>

          {/* Por otros: la intercesión. Sin planes ajenos el empty es local
          a este bloque — nunca una pared que esconda los dos bloques de
          arriba. */}
          <Animated.View entering={enterStagger(3)} className="gap-4">
            <Text className="font-editorial text-lg text-ember-ink">
              {t("pray.sectionForOthers")}
            </Text>

            {hasSharedPlans ? (
              <>
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
                    className="h-2 overflow-hidden rounded-full bg-glass/70"
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
                        // El guard evita el NaN% si `total` llegara a 0 (hoy
                        // este bloque solo pinta con planes, pero un divisor
                        // sin guard es una trampa esperando su refactor).
                        width: `${
                          prayerProgress.total > 0
                            ? (prayerProgress.completedCount /
                                prayerProgress.total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </View>
                </Card>

                {/* The finish line. The server already sorts prayed-for last,
                  but the UI derives this state itself instead of trusting
                  that order. */}
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
              </>
            ) : (
              <Card className="gap-1">
                {/* El vacío del sistema, en su tamaño de sección: el orbe
                  marca que el vacío es de la app, no un fallo de carga. */}
                <EmptyState
                  size="inline"
                  title={t("pray.forOthersEmptyTitle")}
                  body={t("pray.forOthersEmptyHint")}
                >
                  {/* El copy remata en Avisos; el enlace lo hace accionable. */}
                  <Link
                    href="/avisos"
                    className="min-h-11 justify-center self-center py-2 font-sans-semibold text-base text-ember-ink underline"
                  >
                    {t("notifications.title")}
                  </Link>
                </EmptyState>
              </Card>
            )}
          </Animated.View>

          {/* Terciario: la comunidad queda a un tap pero no compite con los
          tres bloques; un enlace de texto, no otro botón. */}
          <Link
            href="/comunidad"
            className="min-h-11 justify-center self-center py-2 font-sans-semibold text-base text-ember-ink"
          >
            {t("community.title")}
          </Link>
        </ResponsiveTabContent>
      </ScrollView>
    </DawnBackground>
  );
}
