import AsyncStorage from "@react-native-async-storage/async-storage";

import { isUserScopedKey, legacyKeysOf } from "./keys";

/**
 * Lee una clave de `STORAGE_KEYS`. Si está vacía pero hay algo bajo un nombre
 * anterior (`LEGACY_KEYS`), lo pasa al nombre nuevo, borra el viejo y lo
 * devuelve: la migración ocurre una vez, en la primera lectura, sin un paso
 * aparte en el arranque que pudiera llegar tarde a quien lee primero (el
 * idioma se decide antes de pintar nada).
 *
 * Un fallo al leer se propaga igual que el de `AsyncStorage.getItem`: cada
 * llamador ya decide qué hacer con un almacén bloqueado. Un fallo al mover
 * no: lo leído vale igual, y se reintenta en la próxima lectura.
 */
export const getItemMigrating = async (key: string): Promise<string | null> => {
  const current = await AsyncStorage.getItem(key);
  if (current !== null) return current;

  for (const legacy of legacyKeysOf(key)) {
    const value = await AsyncStorage.getItem(legacy);
    if (value === null) continue;

    try {
      await AsyncStorage.setItem(key, value);
      await AsyncStorage.removeItem(legacy);
    } catch {
      // Se queda en el nombre viejo; la próxima lectura lo intenta otra vez.
    }
    return value;
  }

  return null;
};

/**
 * Borra claves y sus nombres anteriores. Borrar solo la nueva dejaría vivo un
 * valor viejo sin migrar —un token ya canjeado, por ejemplo—, y la siguiente
 * lectura lo resucitaría.
 */
export const removeItemEverywhere = async (...keys: string[]) => {
  await AsyncStorage.multiRemove(
    keys.flatMap((key) => [key, ...legacyKeysOf(key)]),
  );
};

/**
 * Borra lo que es de la persona que tenía la sesión (`USER_SCOPED_PREFIXES`:
 * hoy, el día guardado con su texto de oración) y deja lo del dispositivo —
 * tema, Biblia, idioma, letra— y lo que espera al siguiente alta.
 *
 * Se llama al cerrar sesión, al cambiar de cuenta y al arrancar sin sesión
 * (core/auth/SessionProvider.tsx). En web vive en localStorage: sin esto se
 * quedaba para quien usara después ese navegador.
 */
export const clearUserScopedStorage = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const theirs = keys.filter(isUserScopedKey);
    if (theirs.length > 0) await AsyncStorage.multiRemove(theirs);
  } catch {
    // Nada que hacer: el día guardado caduca solo al día siguiente.
  }
};
