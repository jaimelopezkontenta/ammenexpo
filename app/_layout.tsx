import "../global.css";
import "../translation";

import { Lora_400Regular, Lora_600SemiBold } from "@expo-google-fonts/lora";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "@/core/auth/AuthGate";
import { SessionProvider } from "@/core/auth/SessionProvider";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_600SemiBold,
  });

  // `fontError` counts as ready on purpose. A font that failed to load falls
  // back to the system serif, which is a worse-looking screen; holding the
  // splash for it instead would be an app that never opens.
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SessionProvider>
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#FBF8F4" },
                headerStyle: { backgroundColor: "#FBF8F4" },
                headerShadowVisible: false,
                headerTintColor: "#1C1917",
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
            </Stack>
          </AuthGate>
        </SessionProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
