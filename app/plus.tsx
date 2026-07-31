import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";

const FREE = ["paywall.freeCircles", "paywall.freeBible", "paywall.freeShare"];

/**
 * What Ammen Plus is, and — just as important — what it is not.
 *
 * Until now hitting the free limit produced a single red line at the bottom of
 * a form you had already filled in, with no button, no link and nowhere to go.
 * The five `paywall.*` strings had been translated since the first week and no
 * screen ever used them.
 *
 * **This screen does not charge, and it says so.** Nothing writes the
 * `subscriptions` table yet — there is no webhook — so a "Subscribe" button
 * would be a button that cannot work. Promising a purchase that silently fails
 * is worse than admitting the wait.
 */
export default function Plus() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen
        options={{ title: t("paywall.title"), headerShown: true }}
      />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="flex-grow gap-8 px-7 py-10"
      >
        <Text className="text-base leading-6 text-slate-500">
          {t("paywall.subtitle")}
        </Text>

        {/* Free first, and it is the longer list. Everything that makes this a
            place to be with other people stays free; what costs money is asking
            a model to write more plans, which is the part that actually costs
            money. Leading with the paid list would misrepresent the deal. */}
        <View className="gap-3">
          <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t("paywall.free")}
          </Text>
          {FREE.map((key) => (
            <Text key={key} className="text-base leading-6 text-slate-800">
              {t(key)}
            </Text>
          ))}
        </View>

        <View className="gap-3">
          <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t("paywall.paid")}
          </Text>
          <Text className="text-base leading-6 text-slate-800">
            {t("paywall.paidPlans")}
          </Text>
        </View>

        <View className="mt-auto gap-3 pt-6">
          <Text
            className="text-center text-base leading-6 text-slate-500"
            accessibilityRole="alert"
          >
            {t("paywall.notYet")}
          </Text>
          <Button
            title={t("paywall.back")}
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </>
  );
}
