import "../global.css";
import "../translation";

import { CormorantGaramond_400Regular_Italic } from "@expo-google-fonts/cormorant-garamond";
import { Lora_400Regular, Lora_600SemiBold } from "@expo-google-fonts/lora";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppEffects } from "@/core/auth/AppEffects";
import { AuthGate } from "@/core/auth/AuthGate";
import { SessionProvider } from "@/core/auth/SessionProvider";
import { ToastProvider } from "@/core/toast/ToastProvider";
import {
  devConsoleErrorReporter,
  devConsoleReporter,
  observability,
  track,
} from "@/core/observability/track";
import { createQueryClient, wireAppFocus } from "@/core/query/client";
import { wireOnlineManager } from "@/core/query/online";

import { useTranslation } from "react-i18next";

import { ThemeProvider, useIsDark, useThemeColors } from "@/theme";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

void SplashScreen.preventAutoHideAsync();
// El splash nativo no se corta: se funde sobre la pantalla de arranque, que
// pinta el mismo amanecer (el fondo del splash es `dawn.cream-bg`, el centro
// del degradado radial). La animación de verdad vive en `AuthGate.Loading` —
// el splash nativo es estático a propósito.
SplashScreen.setOptions({ fade: true, duration: 220 });

// RDY-09 — el único sitio que decide el reporter. Sustituir esta línea
// cuando exista un proveedor real; ningún sitio de llamada de `track()`
// debería cambiar por ello. En producción, sin proveedor conectado, esto
// deja el no-op por defecto — `track()` sigue validando el schema y
// ejecutándose igual, simplemente no hay a quién mandarle nada todavía.
if (__DEV__) {
  observability.configure(devConsoleReporter);
  observability.configureErrors(devConsoleErrorReporter);
}

// Un render que revienta ya no deja la app en blanco: Expo Router pinta esto
// en su lugar, con reintento (components/AppErrorBoundary.tsx). La del raíz
// no ofrece «Ir a Hoy»: sin el layout montado no hay navegador al que ir.
export { RootErrorBoundary as ErrorBoundary } from "@/components/AppErrorBoundary";

// Un evento por arranque en frío, no por cada remontaje del árbol — este
// módulo se importa una vez por proceso, así que basta con dispararlo aquí
// arriba, fuera del componente.
track("open", { context: "cold_start" });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutInner() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const [queryClient] = useState(createQueryClient);

  // Volver del fondo refresca lo que esté viejo (core/query/client.ts).
  useEffect(() => wireAppFocus(), []);
  // Y recuperar la red, también (core/query/online.ts).
  useEffect(() => wireOnlineManager(NetInfo, onlineManager, Platform.OS), []);

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

  // La root view nativa (lo que asoma en Android al abrir el teclado o
  // durante una transición) acompaña al tema: sin esto se queda blanca y
  // parpadea claro dentro del anochecer. Keyed por la paleta activa — cambia
  // de scheme en caliente y esto la repinta.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.dawn.sky);
  }, [colors.dawn.sky]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <SessionProvider>
            {/* Encima del navigator: los avisos flotan sobre cualquier pantalla
            sin empujar su layout. Dentro de SafeAreaProvider por los insets. */}
            <ToastProvider>
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
                    contentStyle: { backgroundColor: colors.dawn.sky },
                    headerStyle: { backgroundColor: colors.dawn.sky },
                    headerShadowVisible: false,
                    headerTintColor: colors.plum.DEFAULT,
                    // Sin esto el back de las pantallas interiores se anunciaba
                    // "(tabs), back": el grupo anterior no tiene título de
                    // producto, y el lector de pantalla leía el nombre del
                    // directorio.
                    headerBackTitle: t("common.back"),
                    // El empuje lateral nativo. En web el stack de expo-router
                    // hace su fade y no hay nada que configurar.
                    animation: "slide_from_right",
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(onboarding)" />
                </Stack>
              </AuthGate>
            </ToastProvider>
            {/* Último hijo a propósito: sus efectos (canje, push,
                recordatorios, cola offline…) corren después de los de las
                pantallas, como cuando vivían en el provider
                (core/auth/AppEffects.ts). No pinta nada. */}
            <AppEffects />
          </SessionProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </>
  );
}
