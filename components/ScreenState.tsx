import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { Txt } from "@/components/ui/Text";
import { classifyError } from "@/core/net/classifyError";

import { useThemeColors } from "@/theme";

/**
 * The two states every screen has and almost none of them rendered.
 *
 * Before this, a failed read fell through to the empty state, so the Orar tab
 * told people "nobody has shared their plan with you" when the request had
 * simply failed, and the chapter reader showed nothing at all. Saying "it broke,
 * try again" is both true and actionable; the empty state is neither.
 *
 * Van sobre el fondo de la app y no sobre uno liso porque son lo primero que se
 * ve al entrar en una pestaña: si cargar fuese gris y luego apareciera el
 * amanecer, cada apertura tendría un parpadeo de tema.
 */

type SkeletonPreset = "day" | "list" | "profile" | "circle";

/**
 * La silueta de cada pantalla mientras carga. Sin `skeleton`, el spinner de
 * siempre — así ninguna pantalla cambia sin pedirlo.
 */
const SKELETONS: Record<SkeletonPreset, () => ReactNode> = {
  day: () => (
    <View className="w-full gap-5 px-7 pt-24 md:max-w-read md:self-center">
      <View className="flex-row items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </View>
      <Skeleton className="h-9 w-4/5" />
      <View className="flex-row gap-2">
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-20 rounded-full" />
      </View>
      <Skeleton.Card lines={4} />
      <Skeleton.Card lines={3} />
    </View>
  ),
  list: () => (
    <View className="w-full gap-4 px-7 pt-24 md:max-w-read md:self-center">
      <Skeleton.Card lines={2} />
      <Skeleton.Card lines={3} />
      <Skeleton.Card lines={2} />
    </View>
  ),
  profile: () => (
    <View className="w-full gap-5 px-7 pt-24 md:max-w-read md:self-center">
      <View className="gap-4 rounded-card border border-glassedge/60 bg-glass/40 p-5">
        <Skeleton.AvatarRow />
        <Skeleton className="h-12 w-full rounded-input" />
      </View>
      <Skeleton.Card lines={3} />
    </View>
  ),
  circle: () => (
    <View className="w-full gap-4 px-7 pt-24 md:max-w-read md:self-center">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton.Lines count={2} />
      <Skeleton.Card lines={2} />
      <Skeleton.AvatarRow />
      <Skeleton.AvatarRow />
    </View>
  ),
};

export const LoadingState = ({
  label,
  skeleton,
}: {
  label?: string;
  /** La silueta de lo que viene; sin ella, el spinner centrado de siempre. */
  skeleton?: SkeletonPreset;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <DawnBackground
      className={skeleton ? undefined : "items-center justify-center"}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t("common.loading")}
      // Announced on arrival, so a screen reader user is not left on a screen
      // that seems empty while it is in fact working.
      accessibilityLiveRegion="polite"
    >
      {skeleton ? (
        SKELETONS[skeleton]()
      ) : (
        <ActivityIndicator color={colors.plum.DEFAULT} />
      )}
    </DawnBackground>
  );
};

type ErrorStateProps = {
  onRetry?: () => void;
  /** Shown instead of the generic line when we can say something specific. */
  message?: string;
  /**
   * El error que se va a explicar. Con él se distingue «sin conexión» de
   * «algo salió mal» en cualquier plataforma; sin él solo queda la pista de
   * `navigator.onLine`, que en nativo no existe.
   */
  error?: unknown;
};

export const ErrorState = ({ onRetry, message, error }: ErrorStateProps) => {
  const { t } = useTranslation();
  const browserOffline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  const offline = classifyError(error, !browserOffline) === "network";

  return (
    <DawnBackground className="items-center justify-center gap-3 px-8">
      <Txt variant="heading" className="text-center" accessibilityRole="alert">
        {t("common.errorTitle")}
      </Txt>
      <Txt variant="body" tone="secondary" className="text-center">
        {message ??
          (offline ? t("common.errorNetwork") : t("common.errorBody"))}
      </Txt>
      {onRetry ? (
        <View className="mt-4 w-full">
          <Button title={t("common.retry")} onPress={onRetry} />
        </View>
      ) : null}
    </DawnBackground>
  );
};
