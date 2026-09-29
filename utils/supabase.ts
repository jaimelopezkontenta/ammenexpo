import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createSecureSessionStorage } from "@/core/native/secureSessionStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in the values from your Supabase project's API settings.",
  );
}

const isWeb = Platform.OS === "web";

/**
 * En nativo la sesión va al llavero (core/native/secureSessionStorage.ts),
 * con AsyncStorage como origen de la migración y como reserva si el llavero
 * falla. `AFTER_FIRST_UNLOCK`: iOS puede arrancar la app con la pantalla
 * bloqueada (prewarming) y tiene que poder leerla; `THIS_DEVICE_ONLY`: una
 * copia de seguridad restaurada en otro iPhone no se lleva la sesión.
 */
const nativeSessionStorage = () => {
  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  };

  return createSecureSessionStorage({
    secure: {
      getItemAsync: (key) => SecureStore.getItemAsync(key, options),
      setItemAsync: (key, value) =>
        SecureStore.setItemAsync(key, value, options),
      deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
    },
    legacy: AsyncStorage,
    // Solo en desarrollo: no hay reporter para esto, y el día que lo haya irá
    // sin el mensaje del error, como todos (ADR 0004).
    onError: (error, operation) => {
      if (__DEV__)
        console.warn(`session storage: ${operation} degraded`, error);
    },
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On web, supabase-js defaults to localStorage, which is what we want for
    // the shared-link -> signup flow. Native gets the keychain adapter above.
    storage: isWeb ? undefined : nativeSessionStorage(),
    autoRefreshToken: true,
    persistSession: true,
    // Required on web so OAuth and magic-link redirects complete the session.
    detectSessionInUrl: isWeb,
  },
});
