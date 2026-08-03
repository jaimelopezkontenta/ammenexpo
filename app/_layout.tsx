import "../global.css";
import "../translation";

import { CormorantGaramond_400Regular_Italic } from "@expo-google-fonts/cormorant-garamond";
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

  // Tres familias, tres trabajos. General Sans lleva la interfaz; Cormorant
  // itálica, lo editorial —el wordmark y los labels—; y Lora se queda con lo
  // que se lee despacio, que es para lo que entró.
  const [fontsLoaded, fontError] = useFonts({
    "GeneralSans-Regular": require("../assets/fonts/GeneralSans-Regular.ttf"),
    "GeneralSans-Medium": require("../assets/fonts/GeneralSans-Medium.ttf"),
    "GeneralSans-Semibold": require("../assets/fonts/GeneralSans-Semibold.ttf"),
    "GeneralSans-Bold": require("../assets/fonts/GeneralSans-Bold.ttf"),
    CormorantGaramond_400Regular_Italic,
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
                // Los mismos valores que el tema, a mano: las opciones de
                // navegación no pasan por NativeWind. La crema es el fondo que
                // asoma **debajo** de los degradados mientras una pantalla
                // monta, así que tiene que ser el tono más claro del sistema y
                // no un blanco, que daría un destello.
                contentStyle: { backgroundColor: "#FFF6EA" },
                headerStyle: { backgroundColor: "#FFF6EA" },
                headerShadowVisible: false,
                headerTintColor: "#413653",
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
