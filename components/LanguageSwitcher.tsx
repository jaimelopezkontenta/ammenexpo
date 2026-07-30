import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { supportedLanguages, type LanguageCode } from "@/translation";

const LABELS: Record<LanguageCode, string> = {
  es: "Español",
  en: "English",
};

export const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage as LanguageCode;

  return (
    <View className="w-full gap-2">
      <Text className="text-center text-sm font-medium text-slate-500">
        {t("common.language")}
      </Text>
      <View className="flex-row justify-center gap-3">
        {supportedLanguages.map((code) => {
          const isActive = code === current;
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => i18n.changeLanguage(code)}
              className={`rounded-full px-4 py-2 ${
                isActive ? "bg-slate-900" : "bg-slate-100"
              }`}
            >
              <Text
                className={isActive ? "font-semibold text-white" : "text-slate-700"}
              >
                {LABELS[code]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
