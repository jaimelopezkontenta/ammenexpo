import { Link, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("common.appName") }} />
      <View className="flex-1 items-center justify-center gap-4 bg-white px-8">
        <Text className="text-center text-xl font-bold text-slate-900">
          {t("common.notFoundTitle")}
        </Text>
        <Link href="/" className="text-base font-semibold text-slate-600">
          {t("common.notFoundLink")}
        </Link>
      </View>
    </>
  );
}
