/**
 * Todas las claves `ammen.*` que la app guarda en el dispositivo
 * (AsyncStorage; en web, localStorage), en un solo sitio.
 *
 * Estaban repartidas por siete ficheros, cada una con su estilo
 * (`ammen.theme.v1`, `ammen.language`, `ammen:reader-font`…), y no había
 * forma de contestar «qué deja esta app en un navegador compartido» sin un
 * grep. Aquí se ve de un vistazo, agrupado por de quién es cada cosa, que es
 * lo que decide qué se borra al cerrar sesión (`clearUserScopedStorage`).
 *
 * **Llevan versión** (`.v1`): si el formato de un valor cambia, se sube la
 * versión y el valor viejo se ignora en vez de malinterpretarse. Las que
 * nacieron sin ella se renombraron sin perder lo guardado: el nombre anterior
 * queda en `LEGACY_KEYS` y `getItemMigrating` (core/storage/storage.ts) lo
 * lee una vez, lo pasa al nombre nuevo y lo borra.
 *
 * Fuera de aquí, ningún fichero escribe una clave `ammen.` a mano: lo vigila
 * `keys.test.ts`.
 */
export const STORAGE_KEYS = {
  // -- Del dispositivo: preferencias de quien lo usa, no de una cuenta. Se
  //    quedan al cerrar sesión.

  /** Sistema / Oscuro / Claro. `app/+html.tsx` la lee antes del JS. */
  theme: "ammen.theme.v1",
  /** La Biblia elegida en el lector (core/bible/versionChoice.ts). */
  bibleVersion: "ammen.bibleVersion.v1",
  /** El idioma elegido (core/i18n/languageDetector.ts). */
  language: "ammen.language.v1",
  /** El tamaño de letra del lector (core/bible/readerPrefs.ts). */
  readerFont: "ammen.readerFont.v1",

  // -- De quien todavía no tiene sesión: lo que sobrevive al alta
  //    (core/auth/pendingToken.ts). Se canjea o se adjunta en el siguiente
  //    inicio de sesión, sea de quien sea, así que cerrar sesión no lo borra:
  //    se guardó justo porque no había nadie dentro.

  pendingShareToken: "ammen.pendingShareToken.v1",
  pendingInviteCode: "ammen.pendingInviteCode.v1",
  signupSource: "ammen.signupSource.v1",

  // -- De una persona, pero que no se borra al salir (ver `USER_SCOPED`).

  /**
   * Los «Ya oré» marcados sin red (core/plans/offline.ts). Solo ids, y cada
   * entrada lleva su `userId`: borrarla al cerrar sesión perdería la oración
   * de quien sale antes de recuperar la red, y la de otra cuenta no pasa el
   * RLS al drenarse.
   */
  prayedQueue: "ammen.prayedQueue.v1",
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;

/**
 * El día de hoy guardado para leer sin red, uno por plan. **Lleva el texto de
 * oración del día**: es de una persona y se borra al cerrar sesión o cambiar
 * de cuenta (`USER_SCOPED_PREFIXES`).
 *
 * Sin `.v1` a propósito: es una caché, cada entrada lleva la fecha en que se
 * leyó y se invalida sola (`cachedOn`), y renombrarla dejaría huérfanas
 * copias con texto de oración que el borrado por prefijo ya no vería.
 */
export const TODAY_DAY_PREFIX = "ammen.todayDay.";
export const todayDayKey = (planId: string) => `${TODAY_DAY_PREFIX}${planId}`;

/**
 * Lo que es de la persona que tenía la sesión: se borra al cerrar sesión, al
 * cambiar de cuenta y al arrancar sin sesión (core/auth/sessionFlow.ts,
 * `cleanupOnSessionChange`). Hoy es solo el día guardado; una clave nueva con
 * datos de alguien entra aquí.
 */
export const USER_SCOPED_PREFIXES: readonly string[] = [TODAY_DAY_PREFIX];

export const isUserScopedKey = (key: string) =>
  USER_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix));

/**
 * Los nombres que tuvo cada clave antes de llevar versión. Se leen una vez
 * (`getItemMigrating`) y se borran junto con la nueva (`removeItemEverywhere`).
 */
export const LEGACY_KEYS: Partial<Record<StorageKeyName, readonly string[]>> = {
  language: ["ammen.language"],
  readerFont: ["ammen:reader-font"],
  pendingShareToken: ["ammen.pendingShareToken"],
  pendingInviteCode: ["ammen.pendingInviteCode"],
  signupSource: ["ammen.signupSource"],
  prayedQueue: ["ammen.prayedQueue"],
};

const LEGACY_BY_KEY = new Map<string, readonly string[]>(
  (Object.keys(LEGACY_KEYS) as StorageKeyName[]).map((name) => [
    STORAGE_KEYS[name],
    LEGACY_KEYS[name] ?? [],
  ]),
);

/** Los nombres anteriores de una clave, o ninguno. */
export const legacyKeysOf = (key: string): readonly string[] =>
  LEGACY_BY_KEY.get(key) ?? [];
