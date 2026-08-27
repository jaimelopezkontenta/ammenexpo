import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { useSession } from "@/core/auth/SessionProvider";
import { useUpdateLocale } from "@/core/profile/queries";
import { supportedLanguages, type LanguageCode } from "@/translation";

import { Pill } from "@/components/ui/Pill";

const LABELS: Record<LanguageCode, string> = {
  es: "Español",
  en: "English",
};

export const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const updateLocale = useUpdateLocale(session?.user.id);
  const current = i18n.resolvedLanguage as LanguageCode;

  return (
    <View className="w-full gap-2">
      <Text className="text-center font-sans-medium text-sm text-mist-ink">
        {t("common.language")}
      </Text>
      <View
        className="flex-row justify-center gap-3"
        accessibilityRole="radiogroup"
      >
        {supportedLanguages.map((code) => {
          const isActive = code === current;
          return (
            <Pill
              key={code}
              label={LABELS[code]}
              accessibilityLabel={t(
                code === "es" ? "button.spanish" : "button.english",
              )}
              selected={isActive}
              role="radio"
              onPress={() => {
                void i18n.changeLanguage(code);
                // Y en el servidor, que es lo que nunca se hacía:
                // `profile_settings.locale` se escribía en el onboarding y no
                // volvía a tocarse, así que el servidor creía que hablabas otro
                // idioma del que estabas viendo. Da igual hasta el día que el
                // push mande texto, y ese día ya sería tarde para arreglarlo
                // para quien cambió de idioma hace meses.
                updateLocale.mutate(code);
              }}
            />
          );
        })}
      </View>
    </View>
  );
};
