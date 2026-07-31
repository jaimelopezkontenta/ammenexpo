import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/Button";

/**
 * The two states every screen has and almost none of them rendered.
 *
 * Before this, a failed read fell through to the empty state, so the Orar tab
 * told people "nobody has shared their plan with you" when the request had
 * simply failed, and the chapter reader showed nothing at all. Saying "it broke,
 * try again" is both true and actionable; the empty state is neither.
 */

export const LoadingState = ({ label }: { label?: string }) => {
  const { t } = useTranslation();

  return (
    <View
      className="flex-1 items-center justify-center bg-white"
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t("common.loading")}
      // Announced on arrival, so a screen reader user is not left on a screen
      // that seems empty while it is in fact working.
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator color="#0f172a" />
    </View>
  );
};

type ErrorStateProps = {
  onRetry?: () => void;
  /** Shown instead of the generic line when we can say something specific. */
  message?: string;
};

export const ErrorState = ({ onRetry, message }: ErrorStateProps) => {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
      <Text
        className="text-center text-xl font-bold text-slate-900"
        accessibilityRole="alert"
      >
        {t("common.errorTitle")}
      </Text>
      <Text className="text-center text-base leading-6 text-slate-500">
        {message ?? t("common.errorBody")}
      </Text>
      {onRetry ? (
        <View className="mt-4 w-full">
          <Button title={t("common.retry")} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
};
