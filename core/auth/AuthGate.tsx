import { Redirect, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";

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
  const { session, isLoading, hasOnboarded } = useSession();
  const segments = useSegments();
  const group = segments[0];

  if (group === "(public)") {
    return <>{children}</>;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!session) {
    return group === "(auth)" ? <>{children}</> : <Redirect href="/entrar" />;
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
