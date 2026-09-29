import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Pill } from "@/components/ui/Pill";
import { Txt } from "@/components/ui/Text";
import { useThemePref } from "@/theme/ThemeProvider";
import type { ThemePref } from "@/theme/preference";

const OPTIONS: ThemePref[] = ["system", "dark", "light"];

export const ThemeSwitcher = () => {
  const { t } = useTranslation();
  const { pref, setPref } = useThemePref();

  return (
    <View className="w-full gap-2">
      <View
        className="flex-row flex-wrap gap-2"
        accessibilityRole="radiogroup"
        accessibilityLabel={t("profile.appearance")}
      >
        {OPTIONS.map((value) => (
          <Pill
            key={value}
            label={t(`profile.appearanceOption.${value}`)}
            selected={pref === value}
            role="radio"
            onPress={() => setPref(value)}
          />
        ))}
      </View>
      <Txt variant="caption">{t("profile.appearanceHint")}</Txt>
    </View>
  );
};
