import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground, DawnVariant } from "@/components/DawnBackground";

/**
 * The two states every screen has and almost none of them rendered.
 *
 * Before this, a failed read fell through to the empty state, so the Orar tab
 * told people "nobody has shared their plan with you" when the request had
 * simply failed, and the chapter reader showed nothing at all. Saying "it broke,
 * try again" is both true and actionable; the empty state is neither.
 *
 * Van sobre el degradado, y no sobre un fondo liso, porque son lo primero que
 * se ve al entrar en una pestaña: si cargar fuese gris y luego apareciera el
 * amanecer, cada apertura tendría un parpadeo de tema.
 */

const DEFAULT_VARIANT: DawnVariant = "radial";

export const LoadingState = ({
  label,
  variant = DEFAULT_VARIANT,
}: {
  label?: string;
  variant?: DawnVariant;
}) => {
  const { t } = useTranslation();

  return (
    <DawnBackground
      variant={variant}
      className="items-center justify-center"
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t("common.loading")}
      // Announced on arrival, so a screen reader user is not left on a screen
      // that seems empty while it is in fact working.
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator color="#413653" />
    </DawnBackground>
  );
};

type ErrorStateProps = {
  onRetry?: () => void;
  /** Shown instead of the generic line when we can say something specific. */
  message?: string;
  variant?: DawnVariant;
};

export const ErrorState = ({
  onRetry,
  message,
  variant = DEFAULT_VARIANT,
}: ErrorStateProps) => {
  const { t } = useTranslation();

  return (
    <DawnBackground
      variant={variant}
      className="items-center justify-center gap-3 px-8"
    >
      <Text
        className="text-center font-sans-bold text-xl text-plum"
        accessibilityRole="alert"
      >
        {t("common.errorTitle")}
      </Text>
      <Text className="text-center font-sans text-base leading-6 text-mist-ink">
        {message ?? t("common.errorBody")}
      </Text>
      {onRetry ? (
        <View className="mt-4 w-full">
          <Button title={t("common.retry")} onPress={onRetry} />
        </View>
      ) : null}
    </DawnBackground>
  );
};
