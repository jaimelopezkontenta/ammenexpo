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
import {
  devConsoleReporter,
  observability,
  track,
} from "@/core/observability/track";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

void SplashScreen.preventAutoHideAsync();

// RDY-09 — el único sitio que decide el reporter. Sustituir esta línea
// cuando exista un proveedor real; ningún sitio de llamada de `track()`
// debería cambiar por ello. En producción, sin proveedor conectado, esto
// deja el no-op por defecto — `track()` sigue validando el schema y
// ejecutándose igual, simplemente no hay a quién mandarle nada todavía.
if (__DEV__) {
  observability.configure(devConsoleReporter);
}

// Un evento por arranque en frío, no por cada remontaje del árbol — este
// módulo se importa una vez por proceso, así que basta con dispararlo aquí
// arriba, fuera del componente.
track("open", { context: "cold_start" });

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
                // Periwinkle, que es **exactamente** el color del fondo en la
                // franja de arriba: el halo crema del degradado empieza al 7 %
                // de la altura, así que por encima solo hay `dawn.sky` puro.
                //
                // Las pestañas se quitaron la barra de navegación porque
                // pintaba una franja sólida sobre el degradado; las sesenta y
                // cuatro pantallas interiores no pueden hacer lo mismo sin
                // renunciar al botón de volver, así que la barra se queda y lo
                // que se hace es que no se vea: mismo color arriba, y sin
                // sombra, la costura desaparece.
                //
                // A mano y no con clases porque las opciones de navegación no
                // pasan por NativeWind.
                contentStyle: { backgroundColor: "#C7D6F2" },
                headerStyle: { backgroundColor: "#C7D6F2" },
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
