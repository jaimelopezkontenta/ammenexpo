import { Redirect, useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/Button";

import { useSession } from "./SessionProvider";

const Loading = () => (
  <View className="flex-1 items-center justify-center bg-white">
    <ActivityIndicator color="#0f172a" />
  </View>
);

/**
 * Routes on session + onboarding state.
 *
 * The `(public)` group is deliberately exempt: a shared prayer plan has to
 * render for someone who has no account yet, which is the entire acquisition
 * loop. Gating it behind auth would turn every shared link into a dead end.
 */
export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const {
    session,
    isLoading,
    hasOnboarded,
    onboardingFailed,
    refreshOnboarding,
    signOut,
  } = useSession();
  const segments = useSegments();
  const group = segments[0];

  if (group === "(public)") {
    return <>{children}</>;
  }

  // The one auth screen you arrive at *with* a session: the recovery link signs
  // you in and then asks for the new password. Sending it to "/" like the rest
  // of the group meant the password was never actually changed, so the next
  // sign-out locked the person out all over again.
  if (segments[1] === "nueva-contrasena") {
    return <>{children}</>;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!session) {
    return group === "(auth)" ? <>{children}</> : <Redirect href="/entrar" />;
  }

  // A read that failed and gave up is not a read still in flight. Both left
  // `hasOnboarded` null, and the gate treated them the same: a spinner with no
  // text, no retry and no way out — the front door of the app, hanging forever,
  // for anyone whose profile is unreadable (a deleted account, an expired token
  // the client still believes in, a backend that is down at launch).
  if (onboardingFailed) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Text
          className="text-center text-xl font-bold text-slate-900"
          accessibilityRole="alert"
        >
          {t("common.errorTitle")}
        </Text>
        <Text className="text-center text-base leading-6 text-slate-500">
          {t("common.errorBody")}
        </Text>
        <View className="mt-4 w-full gap-3">
          <Button
            title={t("common.retry")}
            onPress={() => void refreshOnboarding()}
          />
          {/* The escape hatch. If the session itself is the problem, retrying
              will never fix it, and signing out is the only door left. */}
          <Button
            title={t("auth.signOut")}
            variant="ghost"
            onPress={() => void signOut()}
          />
        </View>
      </View>
    );
  }

  // Onboarding state not resolved yet — routing now would flash the wrong screen.
  if (hasOnboarded === null) {
    return <Loading />;
  }

  if (!hasOnboarded) {
    return group === "(onboarding)" ? (
      <>{children}</>
    ) : (
      <Redirect href="/bienvenida" />
    );
  }

  if (group === "(auth)" || group === "(onboarding)") {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
};
