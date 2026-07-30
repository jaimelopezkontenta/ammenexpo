import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function Profile() {
  const { t } = useTranslation();

  return (
    <ScreenPlaceholder
      title={t("profile.title")}
      subtitle={t("profile.subtitle")}
    >
      <View className="mt-6 w-full">
        <LanguageSwitcher />
      </View>
    </ScreenPlaceholder>
  );
}
