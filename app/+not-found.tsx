import { Link, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("common.appName") }} />
      <DawnBackground
        variant="radial"
        className="items-center justify-center gap-4 px-8"
      >
        <Text className="text-center font-sans-bold text-xl text-plum">
          {t("common.notFoundTitle")}
        </Text>
        <Link href="/" className="font-sans-semibold text-base text-mist-ink">
          {t("common.notFoundLink")}
        </Link>
      </DawnBackground>
    </>
  );
}
