import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useSession } from "@/core/auth/SessionProvider";

export default function Profile() {
  const { t } = useTranslation();
  const { session, signOut } = useSession();

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="flex-grow gap-8 px-7 py-10"
    >
      <View className="gap-2">
        <Text className="text-2xl font-bold text-slate-900">
          {t("profile.title")}
        </Text>
        <Text className="text-base text-slate-500">{t("profile.subtitle")}</Text>
        {session?.user.email ? (
          <Text className="text-sm text-slate-400">{session.user.email}</Text>
        ) : null}
      </View>

      <LanguageSwitcher />

      <View className="mt-auto">
        <Button
          title={t("auth.signOut")}
          variant="secondary"
          onPress={() => void signOut()}
        />
      </View>
    </ScrollView>
  );
}
